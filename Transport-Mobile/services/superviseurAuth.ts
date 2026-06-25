import api from './api';
import { ENDPOINTS } from '@/constants/api';
import { setMobileToken } from './mobileToken';
import type { ChauffeurInfo } from './authService';

interface MobileAuthResponse {
  token: string;
  role: string;
  id: number;
  username: string;
  nom: string;
  prenom: string;
}

/**
 * Connexion superviseur/admin de l'app mobile via le backend Transport
 * (table utilisateur_mobile, BCrypt) — sans Keycloak. Stocke le jeton backend
 * puis renvoie un profil compatible {@link ChauffeurInfo} marqué admin.
 */
export async function loginSuperviseur(
  username: string,
  password: string,
): Promise<ChauffeurInfo> {
  const u = username.trim();
  if (!u || !password) {
    throw new Error('Identifiant et mot de passe requis.');
  }

  let data: MobileAuthResponse;
  try {
    ({ data } = await api.post<MobileAuthResponse>(ENDPOINTS.MOBILE_LOGIN, {
      username: u,
      password,
    }));
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 401) throw new Error('Identifiant ou mot de passe incorrect.');
    if (status === 403) throw new Error('Compte désactivé. Contactez l\'administrateur.');
    throw new Error(e?.response?.data?.message || 'Échec de la connexion.');
  }

  await setMobileToken(data.token);

  return {
    id: data.id,
    nom: data.nom || '',
    prenom: data.prenom || data.username || 'Administrateur',
    matricule: '',
    telephone: '',
    derniereConnexion: null,
    admin: true,
  };
}
