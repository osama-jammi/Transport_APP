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

/** Degrade signature DivNet (a utiliser avec expo-linear-gradient). */
export const GRADIENT = ['#00B5AD', '#17A2B8'] as const;

/** Logo entreprise (bandeau horizontal). */
export const LOGO = require('../assets/rb-logo.png');
