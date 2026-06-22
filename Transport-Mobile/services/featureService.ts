import api from './api';
import { ENDPOINTS } from '@/constants/api';

export interface FeatureFlag {
  cle: string;
  libelle?: string;
  actif: boolean;
}

/** Récupère l'état des fonctionnalités (renvoie [] en cas d'erreur). */
export async function getFeatures(): Promise<FeatureFlag[]> {
  try {
    const { data } = await api.get<FeatureFlag[]>(ENDPOINTS.ADMIN_FEATURES);
    return data ?? [];
  } catch {
    return [];
  }
}

/**
 * Indique si une fonctionnalité est active. Par défaut (erreur réseau ou clé
 * absente) on considère la fonctionnalité ACTIVE pour ne pas bloquer l'app.
 */
export async function isFeatureEnabled(cle: string): Promise<boolean> {
  const features = await getFeatures();
  const f = features.find((x) => x.cle === cle);
  return f ? f.actif : true;
}
