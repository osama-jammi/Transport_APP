import axios from 'axios';
import { API_BASE_URL } from '@/constants/api';

// Authentification mobile = QR code uniquement (pas de Keycloak / pas de token Bearer).
// On n'injecte donc aucun en-tete Authorization : les endpoints /api/** du backend
// sont publics pour l'app mobile.
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
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
