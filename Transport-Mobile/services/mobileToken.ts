import * as SecureStore from 'expo-secure-store';

/**
 * Jeton d'authentification émis par le backend Transport (HS256), commun aux
 * deux profils mobile :
 *   • CHAUFFEUR   → obtenu via le scan du QR (/chauffeurs/connect)
 *   • SUPERVISEUR → obtenu via /mobile/auth/login
 *
 * Remplace l'ancien jeton Keycloak côté mobile (Keycloak reste réservé au web).
 * C'est ce jeton que l'intercepteur axios ajoute en en-tête Authorization.
 */
const MOBILE_TOKEN_KEY = 'mobile_token';

export async function setMobileToken(token: string): Promise<void> {
  if (token) await SecureStore.setItemAsync(MOBILE_TOKEN_KEY, token);
}

export async function getMobileToken(): Promise<string | null> {
  return SecureStore.getItemAsync(MOBILE_TOKEN_KEY);
}

export async function clearMobileToken(): Promise<void> {
  await SecureStore.deleteItemAsync(MOBILE_TOKEN_KEY);
}
