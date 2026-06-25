/**
 * Configuration Keycloak mobile — alignée sur le WEB (Transport-Web-Angular) :
 *   serveur ENTREPRISE http://192.168.77.21:8081, realm RB-realm, client ClientTransport.
 *
 * ⚠️ Le téléphone doit être sur le même réseau (LAN) que le serveur Keycloak
 *    192.168.77.21:8081 pour pouvoir s'y connecter.
 *
 * Surcharge possible via variables d'environnement Expo (cf. eas.json) :
 *   EXPO_PUBLIC_KEYCLOAK_URL, EXPO_PUBLIC_KEYCLOAK_REALM, EXPO_PUBLIC_KEYCLOAK_CLIENT
 *   (config MAISON : url 'http://<ip-pc>:8080', realm 'agileo-realm', client 'agileo-front-app')
 *
 * ⚠️ Côté Keycloak : la connexion admin mobile utilise le flux « Direct Access Grants »
 *    (grant_type=password) ; il faut donc ACTIVER « Direct access grants » sur le
 *    client ClientTransport. Aucune URI de redirection n'est nécessaire pour ce flux.
 */
const DEFAULT_KEYCLOAK_URL = 'http://192.168.77.21:8081';

export const KEYCLOAK = {
  url: process.env.EXPO_PUBLIC_KEYCLOAK_URL || DEFAULT_KEYCLOAK_URL,
  realm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM || 'RB-realm',
  clientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT || 'ClientTransport',
};

/** URL du realm (issuer OIDC). */
export function keycloakIssuer(): string {
  return `${KEYCLOAK.url}/realms/${KEYCLOAK.realm}`;
}

/** La configuration est considérée prête dès qu'une URL http(s) est résolue. */
export function keycloakConfigured(): boolean {
  return KEYCLOAK.url.startsWith('http') && !!KEYCLOAK.realm && !!KEYCLOAK.clientId;
}
