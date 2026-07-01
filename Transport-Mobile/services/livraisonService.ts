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
  projetCode?: string | null;
  destinationNom?: string | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  destinationRayon?: number | null;
  // Arrivée au chantier confirmée (geofence « Je suis sur place » ou code de forçage).
  // Conditionne l'autorisation du scan de livraison (2ᵉ scan).
  arriveeConfirmee?: boolean;
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

/** Voyage conteneur (regroupe plusieurs livraisons) affecté à un chauffeur. */
export interface VoyageConteneur {
  id: number;
  dateVoyage: string | null;
  chauffeur?: string;
  statut: string;            // EN_COURS / ARCHIVE
  nbLivraisons: number;
  nbMatieres: number;
  chargement: string | null;     // prévu
  dechargement: string | null;   // prévu
  realChargement: string | null;   // chargement réel (scan)
  realDechargement: string | null; // déchargement réel (livré)
  localNom: string | null;
}

/** Mappe un voyage GAP (livraison) brut vers le modèle mobile. */
function mapGapVoyage(g: any): Voyage {
  return {
    id: g.id,
    dateCreation: g.dateLivraison,
    transporteur: '',
    camionImmatriculation: '',
    chauffeur: g.chauffeur,
    client: g.projetDesignation || g.projetCode || `Livraison #${g.id}`,
    nbColis: g.nbArticles ?? 0,
    nbArticles: g.nbArticles ?? 0,
    etatChargement: (g.statutReception === 'CHARGE' || g.statutReception === 'LIVRE') ? 'TERMINE' : 'EN_COURS',
    etatDechargement: g.statutReception === 'LIVRE' ? 'TERMINE' : '',
    bl: g.bl ?? null,
    statut: g.statutReception === 'ARCHIVE' ? 'ARCHIVE' : 'EN_COURS',
    chantierId: g.projetId ?? null,
    projetCode: g.projetCode ?? null,
    destinationNom: g.projetDesignation ?? null,
    destinationLat: g.destinationLat ?? null,
    destinationLng: g.destinationLng ?? null,
    destinationRayon: g.destinationRayon ?? null,
    arriveeConfirmee: !!g.arriveeDechargement,
  };
}

/** Liste des livraisons (voyages GAP) du chauffeur connecté, mappées au modèle mobile. */
export async function getVoyagesEnCours(chauffeurId?: number): Promise<Voyage[]> {
  const { data } = await api.get<any[]>(ENDPOINTS.VOYAGES_EN_COURS, {
    params: chauffeurId ? { chauffeurId } : undefined,
  });
  return (data || []).map(mapGapVoyage);
}

/** Voyages conteneurs en cours du chauffeur (chaque voyage regroupe plusieurs livraisons). */
export async function getVoyagesConteneurs(chauffeurId?: number): Promise<VoyageConteneur[]> {
  const { data } = await api.get<any[]>(ENDPOINTS.VOYAGES_CONTENEURS, {
    params: { archives: false, ...(chauffeurId ? { chauffeurId } : {}) },
  });
  return (data || []).map((v) => ({
    id: v.id,
    dateVoyage: v.dateVoyage ?? null,
    chauffeur: v.chauffeur,
    statut: v.statut ?? 'EN_COURS',
    nbLivraisons: v.nbLivraisons ?? 0,
    nbMatieres: v.nbMatieres ?? 0,
    chargement: v.chargement ?? null,
    dechargement: v.dechargement ?? null,
    realChargement: v.realChargement ?? null,
    realDechargement: v.realDechargement ?? null,
    localNom: v.localNom ?? null,
  }));
}

/** Livraisons rattachées à un voyage conteneur, mappées au modèle mobile. */
export async function getLivraisonsDuVoyage(voyageConteneurId: number): Promise<Voyage[]> {
  const { data } = await api.get<any[]>(`${ENDPOINTS.VOYAGES_CONTENEURS}/${voyageConteneurId}/livraisons`);
  return (data || []).map(mapGapVoyage);
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

/** Enregistre le bon de livraison (photo facultative + référence(s)) → voyage livré */
export async function enregistrerBL(
  voyageId: number,
  photoUri?: string | null,
  reference?: string,
): Promise<Voyage> {
  const form = new FormData();
  if (photoUri) {
    form.append('fichier', { uri: photoUri, name: `bl-voyage-${voyageId}.jpg`, type: 'image/jpeg' } as any);
  }
  if (reference) form.append('reference', reference);
  const { data } = await api.post<Voyage>(`/voyages/${voyageId}/bl`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export interface MatiereMp {
  id: number;
  reference?: string;
  designation?: string;
  quantite?: number;
  unite?: string;
  projet?: string;
  pieceFournisseur?: string;
  qteCommande?: number;
  statut?: string;
  /** MATIERE (Divalto) ou STOCK (vue Article_en_stock DivNet, lecture seule). */
  source?: string;
  /** Dépôt d'origine (code DEPO, ex. RB1) pour les lignes de stock. */
  depot?: string;
}

/** Matières premières d'un voyage conteneur, filtrées par chantier de la livraison. */
export async function getMatieresDuVoyageConteneur(voyageConteneurId: number): Promise<MatiereMp[]> {
  const { data } = await api.get<any[]>(`/voyages-conteneurs/${voyageConteneurId}/matieres`);
  return (data || []).map((m) => ({
    id: m.id,
    reference: m.reference ?? undefined,
    designation: m.designation ?? undefined,
    quantite: m.quantite ?? undefined,
    unite: m.unite ?? undefined,
    projet: m.projet ?? undefined,
    pieceFournisseur: m.pieceFournisseur ?? undefined,
    qteCommande: m.qteCommande ?? undefined,
    statut: m.statut ?? undefined,
    source: m.source ?? undefined,
    depot: m.depot ?? undefined,
  } as MatiereMp));
}

/** MP chargée (1er scan = CHARGE) ou déjà livrée. */
export const mpEstChargee = (statut?: string | null) => ['CHARGE', 'LIVRE'].includes((statut || '').toUpperCase());
/** MP livrée (2e scan = LIVRE). */
export const mpEstLivree = (statut?: string | null) => (statut || '').toUpperCase() === 'LIVRE';

/** Upload un BL (photo ou PDF) pour une livraison — endpoint multi-BL. */
export async function ajouterBlFile(voyageId: number, photoUri: string, reference?: string): Promise<void> {
  const ext = photoUri.endsWith('.pdf') ? 'pdf' : 'jpg';
  const form = new FormData();
  form.append('fichier', { uri: photoUri, name: `bl-${voyageId}-${Date.now()}.${ext}`, type: ext === 'pdf' ? 'application/pdf' : 'image/jpeg' } as any);
  if (reference) form.append('reference', reference);
  await api.post(`/voyages/${voyageId}/bls`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
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

/** Annule une ligne de livraison individuelle (livraison/OF). */
export async function annulerLigne(livraisonId: number): Promise<void> {
  await api.patch(`/voyages-conteneurs/livraisons/${livraisonId}/annuler`, null);
}

/** Annule le voyage conteneur complet. */
export async function annulerVoyage(voyageConteneurId: number): Promise<void> {
  await api.patch(`/voyages-conteneurs/${voyageConteneurId}/annuler`, null);
}

/** Confirme une livraison en saisissant le BL manuellement (QR illisible). */
export async function enregistrerBLManuelLivraison(
  voyageId: number,
  reference: string,
): Promise<void> {
  await api.post(`/voyages/${voyageId}/bl-manuel`, null, { params: { reference } });
}
