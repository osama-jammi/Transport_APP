import { Directive, EventEmitter, HostBinding, HostListener, Input, Output } from '@angular/core';
import { SortState } from './sort.pipe';

/**
 * Rend un en-tête de colonne triable.
 * Usage : <th appSortable="designation" [(state)]="sortState">Désignation</th>
 * Clics successifs : asc → desc → aucun tri. Le caret est ajouté en CSS
 * (classes .sortable / .sort-asc / .sort-desc, cf. styles.css).
 */
@Directive({ selector: '[appSortable]' })
export class SortableDirective {
  @Input('appSortable') key = '';
  @Input() state: SortState | null = null;
  /** Émet un NOUVEL objet d'état (réaffectation) pour réveiller le pipe pur sortBy. */
  @Output() stateChange = new EventEmitter<SortState>();

  @HostBinding('class.sortable') readonly sortable = true;
  @HostBinding('class.sort-asc') get isAsc(): boolean {
    return this.state?.key === this.key && this.state?.dir === 'asc';
  }
  @HostBinding('class.sort-desc') get isDesc(): boolean {
    return this.state?.key === this.key && this.state?.dir === 'desc';
  }

  @HostListener('click')
  onClick(): void {
    let next: SortState;
    if (this.state?.key !== this.key) next = { key: this.key, dir: 'asc' };
    else if (this.state.dir === 'asc') next = { key: this.key, dir: 'desc' };
    else next = { key: '', dir: 'asc' };   // 3e clic : réinitialise le tri
    this.stateChange.emit(next);
  }
}
