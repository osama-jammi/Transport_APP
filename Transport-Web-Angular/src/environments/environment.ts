// Développement (ng serve sur http://localhost:4200) — proxy Angular redirige
// /Transport_DEV vers le backend local (http://localhost:8082, profil « prod »).
//
// Auth Keycloak = serveur ENTREPRISE http://192.168.77.21:8081, realm RB-realm,
// client public ClientTransport (le même que le backend valide et que la prod utilise).
// Pour revenir à la config MAISON : url 'http://localhost:8080', realm 'agileo-realm',
// clientId 'agileo-front-app'.
export const environment = {
  production: false,
  // Base API du backend Transport, via proxy.conf.json -> localhost:8082
  apiUrl: '/Transport_DEV/api',
  keycloak: {
    url: 'http://192.168.77.21:8081',
    realm: 'RB-realm',
    clientId: 'ClientTransport'
  }
};
