// Production — renseignez les URLs réelles (reverse-proxy / domaine).
export const environment = {
  production: true,
  // Ex: '/Transport/api' derrière un reverse-proxy, ou 'https://api.votre-domaine.com/Transport/api'
  apiUrl: '/Transport/api',
  keycloak: {
    url: 'https://auth.votre-domaine.com',
    realm: 'agileo-realm',
    clientId: 'agileo-front-app'
  }
};
