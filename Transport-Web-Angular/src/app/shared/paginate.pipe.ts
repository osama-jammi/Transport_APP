import { Pipe, PipeTransform } from '@angular/core';

/** Renvoie la tranche correspondant à la page courante (pagination côté client). */
@Pipe({ name: 'paginate' })
export class PaginatePipe implements PipeTransform {
  transform<T>(items: T[] | null | undefined, page: number, pageSize: number): T[] {
    if (!items || items.length === 0) return [];
    const p = page && page > 0 ? page : 1;
    const start = (p - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }
}
