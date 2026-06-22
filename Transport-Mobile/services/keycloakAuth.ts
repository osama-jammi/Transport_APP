import * as SecureStore from 'expo-secure-store';
import { KEYCLOAK, keycloakIssuer, keycloakConfigured } from '@/constants/keycloak';
import type { ChauffeurInfo } from './authService';

const TOKENS_KEY = 'keycloak_tokens';

export interface KeycloakTokens {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
}

/**
 * Connexion administrateur via Keycloak — flux « Direct Access Grants »
 * (grant_type=password) : l'identifiant + le mot de passe saisis dans l'app
 * sont échangés directement contre des jetons, sans ouvrir de navigateur ni
 * dépendre d'une URI de redirection.
 *
 * ⚠️ Côté Keycloak : le client (agileo-front-app) doit avoir
 *    « Direct access grants » ACTIVÉ (onglet Settings du client).
 *
 * Renvoie un profil compatible {@link ChauffeurInfo} marqué admin.
 */
export async function loginAdminPassword(
  username: string,
  password: string,
): Promise<ChauffeurInfo> {
  if (!keycloakConfigured()) {
    throw new Error('Keycloak non configuré. Renseignez constants/keycloak.ts (baseUrl, realm, clientId).');
  }
  const u = username.trim();
  if (!u || !password) {
    throw new Error('Identifiant et mot de passe requis.');
  }

  const issuer = keycloakIssuer();
  const body = `grant_type=password`
    + `&client_id=${encodeURIComponent(KEYCLOAK.clientId)}`
    + `&username=${encodeURIComponent(u)}`
    + `&password=${encodeURIComponent(password)}`
    + `&scope=${encodeURIComponent('openid profile email')}`;

  let tokenResp: Response;
  try {
    tokenResp = await fetch(`${issuer}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch {
    throw new Error('Serveur Keycloak injoignable. Vérifiez le réseau et l\'adresse du serveur.');
  }

  if (!tokenResp.ok) {
    // Messages d'erreur Keycloak les plus fréquents, traduits pour l'utilisateur.
    let detail = '';
    try {
      const err = await tokenResp.json();
      detail = err.error_description || err.error || '';
    } catch {
      // corps non JSON
    }
    if (detail === 'Invalid user credentials') {
      throw new Error('Identifiant ou mot de passe incorrect.');
    }
    if (detail.includes('not enabled') || detail.includes('Direct')) {
      throw new Error(
        'Connexion par mot de passe désactivée côté Keycloak.\n'
        + 'Activez « Direct access grants » sur le client ' + KEYCLOAK.clientId + '.',
      );
    }
    throw new Error(detail || `Échec de la connexion (${tokenResp.status}).`);
  }

  const tokens: KeycloakTokens = await tokenResp.json();
  await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens));

  // Profil utilisateur via userinfo (évite de décoder le JWT côté mobile).
  let prenom = 'Administrateur';
  let nom = '';
  try {
    const ui = await fetch(`${issuer}/protocol/openid-connect/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }).then((r) => r.json());
    prenom = ui.given_name || ui.preferred_username || ui.name || ui.email || 'Administrateur';
    nom = ui.family_name || '';
  } catch {
    // userinfo indisponible : profil minimal
  }

  return {
    id: 0,
    nom,
    prenom,
    matricule: '',
    telephone: '',
    derniereConnexion: null,
    admin: true,
  };
}

/** Jeton d'accès Keycloak stocké (le cas échéant). */
export async function getAccessToken(): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(TOKENS_KEY);
  if (!raw) return null;
  try { return (JSON.parse(raw) as KeycloakTokens).access_token ?? null; } catch { return null; }
}

/** Supprime les jetons Keycloak (déconnexion locale admin). */
export async function clearKeycloak(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKENS_KEY);
}
