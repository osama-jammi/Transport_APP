import * as Location from 'expo-location';
import api from './api';
import { ENDPOINTS } from '@/constants/api';

let _watchSubscription: Location.LocationSubscription | null = null;

/** Demande les permissions de localisation */
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/** Envoie immédiatement la position actuelle du téléphone (one-shot). */
export async function sendCurrentPosition(camionId?: number, voyageId?: number): Promise<void> {
  try {
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const body: any = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
    if (camionId != null) body.camionId = camionId;
    if (voyageId != null) body.voyageId = voyageId;
    await api.post(ENDPOINTS.GPS_POSITION, body);
  } catch (e) {
    console.warn('[GPS] Envoi position impossible :', e);
  }
}

/**
 * Démarre la remontée GPS vers le serveur.
 * @param camionId  ID du camion affecté au chauffeur
 * @param intervalMs  Intervalle de remontée en ms (défaut 30 s)
 */
export async function startTracking(camionId: number, intervalMs = 30_000): Promise<void> {
  await stopTracking();

  _watchSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: intervalMs,
      distanceInterval: 10, // min 10 m de déplacement
    },
    async (location) => {
      try {
        await api.post(ENDPOINTS.GPS_POSITION, {
          camionId,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (e) {
        // Stockage local en mode hors connexion (à implémenter si nécessaire)
        console.warn('[GPS] Impossible d\'envoyer la position :', e);
      }
    }
  );
}

/** Arrête la remontée GPS */
export async function stopTracking(): Promise<void> {
  if (_watchSubscription) {
    _watchSubscription.remove();
    _watchSubscription = null;
  }
}

// ─── Suivi du trajet d'un voyage : un point toutes les 2 minutes ───
let _trajetTimer: ReturnType<typeof setInterval> | null = null;
let _trajetVoyageId: number | null = null;

/**
 * Démarre le suivi du trajet d'un voyage : enregistre la position du chauffeur
 * immédiatement puis toutes les `intervalMs` (2 min par défaut), liée au voyage.
 */
export async function startTrajetVoyage(
  voyageId: number,
  camionId?: number,
  intervalMs = 120_000,
): Promise<void> {
  // Déjà en cours sur le même voyage → ne rien refaire
  if (_trajetTimer && _trajetVoyageId === voyageId) return;
  stopTrajetVoyage();
  _trajetVoyageId = voyageId;

  const ok = await requestLocationPermission();
  if (!ok) return;

  // Point initial immédiat
  sendCurrentPosition(camionId, voyageId).catch(() => {});
  // Puis un point toutes les 2 minutes
  _trajetTimer = setInterval(() => {
    sendCurrentPosition(camionId, voyageId).catch(() => {});
  }, intervalMs);
}

/** Arrête le suivi du trajet du voyage. */
export function stopTrajetVoyage(): void {
  if (_trajetTimer) { clearInterval(_trajetTimer); _trajetTimer = null; }
  _trajetVoyageId = null;
}
