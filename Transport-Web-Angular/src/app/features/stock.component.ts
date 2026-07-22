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
    <div class="premium-stock">
      <div class="header">
        <h1><i class="fa-solid fa-boxes-stacked"></i> Stock</h1>
        <p class="subtitle">Gestion des articles disponibles par dépôt.</p>
      </div>

      <div class="toolbar glass-panel">
        <div class="field">
          <select [(ngModel)]="depot" (change)="chargerArticles()" class="p-select">
            <option [ngValue]="undefined" disabled>— Choisir un dépôt —</option>
            <option *ngFor="let d of depots" [ngValue]="d">{{ d }}</option>
          </select>
        </div>
        <div class="search-box">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input [(ngModel)]="q" (ngModelChange)="page=1" placeholder="Rechercher (réf, désignation)...">
        </div>
        <div class="actions">
          <button class="p-btn p-btn-light" [class.active]="filtresUI" (click)="basculerFiltres()" title="Filtrer par colonne">
            <i class="fa-solid fa-filter"></i> Filtres
          </button>
        </div>
      </div>

      <app-filtre-panel *ngIf="filtresUI" [fields]="filterFields" [filters]="colF" (change)="page=1"></app-filtre-panel>

      <div class="glass-card m-t">
        <div *ngIf="!depot" class="empty">
          <i class="fa-solid fa-warehouse"></i>
          <div>Veuillez sélectionner un dépôt pour afficher son stock.</div>
        </div>
        <div *ngIf="depot && loading" class="spinner-modern"></div>
        <div *ngIf="depot && !loading && articlesFiltres().length===0" class="empty">
          <i class="fa-solid fa-box-open"></i>
          <div>Aucun article en stock dans ce dépôt.</div>
        </div>
        
        <div class="modern-table" *ngIf="depot && !loading && articlesFiltres().length">
          <div class="table-header-info">
            Articles disponibles — <strong>{{ articlesFiltres().length }} article(s)</strong>
          </div>
          <table>
            <thead>
              <tr>
                <th appSortable="reference" [(state)]="sortState">Référence</th>
                <th appSortable="designation" [(state)]="sortState">Désignation</th>
                <th appSortable="unite" [(state)]="sortState">Unité</th>
                <th appSortable="stockDisponible" [(state)]="sortState">Stock disponible</th>
                <th appSortable="depot" [(state)]="sortState">Dépôt</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let a of articlesFiltres() | sortBy:sortState | paginate:page:pageSize">
                <td class="mono muted">{{ a.reference || '—' }}</td>
                <td><strong>{{ a.designation || '—' }}</strong></td>
                <td><span class="p-badge light">{{ a.unite || '—' }}</span></td>
                <td><span class="p-badge green">{{ a.stockDisponible ?? '—' }}</span></td>
                <td><span class="p-badge blue"><i class="fa-solid fa-warehouse"></i> {{ a.depot || '—' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <app-paginator *ngIf="depot && !loading && articlesFiltres().length" 
                       [total]="articlesFiltres().length" [page]="page" [pageSize]="pageSize"
                       (pageChange)="page = $event" (pageSizeChange)="pageSize = $event; page = 1"></app-paginator>
      </div>
    </div>
  `,
  styles: [`
    .premium-stock {
      font-family: 'Inter', 'Segoe UI', Roboto, sans-serif;
      color: #334155;
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .header { margin-bottom: 25px; }
    .header h1 {
      margin: 0; font-size: 2rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 12px;
    }
    .header h1 i { color: #0ea5e9; }
    .subtitle { color: #64748b; margin-top: 4px; font-size: 1.05rem; }

    /* Glass Panels */
    .glass-panel, .glass-card {
      background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border: 1px solid #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
      padding: 20px;
    }

    /* Toolbar */
    .toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 25px; padding: 15px 20px; }
    
    .p-select {
      appearance: none; background: #f8fafc url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2364748b"><path d="M7 10l5 5 5-5z"/></svg>') no-repeat right 10px center;
      background-size: 16px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 35px 10px 15px;
      font-size: 0.95rem; color: #0f172a; outline: none; cursor: pointer; min-width: 220px; transition: border-color 0.2s;
    }
    .p-select:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px #e0f2fe; }
    
    .search-box {
      display: flex; align-items: center; background: #f1f5f9; border-radius: 8px; padding: 0 15px; width: 320px; border: 1px solid transparent; transition: border 0.3s;
    }
    .search-box:focus-within { border-color: #bae6fd; background: #fff; box-shadow: 0 0 0 3px #e0f2fe; }
    .search-box i { color: #94a3b8; }
    .search-box input { border: none; background: transparent; padding: 10px; width: 100%; color: #0f172a; font-size: 0.95rem; outline: none; }
    .actions { display: flex; gap: 10px; }

    /* Buttons */
    .p-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 0.9rem;
      cursor: pointer; border: none; transition: all 0.2s ease; text-decoration: none;
    }
    .p-btn-light { background: #f1f5f9; color: #475569; }
    .p-btn-light:hover { background: #e2e8f0; }
    .p-btn-light.active { background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; }

    /* Tables */
    .m-t { margin-top: 25px; }
    .table-header-info { padding: 10px 15px; color: #64748b; font-size: 0.9rem; border-bottom: 2px solid #f1f5f9; }
    .modern-table table { width: 100%; border-collapse: separate; border-spacing: 0; }
    .modern-table th {
      text-align: left; padding: 12px 15px; color: #64748b; font-weight: 600; font-size: 0.85rem;
      text-transform: uppercase; border-bottom: 2px solid #f1f5f9;
    }
    .modern-table td { padding: 15px; color: #334155; font-weight: 500; font-size: 0.9rem; border-bottom: 1px solid #f1f5f9; }
    .modern-table tr:hover td { background: #f8fafc; }

    .p-badge {
      padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;
      background: #f1f5f9; color: #475569; text-transform: uppercase; display: inline-flex; align-items: center; gap: 6px;
    }
    .p-badge.blue { background: #e0f2fe; color: #0284c7; }
    .p-badge.green { background: #dcfce7; color: #16a34a; }
    .p-badge.light { background: #f8fafc; color: #94a3b8; border: 1px solid #e2e8f0; }

    .empty { padding: 40px; text-align: center; color: #94a3b8; font-size: 1.1rem; display:flex; flex-direction:column; align-items:center; gap: 15px; }
    .empty i { font-size: 3rem; color: #cbd5e1; }
    .muted { color: #94a3b8; }
    .mono { font-family: monospace; }
    
    .spinner-modern {
      width: 40px; height: 40px; margin: 40px auto; border: 3px solid #e0f2fe; border-radius: 50%;
      border-top-color: #0ea5e9; animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
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

  basculerFiltres(): void {
    this.filtresUI = !this.filtresUI;
    if (!this.filtresUI) { this.colF = {}; this.page = 1; }
  }
}
