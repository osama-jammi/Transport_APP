import * as SecureStore from 'expo-secure-store';
import api from './api';
import { ENDPOINTS } from '@/constants/api';
import { setMobileToken, clearMobileToken } from './mobileToken';

export interface ChauffeurInfo {
  id: number;
  nom: string;
  prenom: string;
  matricule: string;
  telephone: string;
  derniereConnexion: string | null;
  /** Camion affecté (pour la remontée GPS) */
  camionId?: number | null;
  camionImmatriculation?: string | null;
  /** Compte administrateur/superviseur → tableau de bord mobile. */
  admin?: boolean;
  /** Jeton backend renvoyé par /connect (chauffeur). */
  token?: string;
}

const CHAUFFEUR_KEY = 'chauffeur_info';

/** Appairage : scan du QR code chauffeur → connexion persistante (+ jeton backend) */
export async function connectByQrCode(qrCode: string): Promise<ChauffeurInfo> {
  const { data } = await api.post<ChauffeurInfo>(ENDPOINTS.CONNECT_QR, null, {
    params: { qrCode },
  });
  // Le backend renvoie un jeton chauffeur : on le stocke pour sécuriser les appels suivants.
  if (data.token) await setMobileToken(data.token);
  await SecureStore.setItemAsync(CHAUFFEUR_KEY, JSON.stringify(data));
  return data;
}

/** Persiste une session (utilisé aussi par la connexion Keycloak administrateur). */
export async function storeChauffeur(info: ChauffeurInfo): Promise<void> {
  await SecureStore.setItemAsync(CHAUFFEUR_KEY, JSON.stringify(info));
}

/** Restaure la session chauffeur depuis le stockage sécurisé */
export async function getStoredChauffeur(): Promise<ChauffeurInfo | null> {
  const raw = await SecureStore.getItemAsync(CHAUFFEUR_KEY);
  return raw ? (JSON.parse(raw) as ChauffeurInfo) : null;
}

/** Enregistre le jeton de notification push (Expo) du chauffeur côté backend */
export async function registerPushToken(chauffeurId: number, token: string): Promise<void> {
  await api.patch(`/chauffeurs/${chauffeurId}/push-token`, null, { params: { token } });
}

/** Déconnexion locale (supprime la session + le jeton backend) */
export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(CHAUFFEUR_KEY);
  await clearMobileToken();
}
