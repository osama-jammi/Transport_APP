/**
 * Charte graphique DivNet (cyan / teal), inspiree d'Agileo-FrontEnd.
 * Les NOMS de cles sont conserves pour ne pas casser les ecrans existants
 * (ex. `brown` = surface sombre, `gold` = accent) : seules les VALEURS changent,
 * donc toute l'app se re-thematise d'un coup.
 */

export const COLORS = {
  // Surfaces sombres (en-tetes, barres, texte fonce) — teal profond DivNet
  brown:      '#0E5F6B',
  brownDeep:  '#083B44', // barre de statut / fonds les plus sombres
  brownSoft:  '#2C7E8B',

  // Accent cyan DivNet (anciennement "or")
  gold:       '#3FC1D1',
  goldDark:   '#1391A6',
  goldSoft:   '#CDEFF2', // fonds clairs teintes cyan
  goldTint:   '#E6F6F8',

  // Fonds & cartes
  bg:         '#EEF4F5', // fond d'application cool
  card:       '#FFFFFF',
  border:     '#DCE7E9',

  // Texte
  text:       '#16282B',
  textSub:    '#5A6E72',
  textFaint:  '#9FB3B7',

  // Etats
  success:    '#21BA45',
  successBg:  '#D8F3DE',
  warn:       '#E8910C',
  warnBg:     '#FCEFD4',
  danger:     '#E0483D',
  info:       '#17A2B8',

  // Marque DivNet (degrade signature)
  teal:       '#17A2B8',
  teal2:      '#00B5AD',
  mint:       '#75D5CD',

  white:      '#FFFFFF',
};

/** Degrades signature DivNet (a utiliser avec expo-linear-gradient). */
export const GRADIENT = ['#00C2B8', '#17A2B8', '#0F7A8B'] as const;
export const GRADIENT_HEADER = ['#17A2B8', '#128699', '#0C6A78'] as const;
export const GRADIENT_MINT = ['#75D5CD', '#00B5AD'] as const;
export const GRADIENT_GOLD = ['#19D0C5', '#069B92'] as const;

/** Rayons d'arrondis standardises. */
export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/** Espacements standardises. */
export const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28,
} as const;

/**
 * Presets d'ombres (iOS + Android) prets a etaler dans un style.
 * Ex: <View style={[styles.card, SHADOWS.md]} />
 */
export const SHADOWS = {
  sm: {
    shadowColor: '#0B4650', shadowOpacity: 0.08, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  md: {
    shadowColor: '#0B4650', shadowOpacity: 0.12, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  lg: {
    shadowColor: '#0B4650', shadowOpacity: 0.18, shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 }, elevation: 10,
  },
  teal: {
    shadowColor: '#17A2B8', shadowOpacity: 0.34, shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
} as const;

/** Logo entreprise (bandeau horizontal). */
export const LOGO = require('../assets/rb-logo.png');
