// ════════════════════════════════════════════════════════════════════════
// PRODUCTION — Keycloak dédié PROD (même serveur Keycloak que PortailRH).
// Ce fichier remplace environment.ts UNIQUEMENT au build prod
// (ng build --configuration production, cf. angular.json > fileReplacements).
// ⚠️ Le DÉVELOPPEMENT n'est PAS impacté : voir environment.ts
//    (localhost:8080 / agileo-realm / agileo-front-app).
//
// À RENSEIGNER avant le déploiement :
//   • apiUrl        : URL publique de l'API Transport (reverse-proxy / domaine)
//   • keycloak.url  : URL PUBLIQUE du serveur Keycloak de PortailRH (https)
//   • keycloak.realm : realm prod (ex. RB-realm)  — voir aussi mobile + backend
//   • keycloak.clientId : client public créé pour Transport (web + mobile)
// ════════════════════════════════════════════════════════════════════════
export const environment = {
  production: true,
  // Ex: '/Transport/api' derrière un reverse-proxy, ou 'https://transport.votre-domaine.com/Transport/api'
  apiUrl: '/Transport/api',
  keycloak: {
    // Serveur Keycloak ENTREPRISE (RB-realm) — joignable web ET mobile sur le LAN
    url: 'http://192.168.77.21:8081',
    realm: 'RB-realm',
    clientId: 'ClientTransport'
  }
};
