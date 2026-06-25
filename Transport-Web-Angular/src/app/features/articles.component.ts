import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { ArticleService } from '../services/article.service';
import { GapArticle } from '../core/models';
import { SortState } from '../shared/sort.pipe';
import { matchesSearch, matchesFilters, ColumnFilters } from '../shared/column-filter';
import { FiltreField } from '../shared/filtre-panel.component';

@Component({
  selector: 'app-articles',
  template: `
    <div class="toolbar">
      <span class="badge badge-blue"><i class="fa-solid fa-database"></i> Ordres de fabrication lus depuis la base GAP</span>
      <div class="search"><i class="fa-solid fa-magnifying-glass"></i>
        <input [(ngModel)]="q" (ngModelChange)="page=1" placeholder="Rechercher (désignation, n° prix, origine)…"></div>
      <button class="btn" [ngClass]="filtresUI ? 'btn-primary' : 'btn-outline'" (click)="basculerFiltres()"
              title="Filtrer par colonne">
        <i class="fa-solid fa-filter"></i> Filtres</button>
      <button class="btn btn-outline right" (click)="charger()" [disabled]="loading">
        <i class="fa-solid fa-rotate"></i> Actualiser depuis GAP</button>
    </div>

    <app-filtre-panel *ngIf="filtresUI" [fields]="filterFields" [filters]="colF" (change)="page=1"></app-filtre-panel>

    <div class="card"><div class="card-body" style="padding:0">
      <div *ngIf="loading" class="spinner"></div>
      <div *ngIf="!loading && filtres().length===0" class="empty">
        <i class="fa-solid fa-boxes-stacked"></i> Aucun ordre de fabrication dans la base GAP</div>
      <div class="table-wrap" *ngIf="!loading && filtres().length">
        <table>
          <thead>
            <tr>
            <th appSortable="id" [(state)]="sortState">ID</th>
            <th appSortable="designation" [(state)]="sortState">Désignation</th>
            <th appSortable="unite" [(state)]="sortState">Unité</th>
            <th appSortable="quantiteTot" [(state)]="sortState">Qté totale</th>
            <th appSortable="quantiteLivre" [(state)]="sortState">Qté livrée</th>
            <th appSortable="quantiteReste" [(state)]="sortState">Reste</th>
            <th appSortable="numPrix" [(state)]="sortState">N° prix</th>
            <th appSortable="origineArticle" [(state)]="sortState">Origine</th>
          </tr>
          </thead>
          <tbody>
            <tr *ngFor="let a of filtres() | sortBy:sortState | paginate:page:pageSize">
              <td><code>{{ a.id }}</code></td>
              <td><strong>{{ a.designation || '—' }}</strong></td>
              <td>{{ a.unite || '—' }}</td>
              <td>{{ a.quantiteTot ?? '—' }}</td>
              <td>{{ a.quantiteLivre ?? '—' }}</td>
              <td><span class="badge" [ngClass]="(a.quantiteReste ?? 0) > 0 ? 'badge-orange' : 'badge-green'">{{ a.quantiteReste ?? '—' }}</span></td>
              <td><code>{{ a.numPrix || '—' }}</code></td>
              <td>{{ a.origineArticle || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <app-paginator [total]="filtres().length" [page]="page" [pageSize]="pageSize"
                     (pageChange)="page = $event" (pageSizeChange)="pageSize = $event; page = 1"></app-paginator>
    </div></div>
  `
})
export class ArticlesComponent implements OnInit {
  articles: GapArticle[] = [];
  loading = false;
  page = 1; pageSize = 10;
  q = '';
  filtresUI = false;
  colF: ColumnFilters = {};
  filterFields: FiltreField[] = [
    { key: 'id', label: 'ID', icon: 'fa-hashtag', placeholder: 'ID' },
    { key: 'designation', label: 'Désignation', icon: 'fa-box', placeholder: 'Désignation' },
    { key: 'unite', label: 'Unité', icon: 'fa-ruler', placeholder: 'Unité' },
    { key: 'quantiteTot', label: 'Qté totale', icon: 'fa-layer-group', placeholder: 'Quantité' },
    { key: 'quantiteLivre', label: 'Qté livrée', icon: 'fa-truck-ramp-box', placeholder: 'Quantité' },
    { key: 'quantiteReste', label: 'Reste', icon: 'fa-boxes-stacked', placeholder: 'Reste' },
    { key: 'numPrix', label: 'N° prix', icon: 'fa-tag', placeholder: 'N° prix' },
    { key: 'origineArticle', label: 'Origine', icon: 'fa-industry', placeholder: 'Origine' },
  ];
  sortState: SortState = { key: '', dir: 'asc' };

  constructor(private svc: ArticleService, private toastr: ToastrService) {}

  ngOnInit(): void { this.charger(); }

  /** Charge les articles depuis la base GAP. */
  charger(): void {
    this.loading = true;
    this.svc.getFromGap().subscribe({
      next: d => { this.articles = d; this.loading = false; },
      error: () => { this.loading = false; this.toastr.error('Impossible de lire la base GAP.'); }
    });
  }

  filtres(): GapArticle[] {
    return this.articles.filter(a => matchesSearch(a, this.q) && matchesFilters(a, this.colF));
  }

  /** Affiche/masque la ligne de filtres par colonne (et réinitialise à la fermeture). */
  basculerFiltres(): void {
    this.filtresUI = !this.filtresUI;
    if (!this.filtresUI) { this.colF = {}; this.page = 1; }
  }
}
