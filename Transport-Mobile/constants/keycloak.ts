import { API_BASE_URL } from './api';

/**
 * Configuration Keycloak mobile — alignée sur le WEB (Transport-Web-Angular) :
 *   realm = 'agileo-realm', clientId = 'agileo-front-app' (config MAISON active).
 *   ENTREPRISE : realm 'RB-realm', clientId 'Client_transport', Keycloak sur :8081.
 *
 * L'URL du serveur Keycloak est dérivée du même host que le backend (IP du PC de
 * dev détectée par Metro) afin d'être joignable depuis le téléphone — le web, lui,
 * utilise http://localhost:8080 car le navigateur tourne sur le PC.
 *
 * Surcharge possible via variables d'environnement Expo :
 *   EXPO_PUBLIC_KEYCLOAK_URL, EXPO_PUBLIC_KEYCLOAK_REALM, EXPO_PUBLIC_KEYCLOAK_CLIENT
 *
 * ⚠️ Côté Keycloak : la connexion mobile utilise le flux « Direct Access Grants »
 *    (grant_type=password) ; il faut donc ACTIVER « Direct access grants » sur le
 *    client (ex. agileo-front-app). Aucune URI de redirection n'est nécessaire.
 */
const KEYCLOAK_PORT = 8080; // MAISON. ENTREPRISE : 8081 (et host 192.168.77.21)

function keycloakUrlFromApi(): string {
  if (process.env.EXPO_PUBLIC_KEYCLOAK_URL) return process.env.EXPO_PUBLIC_KEYCLOAK_URL;
  // API_BASE_URL = http://<host>:8082/Transport_DEV/api  →  http://<host>:8080
  const m = API_BASE_URL.match(/^https?:\/\/([^:/]+)/);
  const host = m ? m[1] : '192.168.1.105';
  return `http://${host}:${KEYCLOAK_PORT}`;
}

export const KEYCLOAK = {
  url: keycloakUrlFromApi(),
  realm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM || 'agileo-realm',
  clientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT || 'agileo-front-app',
};

/** URL du realm (issuer OIDC). */
export function keycloakIssuer(): string {
  return `${KEYCLOAK.url}/realms/${KEYCLOAK.realm}`;
}

/** La configuration est considérée prête dès qu'une URL http(s) est résolue. */
export function keycloakConfigured(): boolean {
  return KEYCLOAK.url.startsWith('http') && !!KEYCLOAK.realm && !!KEYCLOAK.clientId;
}
