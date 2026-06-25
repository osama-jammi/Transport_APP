import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import api from './api';
import { getMobileToken } from './mobileToken';
import { API_BASE_URL, ENDPOINTS } from '@/constants/api';
import { getVoyagesEnCours, type Voyage } from './livraisonService';

export interface ChantierStat { chantier: string; total: number; livres: number; }
export interface JourStat { jour: string; total: number; livres: number; }

export interface DashboardStats {
  voyagesAujourdhui: number;
  livresAujourdhui: number;
  enCoursAujourdhui: number;
  enAttenteAujourdhui: number;
  articlesAujourdhui: number;
  voyagesTotal: number;
  chauffeursActifs: number;
  chantiersActifs: number;
  dureeMoyenneMinutes: number | null;
  parChantier: ChantierStat[];
  parJour: JourStat[];
}

export interface Depot {
  id: number;
  nom: string;
  latitude: number | null;
  longitude: number | null;
  rayon: number | null;
}

export interface PositionGps {
  id: number;
  camionId: number;
  immatriculation: string;
  chauffeur: string;
  latitude: number;
  longitude: number;
  horodatage: string;
}

export interface ChantierLite { id: number; code?: string; designation: string; }
export interface ChauffeurLite { id: number; nom: string; prenom: string; matricule?: number | string }

/** Filtres optionnels des analyses (chantier / chauffeur / plage de dates ISO yyyy-MM-dd). */
export interface StatsFilters {
  chantierId?: number | null;
  chauffeurId?: number | null;
  debut?: string | null;
  fin?: string | null;
}

/** Indicateurs du tableau de bord administrateur, filtrables. */
export async function getDashboardStats(filters: StatsFilters = {}): Promise<DashboardStats> {
  const params: Record<string, any> = {};
  if (filters.chantierId) params.chantierId = filters.chantierId;
  if (filters.chauffeurId) params.chauffeurId = filters.chauffeurId;
  if (filters.debut) params.debut = filters.debut;
  if (filters.fin) params.fin = filters.fin;
  const { data } = await api.get<DashboardStats>(ENDPOINTS.DASHBOARD_STATS, { params });
  return {
    ...data,
    parChantier: data.parChantier ?? [],
    parJour: data.parJour ?? [],
  };
}

/**
 * Télécharge le rapport complet « toutes statistiques » (.xlsx) depuis le backend
 * et ouvre la feuille de partage du système (enregistrer / envoyer le fichier).
 * /rapports/** est sécurisé → on joint le jeton backend du superviseur connecté
 * (téléchargement direct hors axios, donc l'en-tête n'est pas ajouté automatiquement).
 * @returns true si le partage a pu être proposé, false sinon.
 */
export async function downloadRapportComplet(filters: StatsFilters = {}): Promise<boolean> {
  const qs = new URLSearchParams();
  if (filters.debut) qs.set('debut', filters.debut);
  if (filters.fin) qs.set('fin', filters.fin);
  if (filters.chantierId) qs.set('chantierId', String(filters.chantierId));
  if (filters.chauffeurId) qs.set('chauffeurId', String(filters.chauffeurId));

  const url = `${API_BASE_URL}${ENDPOINTS.RAPPORT_COMPLET}${qs.toString() ? `?${qs}` : ''}`;
  const fileUri = `${FileSystem.cacheDirectory}rapport-complet.xlsx`;

  const token = await getMobileToken();
  const options = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
  const { uri, status } = await FileSystem.downloadAsync(url, fileUri, options);
  if (status !== 200) throw new Error(`Téléchargement échoué (HTTP ${status})`);

  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: "Rapport d'activité",
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
  return true;
}

/** Liste des chantiers (projets GAP) pour le filtre. */
export async function getChantiersGap(): Promise<ChantierLite[]> {
  const { data } = await api.get<any[]>(ENDPOINTS.CHANTIERS_GAP);
  return (data || []).map((c) => ({
    id: c.id, code: c.code, designation: c.designation || c.code || `Chantier #${c.id}`,
  }));
}

/** Liste des chauffeurs (GAP) pour le filtre. */
export async function getChauffeursGap(): Promise<ChauffeurLite[]> {
  const { data } = await api.get<any[]>(ENDPOINTS.CHAUFFEURS_GAP);
  return (data || []).map((c) => ({
    id: c.id, nom: c.nom || '', prenom: c.prenom || '', matricule: c.matricule,
  }));
}

/** Tous les voyages (livraisons GAP), tous chauffeurs confondus. */
export async function getAllVoyages(): Promise<Voyage[]> {
  return getVoyagesEnCours(); // sans chauffeurId → liste complète
}

/** Dépôts (locaux de départ géolocalisés). */
export async function getDepots(): Promise<Depot[]> {
  const { data } = await api.get<Depot[]>(ENDPOINTS.DEPOTS);
  return data || [];
}

/** Dernières positions GPS de tous les camions. */
export async function getPositions(): Promise<PositionGps[]> {
  const { data } = await api.get<PositionGps[]>(ENDPOINTS.GPS_POSITIONS);
  return data || [];
}
