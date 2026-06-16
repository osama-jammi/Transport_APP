import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { MatierePremiereService } from '../services/matiere-premiere.service';
import { CommandeMp, MatierePremiere } from '../core/models';

@Component({
  selector: 'app-matieres-premieres',
  template: `
    <div class="toolbar">
      <span class="badge badge-blue"><i class="fa-solid fa-database"></i> Matières premières (Divalto, lecture seule)</span>
      <div class="search"><i class="fa-solid fa-magnifying-glass"></i>
        <input [(ngModel)]="q" placeholder="Rechercher une commande (n°, affaire, fournisseur)…"></div>
      <button class="btn btn-outline right" (click)="chargerCommandes()" [disabled]="loadingCmd">
        <i class="fa-solid fa-rotate"></i> Actualiser</button>
    </div>

    <div class="chart-grid" style="grid-template-columns:1fr 2fr">
      <!-- Étape 1 : commandes -->
      <div class="card"><div class="card-head"><h2>Commandes</h2></div>
        <div class="card-body" style="padding:0">
          <div *ngIf="loadingCmd" class="spinner"></div>
          <div *ngIf="!loadingCmd && commandesFiltrees().length===0" class="empty" style="padding:20px">
            <i class="fa-solid fa-file-invoice"></i> Aucune commande</div>
          <div class="table-wrap" *ngIf="!loadingCmd && commandesFiltrees().length">
            <table>
              <thead><tr><th>N°</th><th>Affaire</th><th>Fournisseur</th></tr></thead>
              <tbody>
                <tr *ngFor="let c of commandesFiltrees()" class="row-link"
                    [class.checked]="c.cdno===selected?.cdno" (click)="choisir(c)">
                  <td><code>{{ c.cdno }}</code></td>
                  <td>{{ c.projet || c.marche || '—' }}</td>
                  <td>{{ c.tiers || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Étape 2 : lignes de la commande sélectionnée -->
      <div class="card">
        <div class="card-head"><h2>{{ selected ? 'Lignes de la commande #' + selected.cdno : 'Sélectionnez une commande' }}</h2></div>
        <div class="card-body" style="padding:0">
          <div *ngIf="loadingLignes" class="spinner"></div>
          <div *ngIf="!loadingLignes && selected && lignes.length===0" class="empty" style="padding:20px">
            <i class="fa-solid fa-boxes-stacked"></i> Aucune ligne</div>
          <div *ngIf="!selected" class="empty" style="padding:30px">
            <i class="fa-solid fa-arrow-left"></i> Choisissez une commande à gauche</div>
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
      </div>
    </div>
  `
})
export class MatieresPremieresComponent implements OnInit {
  commandes: CommandeMp[] = [];
  loadingCmd = false;
  q = '';
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
    const t = this.q.toLowerCase().trim();
    if (!t) return this.commandes;
    return this.commandes.filter(c =>
      `${c.cdno} ${c.projet || ''} ${c.marche || ''} ${c.tiers || ''}`.toLowerCase().includes(t));
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
}
