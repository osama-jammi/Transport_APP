import axios from 'axios';
import { API_BASE_URL } from '@/constants/api';
import { getAccessToken } from './keycloakAuth';

// Deux modes d'authentification mobile :
//   • CHAUFFEUR  → QR code, aucun token : il n'appelle que les endpoints publics.
//   • SUPERVISEUR/ADMIN → connecté via Keycloak : un token est stocké, on l'ajoute
//     alors en en-tete Authorization pour accéder aux endpoints sécurisés.
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// Ajoute le Bearer Keycloak SI un admin est connecté (sinon appel public chauffeur).
api.interceptors.request.use(async (config) => {
  try {
    const token = await getAccessToken();
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  } catch {
    // Pas de token disponible (chauffeur) → requête publique.
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = `${err.config?.baseURL ?? ''}${err.config?.url ?? ''}`;
    if (err.response) {
      // Le serveur a repondu avec un code HTTP 4xx / 5xx
      console.warn(`[API ${err.response.status}] ${url}`, err.response.data);
    } else if (err.request) {
      // La requete est partie mais aucune reponse: backend injoignable, mauvaise URL ou timeout
      console.warn(
        `[API reseau] Aucune reponse du serveur (${url}). ` +
          `Verifiez que le backend tourne et que EXPO_PUBLIC_API_URL pointe vers la bonne IP. ` +
          `Detail: ${err.message}`,
      );
    } else {
      console.warn('[API] Erreur de configuration de la requete:', err.message);
    }
    return Promise.reject(err);
  },
);

export default api;
