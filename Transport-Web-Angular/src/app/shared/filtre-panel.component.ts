import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ColumnFilters } from './column-filter';

/** Définition d'un champ du panneau de filtre. */
export interface FiltreField {
  key: string;
  label: string;
  icon?: string;          // classe Font Awesome (ex. 'fa-id-card')
  placeholder?: string;
  type?: 'text' | 'select';
  options?: { value: any; label: string }[];
}

/**
 * Panneau de filtre dépliable (style « recherche avancée ») — partagé par toutes
 * les tables. S'affiche sous la barre d'outils quand on active les filtres :
 *
 *   <app-filtre-panel *ngIf="filtresUI" [fields]="filterFields" [filters]="colF"
 *                     (change)="page=1"></app-filtre-panel>
 *
 * Filtrage « contient » en temps réel (mute filters[key] en place, comme avant).
 * Bouton « Réinitialiser » vide les champs ; « Rechercher » est cosmétique (le
 * filtrage est déjà live) mais émet (change) pour réinitialiser la pagination.
 */
@Component({
  selector: 'app-filtre-panel',
  template: `
    <div class="filtre-panel">
      <div class="fp-grid">
        <div class="fp-field" *ngFor="let f of fields">
          <label><i class="fa-solid {{ f.icon || 'fa-filter' }}"></i> {{ f.label }}</label>
          <select *ngIf="f.type === 'select'; else txt"
                  [ngModel]="filters[f.key] || ''" (ngModelChange)="set(f.key, $event)">
            <option value="">{{ f.placeholder || 'Tous' }}</option>
            <option *ngFor="let o of f.options" [ngValue]="o.value">{{ o.label }}</option>
          </select>
          <ng-template #txt>
            <input [ngModel]="filters[f.key] || ''" (ngModelChange)="set(f.key, $event)"
                   [placeholder]="f.placeholder || ''" autocomplete="off">
          </ng-template>
        </div>

        <div class="fp-actions">
          <button type="button" class="btn btn-outline" (click)="reinitialiser()" title="Réinitialiser les filtres">
            <i class="fa-solid fa-rotate"></i></button>
          <button type="button" class="btn btn-primary" (click)="change.emit()">
            <i class="fa-solid fa-magnifying-glass"></i> Rechercher</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .filtre-panel { background: #fff; border: 1px solid var(--border); border-radius: 16px;
      padding: 18px 20px; margin-bottom: 16px; box-shadow: var(--shadow-sm); animation: fpIn .2s ease; }
    @keyframes fpIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    .fp-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px 22px; align-items: end; }
    .fp-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
    .fp-field label { font-size: 13px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 8px; }
    .fp-field label i { color: var(--accent); font-size: 13px; }
    .fp-field input, .fp-field select { width: 100%; padding: 11px 14px; border: 1.5px solid var(--border);
      border-radius: 12px; font-size: 14px; color: var(--text); background: #fff; }
    .fp-field input::placeholder { color: var(--gray-light); }
    .fp-field input:focus, .fp-field select:focus { outline: none; border-color: var(--accent); box-shadow: var(--ring); }
    .fp-actions { display: flex; gap: 10px; align-items: center; justify-content: flex-end; }
    .fp-actions .btn-outline { flex: 0 0 auto; }
    @media (max-width: 1100px) { .fp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 640px) { .fp-grid { grid-template-columns: 1fr; } }
  `]
})
export class FiltrePanelComponent {
  @Input() fields: FiltreField[] = [];
  @Input() filters: ColumnFilters = {};
  @Output() change = new EventEmitter<void>();

  set(key: string, v: any): void {
    this.filters[key] = v;
    this.change.emit();
  }

  /** Vide tous les champs gérés par ce panneau (sans toucher aux autres clés). */
  reinitialiser(): void {
    for (const f of this.fields) delete this.filters[f.key];
    this.change.emit();
  }
}
