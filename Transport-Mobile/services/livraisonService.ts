import api from './api';
import { ENDPOINTS } from '@/constants/api';

export interface Voyage {
  id: number;
  dateCreation: string;
  transporteur: string;
  camionImmatriculation: string;
  chauffeur?: string;
  client: string;
  nbColis: number;
  nbArticles?: number;
  etatChargement: string;
  etatDechargement: string;
  bl: string | null;
  statut: 'EN_COURS' | 'ARCHIVE' | 'SUPPRIME';
  // Destination (chantier) pour la navigation / arrivée
  chantierId?: number | null;
  destinationNom?: string | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  destinationRayon?: number | null;
}

export interface ArriveeResult {
  confirmed: boolean;
  distanceMetres: number | null;
  rayonMetres: number | null;
  forcageRequis: boolean;
  message: string;
}

export interface ArticleScan {
  id: number;
  referenceGap: string;
  nom: string;
  chantierDestination: string;
  qrCode: string;
  statutScan: 'NON_SCANNE' | 'SCANNE_CHARGEMENT' | 'SCANNE_LIVRAISON';
}

/** Liste des livraisons (voyages GAP) du chauffeur connecté, mappées au modèle mobile. */
export async function getVoyagesEnCours(chauffeurId?: number): Promise<Voyage[]> {
  const { data } = await api.get<any[]>(ENDPOINTS.VOYAGES_EN_COURS, {
    params: chauffeurId ? { chauffeurId } : undefined,
  });
  return (data || []).map((g) => ({
    id: g.id,
    dateCreation: g.dateLivraison,
    transporteur: '',
    camionImmatriculation: '',
    chauffeur: g.chauffeur,
    client: g.projetDesignation || g.projetCode || `Voyage #${g.id}`,
    nbColis: g.nbArticles ?? 0,
    nbArticles: g.nbArticles ?? 0,
    etatChargement: (g.statutReception === 'CHARGE' || g.statutReception === 'LIVRE') ? 'TERMINE' : 'EN_COURS',
    etatDechargement: g.statutReception === 'LIVRE' ? 'TERMINE' : '',
    bl: g.bl ?? null,
    statut: g.statutReception === 'ARCHIVE' ? 'ARCHIVE' : 'EN_COURS',
    chantierId: g.projetId ?? null,
    destinationNom: g.projetDesignation ?? null,
    destinationLat: g.destinationLat ?? null,
    destinationLng: g.destinationLng ?? null,
    destinationRayon: g.destinationRayon ?? null,
  }));
}

/** Scanner un article (phase: CHARGEMENT ou LIVRAISON) */
export async function scanArticle(qrCode: string, phase: string): Promise<ArticleScan> {
  const { data } = await api.post<ArticleScan>(ENDPOINTS.SCAN_ARTICLE, null, {
    params: { qrCode, phase },
  });
  return data;
}

/** Confirmer l'arrivée sur le chantier (geofence + code de forçage) */
export async function confirmerArrivee(
  voyageId: number,
  opts: { latitude?: number; longitude?: number; force?: boolean; forceCode?: string } = {},
): Promise<ArriveeResult> {
  const { data } = await api.patch<ArriveeResult>(`/voyages/${voyageId}/arrivee`, null, { params: opts });
  return data;
}

/** Enregistre le bon de livraison (photo + référence) → voyage livré */
export async function enregistrerBL(
  voyageId: number,
  photoUri: string,
  reference?: string,
): Promise<Voyage> {
  const form = new FormData();
  form.append('fichier', { uri: photoUri, name: `bl-voyage-${voyageId}.jpg`, type: 'image/jpeg' } as any);
  if (reference) form.append('reference', reference);
  const { data } = await api.post<Voyage>(`/voyages/${voyageId}/bl`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/** Articles d'un voyage (lus depuis GAP : detail_livraison), mappés au modèle mobile. */
export async function getArticlesByVoyage(voyageId: number): Promise<ArticleScan[]> {
  const { data } = await api.get<any[]>(`/voyages/${voyageId}/articles`);
  return (data || []).map((d) => ({
    id: d.id,
    referenceGap: d.numPrix || '',
    nom: d.designation || '',
    chantierDestination: d.projet || '',
    qrCode: `DETAIL:${d.id}`,
    statutScan:
      d.statutReception === 'SCANNE_LIVRAISON' ? 'SCANNE_LIVRAISON'
      : d.statutReception === 'SCANNE_CHARGEMENT' ? 'SCANNE_CHARGEMENT'
      : 'NON_SCANNE',
  } as ArticleScan));
}
