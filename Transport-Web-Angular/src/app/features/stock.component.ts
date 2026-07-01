import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { StockService } from '../services/stock.service';
import { ArticleStock } from '../core/models';
import { SortState } from '../shared/sort.pipe';
import { matchesSearch, matchesFilters, ColumnFilters } from '../shared/column-filter';
import { FiltreField } from '../shared/filtre-panel.component';

@Component({
  selector: 'app-stock',
  template: `
    <div class="toolbar">
      <span class="badge badge-green"><i class="fa-solid fa-warehouse"></i> Stock</span>
      <div class="field" style="min-width:150px">
        <select [(ngModel)]="depot" (change)="chargerArticles()">
          <option [ngValue]="undefined" disabled>— Choisir un dépôt —</option>
          <option *ngFor="let d of depots" [ngValue]="d">{{ d }}</option>
        </select>
      </div>
      <div class="search"><i class="fa-solid fa-magnifying-glass"></i>
        <input [(ngModel)]="q" (ngModelChange)="page=1" placeholder="Rechercher un article (réf, désignation)…"></div>
      <button class="btn" [ngClass]="filtresUI ? 'btn-primary' : 'btn-outline'" (click)="basculerFiltres()"
              title="Filtrer par colonne">
        <i class="fa-solid fa-filter"></i> Filtres</button>
    </div>

    <app-filtre-panel *ngIf="filtresUI" [fields]="filterFields" [filters]="colF" (change)="page=1"></app-filtre-panel>

    <div class="card"><div class="card-body" style="padding:0">
      <div *ngIf="!depot" class="empty"><i class="fa-solid fa-warehouse"></i> Choisissez un dépôt pour afficher son stock</div>
      <div *ngIf="depot && loading" class="spinner"></div>
      <div *ngIf="depot && !loading && articlesFiltres().length===0" class="empty">
        <i class="fa-solid fa-boxes-stacked"></i> Aucun article en stock</div>
      <div class="table-wrap" *ngIf="depot && !loading && articlesFiltres().length">
        <div class="muted" style="padding:8px 12px;font-size:12px">
          Articles disponibles — {{ articlesFiltres().length }} article(s)</div>
        <table>
          <thead>
            <tr>
            <th appSortable="reference" [(state)]="sortState">Référence</th>
            <th appSortable="designation" [(state)]="sortState">Désignation</th>
            <th appSortable="unite" [(state)]="sortState">Unité</th>
            <th appSortable="stockDisponible" [(state)]="sortState">Stock disponible</th>
            <th appSortable="depot" [(state)]="sortState">Dépôt</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let a of articlesFiltres() | sortBy:sortState | paginate:page:pageSize">
              <td><code>{{ a.reference || '—' }}</code></td>
              <td><strong>{{ a.designation || '—' }}</strong></td>
              <td>{{ a.unite || '—' }}</td>
              <td>{{ a.stockDisponible ?? '—' }}</td>
              <td><span class="badge badge-green">{{ a.depot || '—' }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <app-paginator [total]="articlesFiltres().length" [page]="page" [pageSize]="pageSize"
                     (pageChange)="page = $event" (pageSizeChange)="pageSize = $event; page = 1"></app-paginator>
    </div></div>
  `
})
export class StockComponent implements OnInit {
  depots: string[] = [];
  depot?: string;
  articles: ArticleStock[] = [];
  loading = false;
  page = 1; pageSize = 10;
  q = '';
  filtresUI = false;
  colF: ColumnFilters = {};
  filterFields: FiltreField[] = [
    { key: 'reference', label: 'Référence', icon: 'fa-hashtag', placeholder: 'Réf' },
    { key: 'designation', label: 'Désignation', icon: 'fa-tag', placeholder: 'Désignation' },
    { key: 'unite', label: 'Unité', icon: 'fa-ruler', placeholder: 'Unité' },
    { key: 'depot', label: 'Dépôt', icon: 'fa-warehouse', placeholder: 'Dépôt' },
  ];
  sortState: SortState = { key: '', dir: 'asc' };

  constructor(private svc: StockService, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.svc.getDepots().subscribe({
      next: d => { this.depots = d; if (d.length && !this.depot) { this.depot = d[0]; this.chargerArticles(); } },
      error: () => this.toastr.error('Dépôts de stock indisponibles.')
    });
  }

  chargerArticles(): void {
    if (!this.depot) return;
    this.loading = true; this.page = 1;
    this.svc.getArticles(this.depot).subscribe({
      next: d => { this.articles = d; this.loading = false; },
      error: () => { this.loading = false; this.toastr.error('Stock indisponible.'); }
    });
  }

  articlesFiltres(): ArticleStock[] {
    return this.articles.filter(a => matchesSearch(a, this.q) && matchesFilters(a, this.colF));
  }

  /** Affiche/masque la ligne de filtres par colonne (et réinitialise à la fermeture). */
  basculerFiltres(): void {
    this.filtresUI = !this.filtresUI;
    if (!this.filtresUI) { this.colF = {}; this.page = 1; }
  }
}
