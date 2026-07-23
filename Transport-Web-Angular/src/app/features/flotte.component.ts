import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ToastrService } from 'ngx-toastr';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ChauffeurService } from '../services/chauffeur.service';
import { CamionService } from '../services/camion.service';
import { SuperviseurService } from '../services/superviseur.service';
import { Chauffeur, ChauffeurRequest, Camion, Superviseur, SuperviseurRequest } from '../core/models';
import { imprimerQrChauffeur } from '../core/qr-print';
import { SortState } from '../shared/sort.pipe';
import { matchesFilters, ColumnFilters } from '../shared/column-filter';
import { FiltreField } from '../shared/filtre-panel.component';

interface FleetUnit { chauffeur: Chauffeur; camion?: Camion; }

@Component({
  selector: 'app-flotte',
  template: `
    <div class="premium-flotte">
      <div class="header">
        <h1><i class="fa-solid fa-truck-fleet"></i> Gestion de la Flotte</h1>
        <p class="subtitle">Vue d'ensemble des chauffeurs, camions et superviseurs.</p>
      </div>

      <div class="toolbar glass-panel">
        <div class="search-box">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input [(ngModel)]="q" (ngModelChange)="pageCam=1; pageUtil=1" placeholder="Rechercher (nom, immatriculation)...">
        </div>
        <div class="actions">
          <button class="p-btn p-btn-light" [class.active]="filtresUI" (click)="basculerFiltres()" title="Filtrer les tableaux">
            <i class="fa-solid fa-filter"></i> Filtres
          </button>
          <button class="p-btn p-btn-outline" (click)="ouvrirChauffeur()">
            <i class="fa-solid fa-user-plus"></i> Nouveau chauffeur
          </button>
          <button class="p-btn p-btn-primary" (click)="ouvrirCamion()">
            <i class="fa-solid fa-truck"></i> Nouveau camion
          </button>
        </div>
      </div>

      <!-- Cartes flotte -->
      <div *ngIf="loading" class="spinner-modern"></div>
      <div *ngIf="!loading && unites().length===0" class="glass-card empty">
        <i class="fa-solid fa-id-card"></i> Aucun chauffeur trouvé
      </div>

      <div class="fleet-grid" *ngIf="!loading">
        <div class="glass-card f-card" *ngFor="let u of unites()">
          <div class="f-top">
            <div class="f-avatar">{{ u.chauffeur.prenom?.charAt(0) }}{{ u.chauffeur.nom?.charAt(0) }}</div>
            <div class="f-info">
              <strong>{{ u.chauffeur.prenom }} {{ u.chauffeur.nom }}</strong>
              <span>Matricule: {{ u.chauffeur.matricule }}</span>
            </div>
            <div class="f-status" [class.active]="u.chauffeur.actif !== false"></div>
          </div>

          <div class="f-body">
            <div class="f-row"><i class="fa-solid fa-phone"></i> {{ u.chauffeur.telephone || '—' }}</div>
            <div class="f-row"><i class="fa-solid fa-clock"></i> {{ u.chauffeur.derniereConnexion ? (u.chauffeur.derniereConnexion | date:'dd/MM/yy HH:mm') : 'Jamais connecté' }}</div>
            
            <div class="f-truck" [class.empty]="!u.camion">
              <i class="fa-solid fa-truck"></i>
              <div *ngIf="u.camion" class="t-details">
                <strong>{{ u.camion.immatriculation }}</strong>
                <span>{{ u.camion.type || '—' }}<ng-container *ngIf="u.camion.marque"> · {{ u.camion.marque }}</ng-container></span>
              </div>
              <div *ngIf="!u.camion" class="t-details">
                <span class="muted">Aucun camion affecté</span>
              </div>
            </div>
          </div>

          <div class="f-actions">
            <button class="p-btn p-btn-icon" (click)="voirQr(u.chauffeur)" title="Voir QR"><i class="fa-solid fa-qrcode"></i></button>
            <button *ngIf="u.camion" class="p-btn p-btn-icon" (click)="ouvrirCamion(u.camion)" title="Éditer Camion"><i class="fa-solid fa-pen"></i></button>
            <button class="p-btn p-btn-icon" [class.danger]="u.chauffeur.actif !== false" (click)="basculerActifGap(u.chauffeur)" [title]="u.chauffeur.actif !== false ? 'Désactiver' : 'Activer'">
              <i class="fa-solid" [ngClass]="u.chauffeur.actif !== false ? 'fa-user-slash' : 'fa-user-check'"></i>
            </button>
          </div>
        </div>
      </div>

      <app-filtre-panel *ngIf="filtresUI && !loading" [fields]="filterFieldsCam" [filters]="colFCam" (change)="pageCam=1"></app-filtre-panel>

      <!-- Camions non affectés -->
      <div class="glass-card m-t" *ngIf="!loading && camionsLibres().length">
        <div class="card-title">Camions Disponibles ({{ camionsLibres().length }})</div>
        <div class="modern-table">
          <table>
            <thead>
              <tr>
                <th appSortable="id" [(state)]="sortCam">ID</th>
                <th appSortable="immatriculation" [(state)]="sortCam">Immatriculation</th>
                <th appSortable="type" [(state)]="sortCam">Type</th>
                <th appSortable="marque" [(state)]="sortCam">Marque</th>
                <th appSortable="etat" [(state)]="sortCam">État</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of camionsLibres() | sortBy:sortCam | paginate:pageCam:pageSize">
                <td class="id-col">#{{ c.id }}</td>
                <td><strong>{{ c.immatriculation }}</strong></td>
                <td>{{ c.type || '—' }}</td>
                <td>{{ c.marque || '—' }}</td>
                <td><span class="p-badge" [class.blue]="c.etat==='LIBRE'">{{ c.etat }}</span></td>
                <td class="action-cell">
                  <button class="p-btn p-btn-icon" (click)="ouvrirCamion(c)"><i class="fa-solid fa-pen"></i></button>
                  <button class="p-btn p-btn-icon danger" (click)="supprimerCamion(c)"><i class="fa-solid fa-trash"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <app-paginator [total]="camionsLibres().length" [page]="pageCam" [pageSize]="pageSize" (pageChange)="pageCam = $event" (pageSizeChange)="pageSize = $event; pageCam = 1; pageUtil = 1"></app-paginator>
      </div>

      <app-filtre-panel *ngIf="filtresUI && !loading" [fields]="filterFieldsUtil" [filters]="colFUtil" (change)="pageUtil=1"></app-filtre-panel>

      <!-- Superviseurs -->
      <div class="glass-card m-t" *ngIf="!loading">
        <div class="card-title split">
          <span>Comptes Superviseurs ({{ utilisateursFiltres().length }})</span>
          <button class="p-btn p-btn-sm p-btn-primary" (click)="ouvrirSuperviseur()"><i class="fa-solid fa-user-plus"></i> Nouveau</button>
        </div>
        
        <div class="modern-table" *ngIf="utilisateursFiltres().length">
          <table>
            <thead>
              <tr>
                <th appSortable="nom" [(state)]="sortUtil">Nom</th>
                <th appSortable="username" [(state)]="sortUtil">Identifiant</th>
                <th appSortable="role" [(state)]="sortUtil">Rôle</th>
                <th appSortable="actif" [(state)]="sortUtil">Statut</th>
                <th appSortable="derniereConnexion" [(state)]="sortUtil">Connexion</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let a of utilisateursFiltres() | sortBy:sortUtil | paginate:pageUtil:pageSize">
                <td><strong>{{ a.prenom }} {{ a.nom }}</strong></td>
                <td class="id-col">{{ a.username }}</td>
                <td><span class="p-badge role"><i class="fa-solid fa-shield"></i> {{ a.role || 'SUPERVISEUR' }}</span></td>
                <td><span class="p-badge" [class.blue]="a.actif !== false">{{ a.actif !== false ? 'Actif' : 'Inactif' }}</span></td>
                <td class="muted">{{ a.derniereConnexion ? (a.derniereConnexion | date:'dd/MM/yy HH:mm') : 'Jamais' }}</td>
                <td class="action-cell">
                  <button class="p-btn p-btn-icon" (click)="ouvrirSuperviseur(a)"><i class="fa-solid fa-pen"></i></button>
                  <button class="p-btn p-btn-icon" [class.danger]="a.actif !== false" (click)="basculerActifSuperviseur(a)"><i class="fa-solid" [ngClass]="a.actif !== false ? 'fa-user-slash' : 'fa-user-check'"></i></button>
                  <button class="p-btn p-btn-icon danger" (click)="supprimerSuperviseur(a)"><i class="fa-solid fa-trash"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div *ngIf="!utilisateursFiltres().length" class="empty m-t">
          Aucun compte superviseur trouvé.
        </div>
        <app-paginator *ngIf="utilisateursFiltres().length" [total]="utilisateursFiltres().length" [page]="pageUtil" [pageSize]="pageSize" (pageChange)="pageUtil = $event" (pageSizeChange)="pageSize = $event; pageCam = 1; pageUtil = 1"></app-paginator>
      </div>

    </div>

    <!-- Modals -->
    <!-- Modal chauffeur -->
    <div class="modal-backdrop" *ngIf="modalChauffeur" (click)="closeBackdrop($event,'chauffeur')">
      <div class="modal p-modal" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>{{ editChauffeurId ? "Modifier l'utilisateur" : 'Nouvel utilisateur' }}</h3>
          <button class="x" (click)="modalChauffeur=false">&times;</button></div>
        <div class="m-body"><div class="form-grid">
          <div class="field"><label>Nom *</label><input [(ngModel)]="formChauffeur.nom" class="p-input"></div>
          <div class="field"><label>Prénom *</label><input [(ngModel)]="formChauffeur.prenom" class="p-input"></div>
          <div class="field"><label>Matricule *</label><input [(ngModel)]="formChauffeur.matricule" class="p-input">
            <small class="muted" *ngIf="!formChauffeur.admin">Chauffeur : matricule numérique (enregistré dans GAP, visible dans la flotte).</small>
          </div>
          <div class="field"><label>Téléphone</label><input [(ngModel)]="formChauffeur.telephone" class="p-input"></div>
          <div class="field" style="grid-column:1/-1">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" [(ngModel)]="formChauffeur.admin" style="width:auto">
              <span><i class="fa-solid fa-shield"></i> Compte administrateur / superviseur</span>
            </label>
            <small class="muted">Accède au tableau de bord (suivi, voyages, dépôts, analyses) dans l'app mobile.</small>
          </div>
        </div></div>
        <div class="m-foot">
          <button class="p-btn p-btn-light" (click)="modalChauffeur=false">Annuler</button>
          <button class="p-btn p-btn-primary" (click)="enregistrerChauffeur()" [disabled]="saving">
            <i class="fa-solid fa-check"></i> Enregistrer</button>
        </div>
      </div>
    </div>

    <!-- Modal camion -->
    <div class="modal-backdrop" *ngIf="modalCamion" (click)="closeBackdrop($event,'camion')">
      <div class="modal p-modal" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>{{ editCamionId ? 'Modifier' : 'Nouveau' }} camion</h3>
          <button class="x" (click)="modalCamion=false">&times;</button></div>
        <div class="m-body"><div class="form-grid">
          <div class="field"><label>Immatriculation (marocaine) *</label>
            <div style="display:flex;align-items:center;gap:6px">
              <input class="p-input" style="flex:1;text-align:center" placeholder="12345" [(ngModel)]="immatGauche" inputmode="numeric">
              <span style="font-weight:700;color:#94a3b8">|</span>
              <input class="p-input" style="width:64px;text-align:center" placeholder="أ / a" [(ngModel)]="immatLettre">
              <span style="font-weight:700;color:#94a3b8">|</span>
              <input class="p-input" style="width:80px;text-align:center" placeholder="12" [(ngModel)]="immatDroite" inputmode="numeric">
            </div>
            <small class="muted">Format : numéro | lettre | numéro</small></div>
          <div class="field"><label>Type d'outil *</label>
            <select [(ngModel)]="formCamion.type" class="p-input">
              <option [ngValue]="undefined" disabled>— Choisir —</option>
              <option value="VOITURE">Voiture</option>
              <option value="CAMION">Camion</option>
              <option value="PICKUP">Pickup</option>
            </select></div>
          <div class="field"><label>Marque</label><input [(ngModel)]="formCamion.marque" class="p-input" placeholder="Ex : Renault"></div>
          <div class="field"><label>État</label>
            <input disabled class="p-input disabled" [value]="formCamion.chauffeurId ? 'OCCUPE (chauffeur affecté)' : 'LIBRE (aucun chauffeur)'">
            </div>
          <div class="field"><label>Chauffeur affecté</label>
            <select [(ngModel)]="formCamion.chauffeurId" class="p-input">
              <option [ngValue]="null">— Aucun —</option>
              <option *ngFor="let ch of chauffeurs" [ngValue]="ch.id">{{ ch.prenom }} {{ ch.nom }} ({{ ch.matricule }})</option>
            </select></div>
        </div></div>
        <div class="m-foot">
          <button class="p-btn p-btn-light" (click)="modalCamion=false">Annuler</button>
          <button class="p-btn p-btn-primary" (click)="enregistrerCamion()" [disabled]="saving">
            <i class="fa-solid fa-check"></i> Enregistrer</button>
        </div>
      </div>
    </div>

    <!-- Modal superviseur -->
    <div class="modal-backdrop" *ngIf="modalSuperviseur" (click)="closeBackdropSuperviseur($event)">
      <div class="modal p-modal" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>{{ editSuperviseurId ? 'Modifier le superviseur' : 'Nouveau superviseur' }}</h3>
          <button class="x" (click)="modalSuperviseur=false">&times;</button></div>
        <div class="m-body"><div class="form-grid">
          <div class="field"><label>Identifiant *</label>
            <input class="p-input" [(ngModel)]="formSuperviseur.username" [disabled]="!!editSuperviseurId" autocomplete="off">
            <small class="muted" *ngIf="editSuperviseurId">L'identifiant ne peut pas être modifié.</small>
          </div>
          <div class="field"><label>{{ editSuperviseurId ? 'Nouveau mot de passe' : 'Mot de passe *' }}</label>
            <input class="p-input" type="password" [(ngModel)]="formSuperviseur.password" autocomplete="new-password"
                   [placeholder]="editSuperviseurId ? 'Laisser vide = inchangé' : ''">
          </div>
          <div class="field"><label>Prénom</label><input class="p-input" [(ngModel)]="formSuperviseur.prenom"></div>
          <div class="field"><label>Nom</label><input class="p-input" [(ngModel)]="formSuperviseur.nom"></div>
          <div class="field" style="grid-column:1/-1">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" [(ngModel)]="formSuperviseur.actif" style="width:auto">
              <span><i class="fa-solid fa-shield"></i> Compte actif</span>
            </label>
          </div>
        </div></div>
        <div class="m-foot">
          <button class="p-btn p-btn-light" (click)="modalSuperviseur=false">Annuler</button>
          <button class="p-btn p-btn-primary" (click)="enregistrerSuperviseur()" [disabled]="saving">
            <i class="fa-solid fa-check"></i> Enregistrer</button>
        </div>
      </div>
    </div>

    <!-- Modal QR -->
    <div class="modal-backdrop" *ngIf="qrModal" (click)="qrModal=false">
      <div class="modal p-modal" style="max-width:360px;text-align:center" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>QR code chauffeur</h3><button class="x" (click)="qrModal=false">&times;</button></div>
        <div class="m-body">
          <img *ngIf="qrUrl" [src]="qrUrl" alt="QR" style="width:240px;height:240px; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.1)">
          <div *ngIf="!qrUrl" class="spinner-modern"></div>
          <div *ngIf="qrChauffeur" style="font-weight:700;font-size:16px;margin-top:12px;color:#0f172a">
            {{ qrChauffeur.prenom }} {{ qrChauffeur.nom }}</div>
        </div>
        <div class="m-foot">
          <button class="p-btn p-btn-light" (click)="qrModal=false">Fermer</button>
          <button class="p-btn p-btn-primary" (click)="qrChauffeur && imprimerQr(qrChauffeur)" [disabled]="!qrUrl">
            <i class="fa-solid fa-print"></i> Imprimer</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .premium-flotte {
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
    .header h1 i { color: #0284c7; }
    .subtitle { color: #64748b; margin-top: 4px; font-size: 1.05rem; }

    /* Glass Panels */
    .glass-panel, .glass-card {
      background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border: 1px solid #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
      padding: 20px; transition: transform 0.2s, box-shadow 0.2s;
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
    .p-btn-sm { padding: 6px 12px; font-size: 0.85rem; }
    .p-btn-primary { background: #0ea5e9; color: #fff; box-shadow: 0 2px 10px rgba(14,165,233,0.3); }
    .p-btn-primary:hover { background: #0284c7; box-shadow: 0 4px 15px rgba(14,165,233,0.4); }
    .p-btn-primary[disabled] { opacity: 0.5; pointer-events: none; }
    .p-btn-outline { background: #f8fafc; color: #0ea5e9; border: 1px solid #bae6fd; }
    .p-btn-outline:hover { background: #f0f9ff; }
    .p-btn-light { background: #f1f5f9; color: #475569; }
    .p-btn-light:hover { background: #e2e8f0; }
    .p-btn-light.active { background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; }

    .p-btn-icon { padding: 6px; border-radius: 6px; background: transparent; color: #64748b; font-size: 1rem; }
    .p-btn-icon:hover { background: #f1f5f9; color: #0f172a; }
    .p-btn-icon.danger:hover { background: #fee2e2; color: #ef4444; }

    /* Grid */
    .fleet-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
    .f-card { display: flex; flex-direction: column; padding: 20px; position: relative; }
    .f-card:hover { transform: translateY(-3px); box-shadow: 0 10px 25px rgba(0,0,0,0.06); }
    
    .f-top { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; }
    .f-avatar {
      width: 50px; height: 50px; background: #e0f2fe; color: #0284c7; font-weight: 700;
      font-size: 1.2rem; display: flex; align-items: center; justify-content: center; border-radius: 12px;
    }
    .f-info strong { display: block; color: #0f172a; font-size: 1.1rem; }
    .f-info span { color: #64748b; font-size: 0.85rem; font-family: monospace; }
    .f-status {
      position: absolute; top: 20px; right: 20px; width: 10px; height: 10px; border-radius: 50%;
      background: #cbd5e1; box-shadow: 0 0 0 3px rgba(203,213,225,0.3);
    }
    .f-status.active { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.3); }

    .f-body { flex: 1; border-top: 1px solid #f1f5f9; padding-top: 15px; margin-bottom: 15px; }
    .f-row { font-size: 0.9rem; color: #475569; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
    .f-row i { color: #94a3b8; width: 16px; text-align: center; }
    
    .f-truck {
      margin-top: 15px; background: #f8fafc; padding: 12px; border-radius: 8px; display: flex; gap: 12px; align-items: center;
    }
    .f-truck.empty { background: transparent; border: 1px dashed #cbd5e1; }
    .f-truck i { color: #64748b; font-size: 1.2rem; }
    .t-details strong { display: block; color: #0f172a; font-size: 0.95rem; }
    .t-details span { color: #64748b; font-size: 0.8rem; }

    .f-actions { display: flex; gap: 8px; border-top: 1px solid #f1f5f9; padding-top: 15px; justify-content: flex-end; }

    /* Tables */
    .m-t { margin-top: 25px; }
    .card-title { font-size: 1.2rem; font-weight: 700; color: #0f172a; margin-bottom: 15px; }
    .card-title.split { display: flex; justify-content: space-between; align-items: center; }

    .modern-table table { width: 100%; border-collapse: separate; border-spacing: 0; }
    .modern-table th {
      text-align: left; padding: 12px 15px; color: #64748b; font-weight: 600; font-size: 0.85rem;
      text-transform: uppercase; border-bottom: 2px solid #f1f5f9;
    }
    .modern-table td { padding: 15px; color: #334155; font-weight: 500; font-size: 0.9rem; border-bottom: 1px solid #f1f5f9; }
    .modern-table tr:hover td { background: #f8fafc; }
    .id-col { color: #64748b; font-family: monospace; font-size: 0.95rem; }
    .action-cell { text-align: right; white-space: nowrap; }

    .p-badge {
      padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;
      background: #f1f5f9; color: #64748b; text-transform: uppercase;
    }
    .p-badge.blue { background: #e0f2fe; color: #0284c7; }
    .p-badge.role { background: #fef3c7; color: #d97706; }

    .empty { padding: 40px; text-align: center; color: #94a3b8; font-style: italic; }
    .muted { color: #94a3b8; }

    /* Modals */
    .p-modal { border: none; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.15); overflow: hidden; }
    .p-modal .m-head { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 20px; }
    .p-modal .m-head h3 { color: #0f172a; font-weight: 700; font-size: 1.2rem; margin:0; }
    .p-modal .m-body { padding: 25px; }
    .p-modal .m-foot { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; display: flex; justify-content: flex-end; gap: 10px; }
    
    .p-input {
      width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px;
      font-size: 0.95rem; color: #0f172a; transition: all 0.2s; background: #fff;
    }
    .p-input:focus { outline: none; border-color: #0ea5e9; box-shadow: 0 0 0 3px #e0f2fe; }
    .p-input.disabled { background: #f1f5f9; color: #64748b; }
    
    .spinner-modern {
      width: 40px; height: 40px; margin: 40px auto;
      border: 3px solid #e0f2fe; border-radius: 50%; border-top-color: #0ea5e9;
      animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class FlotteComponent implements OnInit {
  chauffeurs: Chauffeur[] = [];
  utilisateurs: Superviseur[] = [];
  camions: Camion[] = [];
  loading = true; saving = false;
  pageUtil = 1; pageCam = 1; pageSize = 10;
  q = '';
  filtresUI = false;
  colFCam: ColumnFilters = {};
  colFUtil: ColumnFilters = {};
  filterFieldsCam: FiltreField[] = [
    { key: 'id', label: 'ID', icon: 'fa-hashtag', placeholder: 'ID' },
    { key: 'immatriculation', label: 'Immatriculation', icon: 'fa-truck', placeholder: 'Immatriculation' },
    { key: 'type', label: 'Type', icon: 'fa-truck-moving', placeholder: 'Type' },
    { key: 'marque', label: 'Marque', icon: 'fa-tag', placeholder: 'Marque' },
    { key: 'etat', label: 'État', icon: 'fa-flag', placeholder: 'État' },
  ];
  filterFieldsUtil: FiltreField[] = [
    { key: 'nom', label: 'Nom', icon: 'fa-user', placeholder: 'Nom ou prénom' },
    { key: 'username', label: 'Identifiant', icon: 'fa-at', placeholder: 'Identifiant' },
  ];
  sortCam: SortState = { key: '', dir: 'asc' };
  sortUtil: SortState = { key: '', dir: 'asc' };

  modalChauffeur = false; editChauffeurId: number | null = null;
  formChauffeur: ChauffeurRequest = { nom: '', prenom: '', matricule: '', telephone: '', admin: false };

  modalCamion = false; editCamionId: number | null = null;
  formCamion: Partial<Camion> = { immatriculation: '', etat: 'LIBRE' };
  immatGauche = ''; immatLettre = ''; immatDroite = '';

  qrModal = false; qrUrl: SafeUrl | null = null; qrChauffeur: Chauffeur | null = null;

  modalSuperviseur = false; editSuperviseurId: number | null = null;
  formSuperviseur: SuperviseurRequest = { username: '', password: '', nom: '', prenom: '', actif: true };

  constructor(
    private chauffeurSvc: ChauffeurService,
    private camionSvc: CamionService,
    private superviseurSvc: SuperviseurService,
    private toastr: ToastrService,
    private san: DomSanitizer
  ) {}

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading = true;
    forkJoin({
      chauffeurs: this.chauffeurSvc.getFromGap().pipe(
        map(list => list.map(g => ({
          id: g.id,
          nom: g.nom ?? '',
          prenom: g.prenom ?? '',
          matricule: g.matricule != null ? String(g.matricule) : '',
          derniereConnexion: g.derniereConnexion,
          actif: g.actif !== false
        } as Chauffeur))),
        catchError(() => of([] as Chauffeur[]))
      ),
      camions:    this.camionSvc.getAll().pipe(catchError(() => of([] as Camion[]))),
      utilisateurs: this.superviseurSvc.lister().pipe(
        catchError(() => of([] as Superviseur[]))
      )
    }).subscribe(({ chauffeurs, camions, utilisateurs }) => {
      this.chauffeurs = chauffeurs;
      this.camions = camions;
      this.utilisateurs = utilisateurs;
      this.loading = false;
    });
  }

  camionDe(chauffeurId: number): Camion | undefined {
    return this.camions.find(c => c.chauffeurId === chauffeurId);
  }

  unites(): FleetUnit[] {
    const t = this.q.toLowerCase().trim();
    return this.chauffeurs
      .map(ch => ({ chauffeur: ch, camion: this.camionDe(ch.id) }))
      .filter(u => !t ||
        `${u.chauffeur.nom} ${u.chauffeur.prenom} ${u.chauffeur.matricule} ${u.camion?.immatriculation || ''}`
          .toLowerCase().includes(t));
  }

  camionsLibres(): Camion[] {
    const t = this.q.toLowerCase().trim();
    return this.camions
      .filter(c => !c.chauffeurId)
      .filter(c => !t || `${c.immatriculation} ${c.device}`.toLowerCase().includes(t))
      .filter(c => matchesFilters(c, this.colFCam));
  }

  utilisateursFiltres(): Superviseur[] {
    const t = this.q.toLowerCase().trim();
    return this.utilisateurs
      .filter(u => !t || `${u.nom} ${u.prenom} ${u.username}`.toLowerCase().includes(t))
      .filter(u => matchesFilters(u, this.colFUtil));
  }

  basculerFiltres(): void {
    this.filtresUI = !this.filtresUI;
    if (!this.filtresUI) { this.colFCam = {}; this.colFUtil = {}; this.pageCam = 1; this.pageUtil = 1; }
  }

  closeBackdrop(e: Event, which: 'chauffeur' | 'camion'): void {
    if (e.target !== e.currentTarget) return;
    if (which === 'chauffeur') this.modalChauffeur = false; else this.modalCamion = false;
  }

  /* ───── Chauffeur CRUD ───── */
  ouvrirChauffeur(c?: Chauffeur): void {
    if (c) { this.editChauffeurId = c.id; this.formChauffeur = { nom: c.nom, prenom: c.prenom, matricule: c.matricule, telephone: c.telephone, admin: c.admin ?? false }; }
    else { this.editChauffeurId = null; this.formChauffeur = { nom: '', prenom: '', matricule: '', telephone: '', admin: false }; }
    this.modalChauffeur = true;
  }
  enregistrerChauffeur(): void {
    if (!this.formChauffeur.nom || !this.formChauffeur.prenom || !this.formChauffeur.matricule) {
      this.toastr.warning('Nom, prénom et matricule obligatoires.'); return;
    }
    this.saving = true;
    const obs = this.editChauffeurId
      ? this.chauffeurSvc.update(this.editChauffeurId, this.formChauffeur)
      : this.chauffeurSvc.create(this.formChauffeur);
    obs.subscribe({
      next: () => { this.toastr.success('Enregistré.'); this.modalChauffeur = false; this.saving = false; this.charger(); },
      error: (err: any) => { this.toastr.error(err?.error?.message || 'Échec enregistrement.'); this.saving = false; }
    });
  }
  basculerActifGap(c: Chauffeur): void {
    const actif = c.actif === false;
    const verbe = actif ? 'Activer' : 'Désactiver';
    if (!confirm(`${verbe} l'accès de ${c.prenom} ${c.nom} à l'application ?`)) return;
    this.chauffeurSvc.setActifGap(c.id, actif).subscribe({
      next: () => { c.actif = actif; this.toastr.success(actif ? 'Chauffeur activé.' : 'Chauffeur désactivé.'); },
      error: () => this.toastr.error('Échec de la mise à jour.')
    });
  }
  basculerActifLocal(c: Chauffeur): void {
    const actif = c.actif === false;
    const verbe = actif ? 'Activer' : 'Désactiver';
    if (!confirm(`${verbe} le compte de ${c.prenom} ${c.nom} ?`)) return;
    this.chauffeurSvc.setActif(c.id, actif).subscribe({
      next: () => { c.actif = actif; this.toastr.success(actif ? 'Compte activé.' : 'Compte désactivé.'); },
      error: () => this.toastr.error('Échec de la mise à jour.')
    });
  }

  supprimerChauffeur(c: Chauffeur): void {
    if (!confirm(`Supprimer ${c.nom} ${c.prenom} ?`)) return;
    this.chauffeurSvc.delete(c.id).subscribe({
      next: () => { this.toastr.success('Chauffeur supprimé.'); this.charger(); },
      error: () => this.toastr.error('Échec suppression.')
    });
  }

  /* ───── Superviseurs ───── */
  closeBackdropSuperviseur(e: Event): void {
    if (e.target === e.currentTarget) this.modalSuperviseur = false;
  }
  ouvrirSuperviseur(s?: Superviseur): void {
    if (s) {
      this.editSuperviseurId = s.id;
      this.formSuperviseur = { username: s.username, password: '', nom: s.nom, prenom: s.prenom, actif: s.actif !== false };
    } else {
      this.editSuperviseurId = null;
      this.formSuperviseur = { username: '', password: '', nom: '', prenom: '', actif: true };
    }
    this.modalSuperviseur = true;
  }
  enregistrerSuperviseur(): void {
    if (!this.formSuperviseur.username?.trim()) { this.toastr.warning('Identifiant obligatoire.'); return; }
    if (!this.editSuperviseurId && !this.formSuperviseur.password?.trim()) {
      this.toastr.warning('Mot de passe obligatoire à la création.'); return;
    }
    this.saving = true;
    const obs = this.editSuperviseurId
      ? this.superviseurSvc.modifier(this.editSuperviseurId, this.formSuperviseur)
      : this.superviseurSvc.creer(this.formSuperviseur);
    obs.subscribe({
      next: () => { this.toastr.success('Compte enregistré.'); this.modalSuperviseur = false; this.saving = false; this.charger(); },
      error: (err: any) => { this.toastr.error(err?.error?.message || 'Échec enregistrement.'); this.saving = false; }
    });
  }
  basculerActifSuperviseur(s: Superviseur): void {
    const actif = s.actif === false;
    const verbe = actif ? 'Activer' : 'Désactiver';
    if (!confirm(`${verbe} le compte ${s.username} ?`)) return;
    this.superviseurSvc.modifier(s.id, { username: s.username, actif }).subscribe({
      next: () => { s.actif = actif; this.toastr.success(actif ? 'Compte activé.' : 'Compte désactivé.'); },
      error: () => this.toastr.error('Échec de la mise à jour.')
    });
  }
  supprimerSuperviseur(s: Superviseur): void {
    if (!confirm(`Supprimer le compte ${s.username} ?`)) return;
    this.superviseurSvc.supprimer(s.id).subscribe({
      next: () => { this.toastr.success('Compte supprimé.'); this.charger(); },
      error: () => this.toastr.error('Échec suppression.')
    });
  }

  /* ───── Camion CRUD ───── */
  ouvrirCamion(c?: Camion): void {
    if (c) {
      this.editCamionId = c.id;
      this.formCamion = { immatriculation: c.immatriculation, type: c.type, marque: c.marque, etat: c.etat, chauffeurId: c.chauffeurId ?? null };
      const parts = (c.immatriculation || '').split('-');
      this.immatGauche = parts[0] || ''; this.immatLettre = parts[1] || ''; this.immatDroite = parts[2] || '';
    } else {
      this.editCamionId = null;
      this.formCamion = { immatriculation: '', etat: 'LIBRE', chauffeurId: null };
      this.immatGauche = ''; this.immatLettre = ''; this.immatDroite = '';
    }
    this.modalCamion = true;
  }
  enregistrerCamion(): void {
    this.formCamion.immatriculation = [this.immatGauche, this.immatLettre, this.immatDroite]
      .map(s => (s || '').trim()).join('-');
    if (!this.immatGauche || !this.immatLettre || !this.immatDroite) {
      this.toastr.warning('Renseignez les 3 champs de l\'immatriculation.'); return;
    }
    if (!this.formCamion.type) { this.toastr.warning('Choisissez le type d\'outil.'); return; }
    const ch = this.chauffeurs.find(c => c.id === this.formCamion.chauffeurId);
    this.formCamion.chauffeurNom = ch ? `${ch.prenom} ${ch.nom}` : undefined;
    this.saving = true;
    const obs = this.editCamionId
      ? this.camionSvc.update(this.editCamionId, this.formCamion)
      : this.camionSvc.create(this.formCamion);
    obs.subscribe({
      next: () => { this.toastr.success('Camion enregistré.'); this.modalCamion = false; this.saving = false; this.charger(); },
      error: () => { this.toastr.error('Échec enregistrement.'); this.saving = false; }
    });
  }
  supprimerCamion(c: Camion): void {
    if (!confirm(`Supprimer ${c.immatriculation} ?`)) return;
    this.camionSvc.delete(c.id).subscribe({
      next: () => { this.toastr.success('Camion supprimé.'); this.charger(); },
      error: () => this.toastr.error('Échec suppression.')
    });
  }

  /* ───── QR ───── */
  voirQrLocal(c: Chauffeur): void {
    this.qrUrl = null; this.qrModal = true; this.qrChauffeur = c;
    this.chauffeurSvc.qrCode(c.id).subscribe({
      next: b => this.qrUrl = this.san.bypassSecurityTrustUrl(URL.createObjectURL(b)),
      error: () => { this.toastr.error('QR indisponible.'); this.qrModal = false; }
    });
  }

  voirQr(c: Chauffeur): void {
    this.qrUrl = null; this.qrModal = true; this.qrChauffeur = c;
    this.chauffeurSvc.qrCodeGap(c.id).subscribe({
      next: b => this.qrUrl = this.san.bypassSecurityTrustUrl(URL.createObjectURL(b)),
      error: () => { this.toastr.error('QR indisponible.'); this.qrModal = false; }
    });
  }

  imprimerQr(c: Chauffeur): void {
    this.chauffeurSvc.qrCodeGap(c.id).subscribe({
      next: blob => imprimerQrChauffeur(blob, c.nom, c.prenom,
        () => this.toastr.warning('Autorisez les pop-ups pour imprimer.')),
      error: () => this.toastr.error('QR indisponible.')
    });
  }
}
