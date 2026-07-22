import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { MatierePremiereService } from '../services/matiere-premiere.service';
import { CommandeMp, MatierePremiere } from '../core/models';
import { SortState } from '../shared/sort.pipe';
import { matchesSearch, matchesFilters, ColumnFilters } from '../shared/column-filter';
import { FiltreField } from '../shared/filtre-panel.component';

@Component({
  selector: 'app-matieres-premieres',
  template: `
    <div class="premium-mp">
      <div class="header">
        <h1><i class="fa-solid fa-industry"></i> Matières Premières</h1>
        <p class="subtitle">Gestion des commandes et détails d'approvisionnement.</p>
      </div>

      <div class="toolbar glass-panel">
        <div class="search-box">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input [(ngModel)]="q" (ngModelChange)="page=1" placeholder="Rechercher (n°, affaire, fournisseur)...">
        </div>
        <div class="actions">
          <button class="p-btn p-btn-light" [class.active]="filtresUI" (click)="basculerFiltres()" title="Filtrer par colonne">
            <i class="fa-solid fa-filter"></i> Filtres
          </button>
        </div>
      </div>

      <app-filtre-panel *ngIf="filtresUI" [fields]="filterFields" [filters]="colF" (change)="page=1"></app-filtre-panel>

      <div class="glass-card m-t">
        <div *ngIf="loadingCmd" class="spinner-modern"></div>
        <div *ngIf="!loadingCmd && commandesFiltrees().length===0" class="empty">
          <i class="fa-solid fa-file-invoice"></i> Aucune commande trouvée
        </div>
        <div class="modern-table" *ngIf="!loadingCmd && commandesFiltrees().length">
          <table>
            <thead>
              <tr>
                <th appSortable="cdno" [(state)]="sortState">N° Pièce</th>
                <th appSortable="date" [(state)]="sortState">Date</th>
                <th appSortable="projet" [(state)]="sortState">Affaire / Projet</th>
                <th appSortable="tiers" [(state)]="sortState">Fournisseur</th>
                <th appSortable="reference" [(state)]="sortState">Réf. Fournisseur</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of commandesFiltrees() | sortBy:sortState | paginate:page:pageSize" class="row-link" (click)="choisir(c)">
                <td class="id-col"><i class="fa-solid fa-hashtag text-muted"></i> {{ c.cdno }}</td>
                <td>{{ c.date ? (c.date | date:'dd/MM/yy') : '—' }}</td>
                <td><strong>{{ c.projet || c.marche || '—' }}</strong></td>
                <td><span class="p-badge blue"><i class="fa-solid fa-truck-field"></i> {{ c.tiers || '—' }}</span></td>
                <td class="muted mono">{{ c.reference || '—' }}</td>
                <td class="action-cell">
                  <button class="p-btn p-btn-icon" (click)="choisir(c); $event.stopPropagation()">
                    <i class="fa-solid fa-chevron-right"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <app-paginator [total]="commandesFiltrees().length" [page]="page" [pageSize]="pageSize"
                       (pageChange)="page = $event" (pageSizeChange)="pageSize = $event; page = 1"></app-paginator>
      </div>
    </div>

    <!-- Modal des lignes de la commande -->
    <div class="modal-backdrop" *ngIf="selected" (click)="fermer($event)">
      <div class="modal p-modal" style="max-width:900px" (click)="$event.stopPropagation()">
        <div class="m-head">
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%">
            <div>
              <h3>Commande #{{ selected.cdno }}</h3>
              <div class="m-sub">{{ selected.projet || selected.marche || 'Aucune affaire' }}</div>
            </div>
            <button class="x" (click)="selected=null">&times;</button>
          </div>
        </div>
        
        <div class="m-body">
          <div class="detail-cards">
            <div class="d-card">
              <i class="fa-solid fa-truck-field d-icon"></i>
              <div class="d-content">
                <span class="dk">Fournisseur</span>
                <span class="dv">{{ selected.tiers || '—' }}</span>
              </div>
            </div>
            <div class="d-card">
              <i class="fa-solid fa-file-invoice d-icon"></i>
              <div class="d-content">
                <span class="dk">Pièce Fournisseur</span>
                <span class="dv">{{ selected.reference || '—' }}</span>
              </div>
            </div>
            <div class="d-card">
              <i class="fa-solid fa-calendar-day d-icon"></i>
              <div class="d-content">
                <span class="dk">Date de Commande</span>
                <span class="dv">{{ selected.date ? (selected.date | date:'dd/MM/yyyy') : '—' }}</span>
              </div>
            </div>
          </div>
          
          <h4 class="section-title">Lignes de la commande</h4>
          
          <div *ngIf="loadingLignes" class="spinner-modern"></div>
          <div *ngIf="!loadingLignes && lignes.length===0" class="empty p-4">
            <i class="fa-solid fa-boxes-stacked"></i> Aucune ligne trouvée
          </div>
          
          <div class="modern-table inner-table" *ngIf="!loadingLignes && lignes.length">
            <table>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Désignation</th>
                  <th>Quantité</th>
                  <th>Unité</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let m of lignes">
                  <td class="mono muted">{{ m.reference || '—' }}</td>
                  <td><strong>{{ m.designation || '—' }}</strong></td>
                  <td><span class="p-badge">{{ m.quantite ?? '—' }}</span></td>
                  <td><span class="p-badge light">{{ m.unite || '—' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="m-foot">
          <button class="p-btn p-btn-light" (click)="selected=null">Fermer</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .premium-mp {
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
    .p-btn-icon { padding: 6px; border-radius: 6px; background: transparent; color: #64748b; font-size: 1rem; }
    .p-btn-icon:hover { background: #f1f5f9; color: #0f172a; }

    /* Tables */
    .m-t { margin-top: 25px; }
    .modern-table table { width: 100%; border-collapse: separate; border-spacing: 0; }
    .modern-table th {
      text-align: left; padding: 12px 15px; color: #64748b; font-weight: 600; font-size: 0.85rem;
      text-transform: uppercase; border-bottom: 2px solid #f1f5f9;
    }
    .modern-table td { padding: 15px; color: #334155; font-weight: 500; font-size: 0.9rem; border-bottom: 1px solid #f1f5f9; }
    .modern-table tbody tr.row-link { cursor: pointer; transition: background 0.2s; }
    .modern-table tbody tr.row-link:hover { background: #f8fafc; transform: translateY(-1px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .id-col { font-family: monospace; font-size: 1.05rem; color: #0f172a; font-weight: 600; }
    .action-cell { text-align: right; white-space: nowrap; }

    .p-badge {
      padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;
      background: #f1f5f9; color: #475569; text-transform: uppercase; display: inline-flex; align-items: center; gap: 6px;
    }
    .p-badge.blue { background: #e0f2fe; color: #0284c7; }
    .p-badge.light { background: #f8fafc; color: #94a3b8; border: 1px solid #e2e8f0; }

    .empty { padding: 40px; text-align: center; color: #94a3b8; font-style: italic; font-size: 1.1rem; }
    .muted { color: #94a3b8; }
    .mono { font-family: monospace; }
    .text-muted { color: #cbd5e1; }
    .p-4 { padding: 2rem; }

    /* Modals */
    .p-modal { border: none; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.15); overflow: hidden; }
    .p-modal .m-head { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 20px 25px; }
    .p-modal .m-head h3 { color: #0f172a; font-weight: 700; font-size: 1.4rem; margin:0; }
    .p-modal .m-sub { color: #64748b; font-size: 0.95rem; margin-top: 4px; }
    .p-modal .m-body { padding: 25px; background: #fff; }
    .p-modal .m-foot { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 25px; display: flex; justify-content: flex-end; }
    
    .detail-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .d-card { display: flex; align-items: center; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #f1f5f9; }
    .d-icon { font-size: 1.5rem; color: #0ea5e9; background: #e0f2fe; width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; border-radius: 10px; }
    .d-content { display: flex; flex-direction: column; }
    .dk { font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
    .dv { font-size: 1rem; color: #0f172a; font-weight: 600; margin-top: 2px; }

    .section-title { font-size: 1.1rem; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 15px; }
    .inner-table { border: 1px solid #f1f5f9; border-radius: 10px; overflow: hidden; }
    .inner-table th { background: #f8fafc; }

    .spinner-modern {
      width: 40px; height: 40px; margin: 40px auto; border: 3px solid #e0f2fe; border-radius: 50%;
      border-top-color: #0ea5e9; animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class MatieresPremieresComponent implements OnInit {
  commandes: CommandeMp[] = [];
  loadingCmd = false;
  page = 1; pageSize = 10;
  q = '';
  filtresUI = false;
  colF: ColumnFilters = {};
  filterFields: FiltreField[] = [
    { key: 'cdno', label: 'N° pièce', icon: 'fa-hashtag', placeholder: 'N°' },
    { key: 'date', label: 'Date', icon: 'fa-calendar-day', placeholder: 'AAAA-MM-JJ' },
    { key: 'projet', label: 'Affaire', icon: 'fa-briefcase', placeholder: 'Affaire' },
    { key: 'tiers', label: 'Fournisseur', icon: 'fa-truck-field', placeholder: 'Fournisseur' },
    { key: 'reference', label: 'Pièce fournisseur', icon: 'fa-file-invoice', placeholder: 'Pièce' },
  ];
  sortState: SortState = { key: '', dir: 'asc' };
  selected: CommandeMp | null = null;
  lignes: MatierePremiere[] = [];
  loadingLignes = false;

  constructor(private svc: MatierePremiereService, private toastr: ToastrService) {}

  ngOnInit(): void { this.chargerCommandes(); }

  chargerCommandes(): void {
    this.loadingCmd = true;
    this.svc.getCommandes().subscribe({
      next: d => { this.commandes = d; this.loadingCmd = false; },
      error: () => { this.loadingCmd = false; this.toastr.error('Impossible de lire les commandes (Divalto).'); }
    });
  }

  commandesFiltrees(): CommandeMp[] {
    return this.commandes.filter(c => matchesSearch(c, this.q) && matchesFilters(c, this.colF));
  }

  basculerFiltres(): void {
    this.filtresUI = !this.filtresUI;
    if (!this.filtresUI) { this.colF = {}; this.page = 1; }
  }

  choisir(c: CommandeMp): void {
    this.selected = c;
    this.lignes = [];
    this.loadingLignes = true;
    this.svc.getLignes(c.cdno).subscribe({
      next: d => { this.lignes = d; this.loadingLignes = false; },
      error: () => { this.loadingLignes = false; this.toastr.error('Impossible de lire les lignes (Divalto).'); }
    });
  }

  fermer(e: Event): void { if (e.target === e.currentTarget) this.selected = null; }
}
