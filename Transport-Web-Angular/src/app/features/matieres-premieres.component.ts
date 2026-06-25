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
    <div class="toolbar">
      <span class="badge badge-blue"><i class="fa-solid fa-database"></i> Commandes matières premières (Divalto, lecture seule)</span>
      <div class="search"><i class="fa-solid fa-magnifying-glass"></i>
        <input [(ngModel)]="q" (ngModelChange)="page=1" placeholder="Rechercher (n°, affaire, fournisseur, réf)…"></div>
      <button class="btn" [ngClass]="filtresUI ? 'btn-primary' : 'btn-outline'" (click)="basculerFiltres()"
              title="Filtrer par colonne">
        <i class="fa-solid fa-filter"></i> Filtres</button>
      <button class="btn btn-outline right" (click)="chargerCommandes()" [disabled]="loadingCmd">
        <i class="fa-solid fa-rotate"></i> Actualiser</button>
    </div>

    <app-filtre-panel *ngIf="filtresUI" [fields]="filterFields" [filters]="colF" (change)="page=1"></app-filtre-panel>

    <div class="card"><div class="card-body" style="padding:0">
      <div *ngIf="loadingCmd" class="spinner"></div>
      <div *ngIf="!loadingCmd && commandesFiltrees().length===0" class="empty">
        <i class="fa-solid fa-file-invoice"></i> Aucune commande</div>
      <div class="table-wrap" *ngIf="!loadingCmd && commandesFiltrees().length">
        <table>
          <thead>
            <tr>
            <th appSortable="cdno" [(state)]="sortState">N° pièce</th>
            <th appSortable="date" [(state)]="sortState">Date</th>
            <th appSortable="projet" [(state)]="sortState">Affaire</th>
            <th appSortable="tiers" [(state)]="sortState">Fournisseur</th>
            <th appSortable="reference" [(state)]="sortState">Pièce fournisseur</th>
            <th></th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let c of commandesFiltrees() | sortBy:sortState | paginate:page:pageSize" class="row-link" (click)="choisir(c)">
              <td><code>{{ c.cdno }}</code></td>
              <td>{{ c.date ? (c.date | date:'dd/MM/yy') : '—' }}</td>
              <td>{{ c.projet || c.marche || '—' }}</td>
              <td>{{ c.tiers || '—' }}</td>
              <td>{{ c.reference || '—' }}</td>
              <td><button class="btn btn-outline btn-sm" (click)="choisir(c); $event.stopPropagation()">
                <i class="fa-solid fa-eye"></i> Lignes</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <app-paginator [total]="commandesFiltrees().length" [page]="page" [pageSize]="pageSize"
                     (pageChange)="page = $event" (pageSizeChange)="pageSize = $event; page = 1"></app-paginator>
    </div></div>

    <!-- Modal des lignes de la commande -->
    <div class="modal-backdrop" *ngIf="selected" (click)="fermer($event)">
      <div class="modal" style="max-width:900px" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>Commande #{{ selected.cdno }} — {{ selected.projet || selected.marche || '' }}</h3>
          <button class="x" (click)="selected=null">&times;</button></div>
        <div class="m-body">
          <div class="detail-grid">
            <div><span class="dk">Fournisseur</span><span class="dv">{{ selected.tiers || '—' }}</span></div>
            <div><span class="dk">Pièce fournisseur</span><span class="dv">{{ selected.reference || '—' }}</span></div>
            <div><span class="dk">Date</span><span class="dv">{{ selected.date ? (selected.date | date:'dd/MM/yy') : '—' }}</span></div>
          </div>
          <div *ngIf="loadingLignes" class="spinner" style="margin:20px auto"></div>
          <div *ngIf="!loadingLignes && lignes.length===0" class="empty" style="padding:20px">
            <i class="fa-solid fa-boxes-stacked"></i> Aucune ligne</div>
          <div class="table-wrap" *ngIf="!loadingLignes && lignes.length">
            <table>
              <thead><tr><th>Référence</th><th>Désignation</th><th>Quantité</th><th>Unité</th></tr></thead>
              <tbody>
                <tr *ngFor="let m of lignes">
                  <td><code>{{ m.reference || '—' }}</code></td>
                  <td><strong>{{ m.designation || '—' }}</strong></td>
                  <td>{{ m.quantite ?? '—' }}</td>
                  <td>{{ m.unite || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="m-foot"><button class="btn btn-outline" (click)="selected=null">Fermer</button></div>
      </div>
    </div>
  `
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

  /** Affiche/masque la ligne de filtres par colonne (et réinitialise à la fermeture). */
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
