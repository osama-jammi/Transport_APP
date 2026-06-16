import { KeycloakService } from 'keycloak-angular';
import { environment } from '../../environments/environment';

/**
 * Initialisation Keycloak — même protocole qu'Agileo / DivNet.
 * onLoad: 'login-required' force la connexion SSO avant tout accès.
 * Le flux Authorization Code + PKCE est géré nativement par keycloak-js :
 * le callback (?code=...&state=...) est intercepté côté client, donc plus
 * d'erreur "Not found" comme avec l'ancien serveur HTML.
 */
export function initializeKeycloak(keycloak: KeycloakService) {
  return () =>
    keycloak.init({
      config: {
        url: environment.keycloak.url,
        realm: environment.keycloak.realm,
        clientId: environment.keycloak.clientId
      },
      initOptions: {
        onLoad: 'login-required',
        checkLoginIframe: false,
        pkceMethod: 'S256',
        silentCheckSsoRedirectUri:
          window.location.origin + '/assets/silent-check-sso.html'
      },
      enableBearerInterceptor: false, // on fournit notre propre intercepteur
      loadUserProfileAtStartUp: true
    });
}
