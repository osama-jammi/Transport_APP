import { Pipe, PipeTransform } from '@angular/core';

/** État de tri partagé par une table (colonne + sens). */
export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

/**
 * Trie une liste selon {@link SortState} (tri côté client, comme PortailRH).
 * Null/vide toujours en dernier ; nombres comparés numériquement, sinon
 * comparaison de chaînes « naturelle » (fr, numeric). Pipe pur : l'état doit
 * être réaffecté (nouvel objet) pour déclencher un recalcul — c'est ce que fait
 * la directive {@link SortableDirective}.
 */
@Pipe({ name: 'sortBy' })
export class SortPipe implements PipeTransform {
  transform<T>(items: T[] | null | undefined, state?: SortState | null): T[] {
    if (!items) return [];
    if (!state || !state.key) return items;
    const { key, dir } = state;
    const factor = dir === 'desc' ? -1 : 1;
    return [...items].sort((a, b) => {
      const av = (a as Record<string, unknown>)?.[key];
      const bv = (b as Record<string, unknown>)?.[key];
      const aNil = av === null || av === undefined || av === '';
      const bNil = bv === null || bv === undefined || bv === '';
      if (aNil && bNil) return 0;
      if (aNil) return 1;          // vides toujours en dernier
      if (bNil) return -1;
      return factor * this.compare(av, bv);
    });
  }

  private compare(a: unknown, b: unknown): number {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b), 'fr', { numeric: true, sensitivity: 'base' });
  }
}
