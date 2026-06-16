/* ============================================================
   Modèles TypeScript alignés sur les DTO du backend Transport.
   ============================================================ */

export type EtatChargement = 'EN_ATTENTE' | 'EN_COURS' | 'TERMINE' | 'INCIDENT';
export type StatutVoyage   = 'EN_COURS' | 'ARCHIVE' | 'SUPPRIME';
export type StatutScan     = 'NON_SCANNE' | 'SCANNE_CHARGEMENT' | 'SCANNE_LIVRAISON';
export type EtatCamion     = 'LIBRE' | 'OCCUPE';

export interface Voyage {
  id: number;
  dateCreation?: string;
  transporteurId?: number;
  transporteur?: string;
  camionId?: number;
  camionImmatriculation?: string;
  chauffeurId?: number;
  chauffeur?: string;
  client?: string;
  /** id du projet/chantier GAP (pour l'édition) */
  chantierId?: number;
  nbColis: number;
  nbArticles?: number;
  etatChargement?: EtatChargement;
  chargementJour?: string;
  chargementHeure?: string;
  arriveeEffectiveChargement?: string;
  etatDechargement?: EtatChargement;
  dechargementJour?: string;
  dechargementHeure?: string;
  arriveeEffectiveDechargement?: string;
  bl?: string;
  hasBl?: boolean;
  forceCode?: string;
  derniereConnexion?: string;
  statut?: StatutVoyage;
  destinationNom?: string;
  destinationLat?: number;
  destinationLng?: number;
  destinationRayon?: number;
}

export interface VoyageRequest {
  transporteurId?: number;
  chauffeurId?: number;
  camionId?: number;
  client?: string;
  chantierId?: number;
  articleIds?: number[];
  articleQuantites?: Record<number, number>;
  typeLivraison?: 'ARTICLE' | 'MATIERE_PREMIERE';
  matieres?: { ref?: string; designation?: string; quantite?: number; unite?: string }[];
  chargementJour?: string;
  chargementHeure?: string;
  dechargementJour?: string;
  dechargementHeure?: string;
}

export interface Chauffeur {
  id: number;
  nom: string;
  prenom: string;
  telephone?: string;
  matricule: string;
  qrCode?: string;
  derniereConnexion?: string;
  actif?: boolean;
}

export interface ChauffeurRequest {
  nom: string;
  prenom: string;
  telephone?: string;
  matricule: string;
}

export interface Chantier {
  id: number;
  nom: string;
  lieu?: string;
  ville?: string;
  code?: string;
  latitude?: number;
  longitude?: number;
  rayonMetres?: number;
  actif?: boolean;
}

export interface ChantierRequest {
  nom: string;
  lieu?: string;
  ville?: string;
  latitude?: number;
  longitude?: number;
  rayonMetres?: number;
}

export interface Camion {
  id: number;
  immatriculation: string;
  device?: string;
  type?: string;
  marque?: string;
  etat: EtatCamion;
  /** Chauffeur affecté (aplati par CamionResponseDTO) */
  chauffeurId?: number | null;
  chauffeurNom?: string | null;
}

export interface Article {
  id: number;
  colisId?: number;
  referenceGap?: string;
  nom?: string;
  chantierDestination?: string;
  qrCode?: string;
  statutScan?: StatutScan;
}

/** Article lu directement depuis la base GAP (ERP) — lecture seule. */
export interface GapArticle {
  id: number;
  designation?: string;
  unite?: string;
  quantiteTot?: number;
  quantiteProd?: number;
  quantiteEnProd?: number;
  quantiteLivre?: number;
  quantitePose?: number;
  quantiteReste?: number;
  numPrix?: string;
  origineArticle?: string;
  projetId?: number;
  atelierId?: number;
}

/** Chauffeur lu directement depuis la base GAP (ERP) — lecture seule. */
export interface GapChauffeur {
  id: number;
  nom?: string;
  prenom?: string;
  matricule?: number;
  derniereConnexion?: string;
}

/** Chantier (projet) lu directement depuis la base GAP (ERP) — lecture seule. */
export interface GapChantier {
  id: number;
  code?: string;
  designation?: string;
  status?: number;
  latitude?: number;
  longitude?: number;
  rayonMetres?: number;
}

