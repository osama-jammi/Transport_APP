import * as Location from 'expo-location';
import api from './api';
import { ENDPOINTS } from '@/constants/api';

let _watchSubscription: Location.LocationSubscription | null = null;

// Interrupteur global du suivi GPS, piloté par le feature flag « suivi-trajets » (admin).
// À false : tout suivi en cours est coupé et aucun nouveau ne peut démarrer.
let _trackingEnabled = true;

/** Indique si le suivi GPS est globalement autorisé. */
export function isTrackingEnabled(): boolean { return _trackingEnabled; }

/**
 * Active / désactive globalement la remontée GPS (interrupteur admin).
 * Passé à false, coupe immédiatement tout suivi en cours (watch + timers) et
 * empêche tout nouveau démarrage tant que la fonctionnalité n'est pas réactivée.
 */
export function setTrackingEnabled(enabled: boolean): void {
  _trackingEnabled = enabled;
  if (!enabled) {
    stopTracking();
    stopTrajetVoyage();
    stopSuiviChauffeur();
  }
}

/** Demande les permissions de localisation */
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/** Envoie immédiatement la position actuelle du téléphone (one-shot). */
export async function sendCurrentPosition(camionId?: number, voyageId?: number, chauffeurId?: number): Promise<void> {
  if (!_trackingEnabled) return; // suivi désactivé → aucune position transmise
  try {
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const body: any = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
    if (camionId != null) body.camionId = camionId;
    if (voyageId != null) body.voyageId = voyageId;
    if (chauffeurId != null) body.chauffeurId = chauffeurId;
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
  if (!_trackingEnabled) return; // suivi désactivé par l'admin

  _watchSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: intervalMs,
      distanceInterval: 10, // min 10 m de déplacement
    },
    async (location) => {
      if (!_trackingEnabled) return; // coupé entre-temps → on n'envoie plus
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
  chauffeurId?: number,
  intervalMs = 120_000,
): Promise<void> {
  if (!_trackingEnabled) { stopTrajetVoyage(); return; } // suivi désactivé par l'admin
  // Déjà en cours sur le même voyage → ne rien refaire
  if (_trajetTimer && _trajetVoyageId === voyageId) return;
  stopTrajetVoyage();
  _trajetVoyageId = voyageId;

  const ok = await requestLocationPermission();
  if (!ok) return;

  // Point initial immédiat
  sendCurrentPosition(camionId, voyageId, chauffeurId).catch(() => {});
  // Puis un point toutes les 2 minutes
  _trajetTimer = setInterval(() => {
    sendCurrentPosition(camionId, voyageId, chauffeurId).catch(() => {});
  }, intervalMs);
}

/** Arrête le suivi du trajet du voyage. */
export function stopTrajetVoyage(): void {
  if (_trajetTimer) { clearInterval(_trajetTimer); _trajetTimer = null; }
  _trajetVoyageId = null;
}

// ─── Suivi général du chauffeur (même sans voyage en cours) ───
let _suiviTimer: ReturnType<typeof setInterval> | null = null;
let _suiviChauffeurId: number | null = null;

/**
 * Démarre le suivi GPS d'un chauffeur indépendamment de tout voyage : un point
 * immédiat puis toutes les `intervalMs` (2 min). Permet de tracer TOUS les chauffeurs.
 */
export async function startSuiviChauffeur(
  chauffeurId: number,
  camionId?: number,
  intervalMs = 120_000,
): Promise<void> {
  if (!_trackingEnabled) { stopSuiviChauffeur(); return; } // suivi désactivé par l'admin
  if (_suiviTimer && _suiviChauffeurId === chauffeurId) return;
  stopSuiviChauffeur();
  _suiviChauffeurId = chauffeurId;

  const ok = await requestLocationPermission();
  if (!ok) return;

  sendCurrentPosition(camionId, undefined, chauffeurId).catch(() => {});
  _suiviTimer = setInterval(() => {
    sendCurrentPosition(camionId, undefined, chauffeurId).catch(() => {});
  }, intervalMs);
}

/** Arrête le suivi général du chauffeur. */
export function stopSuiviChauffeur(): void {
  if (_suiviTimer) { clearInterval(_suiviTimer); _suiviTimer = null; }
  _suiviChauffeurId = null;
}
