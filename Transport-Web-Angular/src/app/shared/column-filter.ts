/** Filtres par colonne : clé de colonne → texte saisi. */
export type ColumnFilters = Record<string, string>;

/**
 * Vrai si l'élément satisfait TOUS les filtres de colonnes non vides
 * (style PortailRH : un filtre « contient » par colonne, combinés en ET).
 */
export function matchesFilters<T>(item: T, filters: ColumnFilters): boolean {
  for (const key in filters) {
    const needle = (filters[key] || '').toLowerCase().trim();
    if (!needle) continue;
    const val = (item as Record<string, unknown>)?.[key];
    if (val == null || !String(val).toLowerCase().includes(needle)) return false;
  }
  return true;
}