/** Ligne d'article d'un voyage (detail_livraison) lue depuis GAP. */
export interface GapVoyageArticle {
  id: number;            // id de la ligne detail_livraison
  articleId?: number;
  designation?: string;
  numPrix?: string;
  quantite?: number;
  statutReception?: string;
  projet?: string;
  heureScan?: string;    // modifier_le : horodatage du scan
}

/** Voyage (livraison) lu directement depuis la base GAP (ERP) — lecture seule. */
export interface GapVoyage {
  id: number;
  dateLivraison?: string;
  chargement?: string;
  dechargement?: string;
  chauffeurId?: number;
  chauffeur?: string;
  projetId?: number;
  projetCode?: string;
  projetDesignation?: string;
  atelierId?: number;
  atelierDesignation?: string;
  statutReception?: string;
  imprime?: boolean;
  nbArticles?: number;
  forceCode?: string;
  bl?: string;
  hasBl?: boolean;
  camionId?: number;
  camionImmatriculation?: string;
  destinationLat?: number;
  destinationLng?: number;
  destinationRayon?: number;
  voyageId?: number;   // voyage conteneur de rattachement (null si aucun)
}

/** Voyage conteneur : regroupe 1..N livraisons (chauffeur affecté ici). */
export interface VoyageConteneur {
  id: number;
  dateVoyage?: string;
  chauffeurId?: number;
  chauffeur?: string;
  statut?: string;
  forceCode?: string;
  nbLivraisons?: number;
  nbMatieres?: number;
  chargement?: string;        // prévu (admin)
  dechargement?: string;      // prévu (admin)
  realChargement?: string;    // réel (chauffeur)
  realDechargement?: string;  // réel (chauffeur)
  localNom?: string;
  localLat?: number;
  localLng?: number;
  localRayon?: number;
}

export interface VoyageConteneurRequest {
  chauffeurId?: number;
  livraisonIds: number[];
  chargementJour?: string;
  chargementHeure?: string;
  dechargementJour?: string;
  dechargementHeure?: string;
  matieres?: {
    projet?: string; cdno?: number; ref?: string; designation?: string;
    of?: string; quantite?: number; unite?: string;
    dateLivraison?: string; dateChargement?: string; dateDechargement?: string;
  }[];
  livraisonDates?: { id: number; chargement?: string; dechargement?: string }[];
  localNom?: string;
  localLat?: number;
  localLng?: number;
  localRayon?: number;
}

/** Un point du trajet GPS d'un voyage. */
export interface TrajetPoint {
  latitude?: number;
  longitude?: number;
  horodatage?: string;
}

/** Trajet GPS d'un voyage (du 1er scan à l'arrivée) + durée. */
export interface TrajetVoyage {
  voyageId?: number;
  debut?: string;
  fin?: string;
  dureeMinutes?: number;
  nbPoints?: number;
  points?: TrajetPoint[];
}

/** Dépôt (local de départ) géolocalisé. */
export interface Depot {
  id?: number;
  nom?: string;
  latitude?: number;
  longitude?: number;
  rayon?: number;
}

/** Commande (entête ENT Divalto) servant à choisir les matières premières. */
export interface CommandeMp {
  cdno: number;
  prefixe?: string;
  projet?: string;
  marche?: string;
  tiers?: string;
  date?: string;
  pieceFournisseur?: string;
  reference?: string;
}

/** Matière première lue depuis Divalto (table MOUV). */
export interface MatierePremiere {
  id: number;
  reference?: string;
  designation?: string;
  quantite?: number;
  unite?: string;
  projet?: string;
  marche?: string;
  tiers?: string;
  devise?: string;
  of?: string;
  cdno?: number;
  dateChargement?: string;
  dateDechargement?: string;
}

export interface PositionGps {
  id: number;
  camionId: number;
  immatriculation?: string;
  chauffeur?: string;
  latitude: number;
  longitude: number;
  horodatage?: string;
}

export interface Transporteur {
  id: number;
  nom: string;
}
