import Constants from 'expo-constants';

// Port + context-path du backend Transport
const BACKEND_PORT = 8082;
const BACKEND_CONTEXT = '/Transport_DEV/api';

/**
 * Recupere l'adresse IP du PC qui heberge Metro (le serveur de dev Expo).
 * Comme le backend tourne sur la meme machine, on reutilise cette IP :
 * plus besoin de modifier l'adresse a la main quand le reseau change.
 */
function metroHost(): string | null {
  const candidates = [
    (Constants as any)?.expoConfig?.hostUri,
    (Constants as any)?.expoGoConfig?.debuggerHost,
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri,
    (Constants as any)?.manifest?.debuggerHost,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length) {
      const host = c.split('/')[0].split(':')[0]; // garde uniquement l'IP
      if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
    }
  }
  return null;
}

function resolveBaseUrl(): string {
  // 1) Surcharge explicite via .env (prioritaire si renseignee)
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  // 2) Auto-detection de l'IP du PC via Metro (cas standard en dev)
  const host = metroHost();
  if (host) return `http://${host}:${BACKEND_PORT}${BACKEND_CONTEXT}`;
  // 3) Repli — adresse publique de production
  return 'http://81.192.31.254:8040/Transport_DEV/api';
}

export const API_BASE_URL = resolveBaseUrl();

export const ENDPOINTS = {
  // Authentification / appairage
  CONNECT_QR: '/chauffeurs/connect',

  // Voyages — lus depuis GAP (livraisons), filtrés par chauffeur
  VOYAGES_EN_COURS: '/voyages/gap',
  VOYAGE_BY_ID: (id: number) => `/voyages/${id}`,

  // Voyages conteneurs (regroupent plusieurs livraisons), filtrés par chauffeur
  VOYAGES_CONTENEURS: '/voyages-conteneurs',

  // Tableau de bord administrateur
  DASHBOARD_STATS: '/voyages/stats',
  DEPOTS: '/depots',
  CHANTIERS_GAP: '/chantiers/gap',
  CHAUFFEURS_GAP: '/chauffeurs/gap',

  // Articles
  SCAN_ARTICLE: '/articles/scan',
  IMPORT_GAP: '/articles/import-gap',

  // GPS
  GPS_POSITION: '/gps/position',
  GPS_POSITIONS: '/gps/positions',

  // Chauffeurs
  CHAUFFEURS: '/chauffeurs',
  CHAUFFEUR_BY_ID: (id: number) => `/chauffeurs/${id}`,

  // Rapports
  RAPPORT_SYNTHESE: '/rapports/synthese',
  RAPPORT_COMPLET: '/rapports/complet',

  // Administration (fonctionnalités activables)
  ADMIN_FEATURES: '/admin/features',
};
