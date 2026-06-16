// Développement — proxy Angular redirige /Transport_DEV vers http://localhost:8082
//
// ⚠️ Bascule MAISON / ENTREPRISE :
//   - À la MAISON  : url 'http://localhost:8080',        realm 'agileo-realm'
//   - À l'ENTREPRISE : url 'http://192.168.77.21:8081',  realm 'RB-realm'
//   (le backend tourne sur votre PC en localhost:8082 dans les deux cas ;
//    seule la config Keycloak change selon l'endroit)
//
// Actuellement actif : KEYCLOAK LOCAL (base de données = entreprise)
export const environment = {
  production: false,
  // Base API du backend Transport (context-path = /Transport_DEV), via proxy.conf.json -> localhost:8082
  apiUrl: '/Transport_DEV/api',
  keycloak: {
    // ENTREPRISE : 'http://192.168.77.21:8081'
    url: 'http://localhost:8080',
    // ENTREPRISE : 'RB-realm'
    realm: 'agileo-realm',
    // ENTREPRISE : 'Client_transport'
    clientId: 'agileo-front-app'
  }
};
