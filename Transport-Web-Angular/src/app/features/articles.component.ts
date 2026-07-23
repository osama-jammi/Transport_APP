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
    <div class="premium-articles">
      <div class="header">
        <h1><i class="fa-solid fa-boxes-stacked"></i> Ordres de Fabrication</h1>
        <p class="subtitle">Suivi des articles, quantités et origines.</p>
      </div>

      <div class="toolbar glass-panel">
        <div class="search-box">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input [(ngModel)]="q" (ngModelChange)="page=1" placeholder="Rechercher...">
        </div>
        <div class="actions">
          <button class="p-btn p-btn-light" [class.active]="filtresUI" (click)="basculerFiltres()" title="Filtrer par colonne">
            <i class="fa-solid fa-filter"></i> Filtres
          </button>
        </div>
      </div>

      <app-filtre-panel *ngIf="filtresUI" [fields]="filterFields" [filters]="colF" (change)="page=1"></app-filtre-panel>

      <div class="glass-card m-t">
        <div *ngIf="loading" class="spinner-modern"></div>
        <div *ngIf="!loading && filtres().length===0" class="empty">
          <i class="fa-solid fa-boxes-stacked"></i> Aucun ordre de fabrication dans la base GAP
        </div>
        
        <div class="modern-table" *ngIf="!loading && filtres().length">
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
                <td class="id-col">#{{ a.id }}</td>
                <td><strong>{{ a.designation || '—' }}</strong></td>
                <td><span class="p-badge light">{{ a.unite || '—' }}</span></td>
                <td>{{ a.quantiteTot ?? '—' }}</td>
                <td>{{ a.quantiteLivre ?? '—' }}</td>
                <td>
                  <span class="p-badge" [class.orange]="(a.quantiteReste ?? 0) > 0" [class.green]="(a.quantiteReste ?? 0) <= 0">
                    {{ a.quantiteReste ?? '—' }}
                  </span>
                </td>
                <td class="mono muted">{{ a.numPrix || '—' }}</td>
                <td><span class="p-badge blue"><i class="fa-solid fa-industry"></i> {{ a.origineArticle || '—' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <app-paginator [total]="filtres().length" [page]="page" [pageSize]="pageSize"
                       (pageChange)="page = $event" (pageSizeChange)="pageSize = $event; page = 1"></app-paginator>
      </div>
    </div>
  `,
  styles: [`
    .premium-articles {
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
    .modern-table table { width: 100%; border-collapse: separate; border-spacing: 0; }
    .modern-table th {
      text-align: left; padding: 12px 15px; color: #64748b; font-weight: 600; font-size: 0.85rem;
      text-transform: uppercase; border-bottom: 2px solid #f1f5f9;
    }
    .modern-table td { padding: 15px; color: #334155; font-weight: 500; font-size: 0.9rem; border-bottom: 1px solid #f1f5f9; }
    .modern-table tr:hover td { background: #f8fafc; }
    .id-col { color: #64748b; font-family: monospace; font-size: 0.95rem; }

    .p-badge {
      padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;
      background: #f1f5f9; color: #64748b; text-transform: uppercase; display: inline-flex; align-items: center; gap: 6px;
    }
    .p-badge.blue { background: #e0f2fe; color: #0284c7; }
    .p-badge.green { background: #dcfce7; color: #16a34a; }
    .p-badge.orange { background: #ffedd5; color: #ea580c; }
    .p-badge.light { background: #f8fafc; color: #94a3b8; border: 1px solid #e2e8f0; }

    .empty { padding: 40px; text-align: center; color: #94a3b8; font-style: italic; font-size: 1.1rem; }
    .muted { color: #94a3b8; }
    .mono { font-family: monospace; }
    
    .spinner-modern {
      width: 40px; height: 40px; margin: 40px auto; border: 3px solid #e0f2fe; border-radius: 50%;
      border-top-color: #0ea5e9; animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
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

  basculerFiltres(): void {
    this.filtresUI = !this.filtresUI;
    if (!this.filtresUI) { this.colF = {}; this.page = 1; }
  }
}
