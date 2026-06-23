/**
 * Thèmes de couleur de l'interface (sélectionnables dans Administration).
 * Applique les variables CSS de la charte (src/styles.css) à chaud et persiste
 * le choix dans localStorage. Palettes professionnelles largement répandues.
 */
export interface ThemePalette {
  cle: string;
  nom: string;
  apercu: string;          // couleur d'aperçu (pastille)
  vars: Record<string, string>;
}

const palette = (primary: string, dark: string, light: string, accent: string, accentDark: string,
                 sb: string, sb2: string): Record<string, string> => ({
  '--primary': primary, '--primary-dark': dark, '--primary-light': light,
  '--accent': accent, '--accent-dark': accentDark,
  '--teal': primary, '--teal-2': accent, '--mint': light,
  '--sidebar-bg': sb, '--sidebar-bg2': sb2,
  '--gradient': `linear-gradient(135deg, ${accent} 0%, ${primary} 55%, ${dark} 100%)`,
  '--gradient-soft': `linear-gradient(135deg, ${accent} 0%, ${primary} 100%)`,
  '--gradient-mint': `linear-gradient(135deg, ${light} 0%, ${accent} 100%)`,
  '--ring': `0 0 0 4px ${rgba(primary, 0.18)}`,
  '--shadow-glow': `0 8px 22px ${rgba(primary, 0.34)}`,
});

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export const THEMES: ThemePalette[] = [
  { cle: 'bleu',   nom: 'Indigo', apercu: '#525CE5',
    vars: palette('#525CE5', '#3F48C4', '#ECEDFB', '#6D75EA', '#525CE5', '#525CE5', '#3A43B5') },
  { cle: 'teal',   nom: 'Teal',   apercu: '#17A2B8',
    vars: palette('#17A2B8', '#0F7A8B', '#E3F4F6', '#00B5AD', '#0A8F88', '#17A2B8', '#0E7C8B') },
  { cle: 'vert',   nom: 'Vert',   apercu: '#059669',
    vars: palette('#059669', '#047857', '#D1FAE5', '#10B981', '#059669', '#059669', '#065F46') },
  { cle: 'azur',   nom: 'Bleu',   apercu: '#2563EB',
    vars: palette('#2563EB', '#1D4ED8', '#E5EDFD', '#3B82F6', '#2563EB', '#2563EB', '#1E40AF') },
  { cle: 'violet', nom: 'Violet', apercu: '#7C3AED',
    vars: palette('#7C3AED', '#6D28D9', '#EDE7FB', '#8B5CF6', '#7C3AED', '#7C3AED', '#5B21B6') },
  { cle: 'ambre',  nom: 'Ambre',  apercu: '#D97706',
    vars: palette('#D97706', '#B45309', '#FCEFD6', '#F59E0B', '#D97706', '#D97706', '#92400E') },
];

const STORAGE_KEY = 'transport-theme';

/** Thème par défaut : bleu (largement répandu / neutre professionnel). */
export const THEME_DEFAUT = 'bleu';

export function themeActuel(): string {
  return localStorage.getItem(STORAGE_KEY) || THEME_DEFAUT;
}

/** Applique un thème (variables CSS sur :root) et le persiste. */
export function appliquerTheme(cle: string): void {
  const t = THEMES.find(x => x.cle === cle) || THEMES.find(x => x.cle === THEME_DEFAUT) || THEMES[0];
  const root = document.documentElement.style;
  Object.entries(t.vars).forEach(([k, v]) => root.setProperty(k, v));
  localStorage.setItem(STORAGE_KEY, t.cle);
}
