import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ColumnFilters } from './column-filter';

/**
 * Cellule d'en-tête « filtre par colonne » (style PortailRH).
 *
 * S'utilise sur un <th> d'une ligne de filtres dans le <thead> :
 *   <tr class="col-filter-row" *ngIf="filtresUI">
 *     <th appColFilter="nom" [filters]="colF" (filterChange)="page=1" placeholder="Nom"></th>
 *     <th></th>  <!-- colonne sans filtre (ex. actions) -->
 *   </tr>
 *
 * Met à jour filters[key] (recherche « contient ») et émet (filterChange) à chaque frappe
 * pour que le parent puisse réinitialiser la pagination.
 */
@Component({
  selector: 'th[appColFilter]',
  template: `
    <input class="cf-input" [ngModel]="filters[key] || ''" (ngModelChange)="set($event)"
           [placeholder]="placeholder || 'Filtrer…'" autocomplete="off"
           (click)="$event.stopPropagation()">
  `,
  styles: [`
    /* La ligne de filtres ne « colle » pas en haut (sinon elle chevauche l'en-tête sticky). */
    :host { position: static; top: auto; padding: 6px 8px !important;
      background: #fff; border-bottom: 1px solid var(--border); }
    .cf-input { width: 100%; min-width: 72px; padding: 6px 9px; border: 1.5px solid var(--border);
      border-radius: 7px; font-size: 12px; font-weight: 500; color: var(--text); background: #fff;
      text-transform: none; letter-spacing: 0; }
    .cf-input::placeholder { color: var(--gray-light); font-weight: 400; }
    .cf-input:focus { outline: none; border-color: var(--accent); box-shadow: var(--ring); }
  `]
})
export class ColFilterComponent {
  @Input('appColFilter') key = '';
  @Input() filters: ColumnFilters = {};
  @Input() placeholder = '';
  @Output() filterChange = new EventEmitter<void>();

  set(v: string): void {
    this.filters[this.key] = v;
    this.filterChange.emit();
  }
}
