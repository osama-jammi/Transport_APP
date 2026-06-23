import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { VoyageConteneurService } from '../services/voyage-conteneur.service';
import { ChauffeurService } from '../services/chauffeur.service';
import { ChantierService } from '../services/chantier.service';
import { MatierePremiereService } from '../services/matiere-premiere.service';
import { DepotService } from '../services/depot.service';
import { VoyageService } from '../services/voyage.service';
import { AdminService } from '../services/admin.service';
import { environment } from '../../environments/environment';
import {
  VoyageConteneur, VoyageConteneurRequest, GapVoyage, GapChauffeur, Chantier,
  CommandeMp, GapVoyageArticle, MatierePremiere, TrajetVoyage, Depot
} from '../core/models';
import { SortState } from '../shared/sort.pipe';
import { ColumnFilters, matchesFilters } from '../shared/column-filter';
import * as L from 'leaflet';

/** Une ligne du voyage : un chantier, une date, et soit des livraisons (articles) soit des MP. */
interface VoyageLigne {
  chantierId?: number;
  chantierCode?: string;
  filtreChantier: string;
  comboOpen: boolean;
  chargementJour?: string;
  chargementHeure?: string;
  dechargementJour?: string;
  dechargementHeure?: string;
  type: 'ARTICLE' | 'MATIERE_PREMIERE';
  selectedLiv: Record<number, boolean>;
  commandes: CommandeMp[];
  commandeId?: number;
  lignesMp: MatierePremiere[];
  loadingMp: boolean;
  selectedMp: Record<string, boolean>;
  qteMp: Record<string, number>;
  filtreContenu: string;   // recherche articles + commandes dans la ligne
  filtreLignesMp: string;  // recherche dans les lignes de la commande choisie
  ofOuvert?: boolean;      // nouvelle saisie : section « Ordre de fabrication » dépliée
  mpOuvert?: boolean;      // nouvelle saisie : section « Matières premières » dépliée
}

@Component({
  selector: 'app-voyages-conteneurs',
  template: `
    <div class="toolbar">
      <select [(ngModel)]="vue" (change)="charger()" class="btn btn-outline">
        <option value="en-cours">Voyages en cours</option>
        <option value="archives">Voyages archivés</option>
        <option value="historique">Historique (tous)</option>
      </select>
      <button class="btn btn-primary right" (click)="ouvrir()">
        <i class="fa-solid fa-plus"></i> Nouveau voyage
      </button>
    </div>

    <div class="card"><div class="card-body" style="padding:0">
      <div *ngIf="loading" class="spinner"></div>
      <div *ngIf="!loading && voyagesFiltres().length===0" class="empty">
        <i class="fa-solid fa-truck-fast"></i> Aucun voyage
      </div>
      <div class="table-wrap" *ngIf="!loading && voyagesFiltres().length">
        <table>
          <thead><tr>
            <th appSortable="id" [(state)]="sortState">ID</th>
            <th appSortable="dateVoyage" [(state)]="sortState">Date</th>
            <th appSortable="chauffeur" [(state)]="sortState">Chauffeur</th>
            <th appSortable="nbLivraisons" [(state)]="sortState">Livraisons</th>
            <th appSortable="nbMatieres" [(state)]="sortState">Mat. premières</th>
            <th appSortable="statut" [(state)]="sortState">Statut</th>
            <th></th></tr>
          <tr class="filtre-row">
            <th><input [(ngModel)]="filters['id']" (ngModelChange)="page=1" placeholder="Filtrer"></th>
            <th><input [(ngModel)]="filters['dateVoyage']" (ngModelChange)="page=1" placeholder="Filtrer"></th>
            <th><input [(ngModel)]="filters['chauffeur']" (ngModelChange)="page=1" placeholder="Filtrer"></th>
            <th><input [(ngModel)]="filters['nbLivraisons']" (ngModelChange)="page=1" placeholder="Filtrer"></th>
            <th><input [(ngModel)]="filters['nbMatieres']" (ngModelChange)="page=1" placeholder="Filtrer"></th>
            <th><input [(ngModel)]="filters['statut']" (ngModelChange)="page=1" placeholder="Filtrer"></th>
            <th></th></tr></thead>
          <tbody>
            <tr *ngFor="let v of voyagesFiltres() | sortBy:sortState | paginate:page:pageSize">
              <td><code>#{{ v.id }}</code></td>
              <td>{{ v.dateVoyage ? (v.dateVoyage | date:'dd/MM/yy HH:mm') : '—' }}</td>
              <td>{{ v.chauffeur || '—' }}</td>
              <td><span class="badge badge-gray">{{ v.nbLivraisons ?? 0 }}</span></td>
              <td><span class="badge badge-blue">{{ v.nbMatieres ?? 0 }}</span></td>
              <td><span class="badge badge-orange">{{ v.statut || '—' }}</span></td>
              <td class="flex">
                <button class="btn btn-outline btn-sm" (click)="consulter(v)" title="Consulter le détail">
                  <i class="fa-solid fa-eye"></i> Détails</button>
                <button class="btn btn-outline btn-sm" (click)="ouvrir(v)" [disabled]="estScanne(v)"
                        [title]="estScanne(v) ? 'Voyage scanné : modification impossible' : 'Gérer les livraisons'">
                  <i class="fa-solid fa-pen"></i> Gérer</button>
                <button *ngIf="vue==='en-cours'" class="btn btn-outline btn-sm" (click)="archiver(v)"
                        [disabled]="!estLivre(v)"
                        [title]="estLivre(v) ? 'Archiver' : 'Archivage possible une fois livré'">
                  <i class="fa-solid fa-box-archive"></i></button>
                <button class="btn btn-danger btn-sm" (click)="supprimer(v)" [disabled]="estScanne(v)"
                        [title]="estScanne(v) ? 'Voyage scanné : suppression impossible' : 'Supprimer'">
                  <i class="fa-solid fa-trash"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <app-paginator [total]="voyagesFiltres().length" [page]="page" [pageSize]="pageSize"
                     (pageChange)="page = $event" (pageSizeChange)="pageSize = $event; page = 1"></app-paginator>
    </div></div>

    <!-- Modal créer / gérer un voyage -->
    <div class="modal-backdrop" *ngIf="modal" (click)="fermer($event)">
      <div class="modal" style="max-width:1040px" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>{{ editId ? 'Voyage #' + editId : 'Nouveau voyage' }}</h3>
          <button class="x" (click)="modal=false">&times;</button></div>
        <div class="m-body">
          <div class="field combo">
            <label>Chauffeur du voyage *</label>
            <input class="filtre-input" [(ngModel)]="filtreChauffeur" autocomplete="off"
                   (focus)="comboOpen=true" (input)="comboOpen=true; chauffeurId=undefined"
                   (blur)="fermerCombo()" placeholder="Taper pour rechercher un chauffeur…">
            <div class="combo-list" *ngIf="comboOpen && chauffeursFiltres().length">
              <div class="combo-item" *ngFor="let c of chauffeursFiltres()" (mousedown)="choisirChauffeur(c)">
                {{ c.prenom }} {{ c.nom }} <span class="muted">({{ c.matricule }})</span>
              </div>
            </div>
          </div>

          <div class="field" style="margin-top:10px">
            <label>Local de départ *</label>
            <select [(ngModel)]="depotId" (change)="choisirDepot()">
              <option [ngValue]="undefined" disabled>— Choisir un local —</option>
              <option *ngFor="let dp of depots" [ngValue]="dp.id">{{ dp.nom }}</option>
            </select>
            <small class="muted">Obligatoire. Les dépôts se gèrent dans le menu « Dépôt ».</small>
          </div>

          <h4 class="art-title">Lignes du voyage</h4>
          <div *ngFor="let lg of lignes; let i = index" class="card" style="margin:10px 0">
            <div class="card-body">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <strong>Ligne {{ i + 1 }}</strong>
                <button class="btn btn-danger btn-sm" (click)="retirerLigne(i)" title="Retirer"><i class="fa-solid fa-trash"></i></button>
              </div>
              <div class="form-grid">
                <div class="field combo">
                  <label>Chantier *</label>
                  <input class="filtre-input" [(ngModel)]="lg.filtreChantier" autocomplete="off"
                         (focus)="lg.comboOpen=true" (input)="lg.comboOpen=true; lg.chantierId=undefined"
                         (blur)="fermerComboLigne(lg)" placeholder="Taper un chantier…">
                  <div class="combo-list" *ngIf="lg.comboOpen && chantiersFiltres(lg).length">
                    <div class="combo-item" *ngFor="let ch of chantiersFiltres(lg)" (mousedown)="choisirChantierLigne(lg, ch)">
                      {{ ch.nom }}<span *ngIf="ch.ville" class="muted"> — {{ ch.ville }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="form-grid">
                <div class="field"><label>Chargement prévu (jour)</label><input type="date" [(ngModel)]="lg.chargementJour"></div>
                <div class="field"><label>Heure</label><input type="time" [(ngModel)]="lg.chargementHeure"></div>
                <div class="field"><label>Déchargement prévu (jour)</label><input type="date" [(ngModel)]="lg.dechargementJour"></div>
                <div class="field"><label>Heure</label><input type="time" [(ngModel)]="lg.dechargementHeure"></div>
              </div>

              <!-- Recherche dans le contenu de la ligne (articles / MP) -->
              <input *ngIf="lg.chantierId" class="filtre-input" [(ngModel)]="lg.filtreContenu"
                     placeholder="🔍 Rechercher dans cette ligne (désignation, réf, #livraison)…"
                     style="margin:8px 0">

              <div *ngIf="!lg.chantierId" class="muted" style="font-size:12px;padding:8px">Choisissez d'abord un chantier.</div>

              <!-- Une ligne peut contenir des articles ET des matières premières -->
              <div *ngIf="lg.chantierId">
                <!-- Ordre de fabrication : livraisons de ce chantier -->
                <h5 class="ligne-section" [class.clic]="nouvelleSaisie"
                    (click)="nouvelleSaisie && (lg.ofOuvert = !lg.ofOuvert)">
                  <i *ngIf="nouvelleSaisie" class="fa-solid" [ngClass]="lg.ofOuvert ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
                  <i class="fa-solid fa-boxes-stacked"></i> Ordre de fabrication
                  <span class="muted">({{ selectedLivCount(lg) }} sélectionné(s))</span></h5>
                <div class="art-list full" *ngIf="!nouvelleSaisie || lg.ofOuvert">
                  <div *ngIf="livraisonsDuChantier(lg).length===0" class="muted" style="font-size:12px;padding:8px">Aucune livraison pour ce chantier.</div>
                  <label class="art-item" *ngFor="let l of livraisonsDuChantier(lg)" [class.checked]="lg.selectedLiv[l.id]">
                    <input type="checkbox" [(ngModel)]="lg.selectedLiv[l.id]">
                    <div class="art-info"><strong>#{{ l.id }}</strong>
                      <span class="muted">{{ l.nbArticles }} article(s) · {{ l.statutReception || '—' }}</span></div>
                  </label>
                </div>

                <!-- Matières premières : commande de ce chantier -> lignes -->
                <h5 class="ligne-section" [class.clic]="nouvelleSaisie"
                    (click)="nouvelleSaisie && (lg.mpOuvert = !lg.mpOuvert)">
                  <i *ngIf="nouvelleSaisie" class="fa-solid" [ngClass]="lg.mpOuvert ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
                  <i class="fa-solid fa-cubes"></i> Matières premières
                  <span class="muted">({{ selectedMpCount(lg) }} sélectionnée(s))</span></h5>
                <div *ngIf="!nouvelleSaisie || lg.mpOuvert">
                  <div class="field" style="margin-bottom:8px"><label>Commande</label>
                    <ng-select *ngIf="nouvelleSaisie" [items]="lg.commandes" bindValue="cdno"
                               [(ngModel)]="lg.commandeId" (change)="chargerLignesMp(lg)"
                               [searchable]="true" [clearable]="true" [searchFn]="rechercheCommande"
                               placeholder="Choisir une commande" notFoundText="Aucune commande" clearAllText="Effacer">
                      <ng-template ng-label-tmp let-item="item">
                        #{{ item.cdno }}<span *ngIf="item.tiers"> · {{ item.tiers }}</span></ng-template>
                      <ng-template ng-option-tmp let-item="item">
                        #{{ item.cdno }}<span *ngIf="item.tiers"> · {{ item.tiers }}</span><span *ngIf="item.pieceFournisseur" class="muted"> · {{ item.pieceFournisseur }}</span></ng-template>
                    </ng-select>
                    <select *ngIf="!nouvelleSaisie" [(ngModel)]="lg.commandeId" (change)="chargerLignesMp(lg)">
                      <option [ngValue]="undefined" disabled>— Choisir une commande —</option>
                      <option *ngFor="let c of commandesFiltrees(lg)" [ngValue]="c.cdno">
                        #{{ c.cdno }}<span *ngIf="c.tiers"> · {{ c.tiers }}</span><span *ngIf="c.pieceFournisseur"> · {{ c.pieceFournisseur }}</span></option>
                    </select>
                  </div>
                  <div *ngIf="lg.loadingMp" class="spinner" style="margin:12px auto"></div>
                  <div class="art-list full" *ngIf="lg.commandeId && !lg.loadingMp">
                    <div *ngIf="lignesMpFiltrees(lg).length===0" class="muted" style="font-size:12px;padding:8px">Aucune ligne.</div>
                    <div class="art-item" *ngFor="let m of lignesMpFiltrees(lg)" [class.checked]="lg.selectedMp[m.reference||'']">
                      <input type="checkbox" [(ngModel)]="lg.selectedMp[m.reference||'']" (change)="onToggleMp(lg, m)">
                      <div class="art-info"><strong>{{ m.designation || m.reference }}</strong>
                        <span class="muted">{{ m.reference }} · dispo {{ m.quantite ?? '—' }}</span></div>
                      <input *ngIf="lg.selectedMp[m.reference||'']" type="number" min="1" step="any" class="qte-input"
                             [(ngModel)]="lg.qteMp[m.reference||'']" placeholder="Qté">
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button class="btn btn-outline" (click)="nouvelleSaisie ? ouvrirLigneModal() : ajouterLigne()">
            <i class="fa-solid fa-plus"></i> Ajouter une ligne</button>
        </div>
        <div class="m-foot">
          <button class="btn btn-outline" (click)="modal=false">Annuler</button>
          <button class="btn btn-primary" (click)="enregistrer()" [disabled]="saving">
            <i class="fa-solid fa-floppy-disk"></i> Enregistrer</button>
        </div>
      </div>
    </div>

    <!-- Modal AJOUT d'une ligne (nouvelle saisie) -->
    <div class="modal-backdrop" *ngIf="ligneModal && ligneDraft" (click)="fermerLigneModal($event)" style="z-index:1100">
      <div class="modal" style="max-width:560px" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>Ajouter une ligne</h3><button class="x" (click)="ligneModal=false">&times;</button></div>
        <div class="m-body">
          <div class="field"><label>Chantier *</label>
            <ng-select [items]="chantiers" bindValue="id" [(ngModel)]="ligneDraft.chantierId"
                       (change)="onDraftChantier()" [searchable]="true" placeholder="Rechercher un chantier"
                       notFoundText="Aucun chantier">
              <ng-template ng-label-tmp let-item="item">{{ item.nom }}<span *ngIf="item.ville" class="muted"> — {{ item.ville }}</span></ng-template>
              <ng-template ng-option-tmp let-item="item">{{ item.nom }}<span *ngIf="item.ville" class="muted"> — {{ item.ville }}</span></ng-template>
            </ng-select>
          </div>
          <div class="form-grid">
            <div class="field"><label>Chargement prévu (jour)</label><input type="date" [(ngModel)]="ligneDraft.chargementJour"></div>
            <div class="field"><label>Heure</label><input type="time" [(ngModel)]="ligneDraft.chargementHeure"></div>
            <div class="field"><label>Déchargement prévu (jour)</label><input type="date" [(ngModel)]="ligneDraft.dechargementJour"></div>
            <div class="field"><label>Heure</label><input type="time" [(ngModel)]="ligneDraft.dechargementHeure"></div>
          </div>
        </div>
        <div class="m-foot">
          <button class="btn btn-outline" (click)="ligneModal=false">Annuler</button>
          <button class="btn btn-primary" (click)="validerLigne()" [disabled]="!ligneDraft.chantierId">
            <i class="fa-solid fa-plus"></i> Ajouter la ligne</button>
        </div>
      </div>
    </div>

    <!-- Modal DÉTAIL du voyage -->
    <div class="modal-backdrop" *ngIf="detail" (click)="fermerDetail($event)">
      <div class="modal" style="max-width:900px" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>Voyage #{{ detail.id }}</h3>
          <button class="x" (click)="fermerDetailModal()">&times;</button></div>
        <div class="m-body">
          <div class="detail-grid">
            <div><span class="dk">Chauffeur</span><span class="dv">{{ detail.chauffeur || '—' }}</span></div>
            <div><span class="dk">Statut</span><span class="dv"><span class="badge badge-orange">{{ detail.statut || '—' }}</span></span></div>
            <div><span class="dk">Local de départ</span><span class="dv">{{ detail.localNom || '—' }}</span></div>
            <div><span class="dk">Chargement prévu</span><span class="dv">{{ detail.chargement ? (detail.chargement | date:'dd/MM/yy HH:mm') : '—' }}</span></div>
            <div><span class="dk">Chargement réel</span><span class="dv">{{ detail.realChargement ? (detail.realChargement | date:'dd/MM/yy HH:mm') : '—' }}</span></div>
            <div><span class="dk">Déchargement prévu</span><span class="dv">{{ detail.dechargement ? (detail.dechargement | date:'dd/MM/yy HH:mm') : '—' }}</span></div>
            <div><span class="dk">Déchargement réel</span><span class="dv">{{ detail.realDechargement ? (detail.realDechargement | date:'dd/MM/yy HH:mm') : '—' }}</span></div>
          </div>

          <!-- QR du voyage : un seul scan vaut le scan de toutes les lignes -->
          <div style="display:flex;align-items:center;gap:14px;margin-top:12px;padding:12px;border:1px solid var(--border);border-radius:10px">
            <img [src]="qrVoyageUrl(detail.id)" alt="QR voyage" style="width:96px;height:96px">
            <div>
              <strong>QR du voyage</strong>
              <div class="muted" style="font-size:12px">Scanné par le chauffeur, il valide toutes les lignes du voyage en une fois.</div>
              <a class="btn btn-outline btn-sm" style="margin-top:6px" [href]="qrVoyageUrl(detail.id)"
                 [download]="'qr-voyage-' + detail.id + '.png'" target="_blank">
                <i class="fa-solid fa-download"></i> Télécharger</a>
            </div>
          </div>

          <h4 class="art-title">Livraisons ({{ detailLivraisons.length }})</h4>
          <div *ngIf="detailLoading" class="spinner" style="margin:20px auto"></div>
          <div *ngIf="!detailLoading && detailLivraisons.length===0" class="empty" style="padding:16px">
            <i class="fa-solid fa-box"></i> Aucune livraison rattachée</div>

          <div *ngFor="let l of detailLivraisons" class="card" style="margin-bottom:12px">
            <div class="card-body">
              <div class="row-link" (click)="openLivId = openLivId===l.id ? null : l.id"
                   style="display:flex;align-items:center;gap:8px">
                <i class="fa-solid" [ngClass]="openLivId===l.id ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
                <strong>#{{ l.id }} — {{ l.projetDesignation || l.projetCode || 'Sans chantier' }}</strong>
                <span class="badge badge-gray">{{ l.statutReception || '—' }}</span>
                <span style="margin-left:auto;display:flex;gap:6px" (click)="$event.stopPropagation()">
                  <img [src]="qrLivraisonUrl(l.id)" alt="QR" style="width:40px;height:40px;vertical-align:middle"
                       title="QR de la livraison">
                  <a class="btn btn-outline btn-sm" [href]="qrLivraisonUrl(l.id)"
                     [download]="'qr-livraison-' + l.id + '.png'" target="_blank" title="Télécharger le QR de la livraison">
                    <i class="fa-solid fa-qrcode"></i></a>
                  <button *ngIf="l.hasBl" class="btn btn-outline btn-sm"
                          (click)="telechargerBL(l)" title="Télécharger le BL">
                    <i class="fa-solid fa-file-arrow-down"></i> BL</button>
                  <button class="btn btn-danger btn-sm" (click)="detacher(l)"
                          [disabled]="estScanne(detail) || livraisonScannee(l)"
                          [title]="(estScanne(detail) || livraisonScannee(l)) ? 'Livraison scannée : modification impossible' : 'Retirer du voyage'">
                    <i class="fa-solid fa-link-slash"></i> Retirer</button>
                </span>
              </div>

              <div *ngIf="openLivId===l.id">
              <div style="display:flex;align-items:center;gap:10px;margin:8px 0;padding:8px;background:#faf9fb;border-radius:8px">
                <span class="dk">Code de forçage d'arrivée</span>
                <strong>{{ l.forceCode || '— non généré —' }}</strong>
                <button class="btn btn-outline btn-sm" style="margin-left:auto"
                        (click)="regenererForce(l)" [disabled]="regenForce">
                  <i class="fa-solid fa-rotate"></i> Régénérer</button>
              </div>
              <!-- Articles -->
              <div class="table-wrap" *ngIf="contenu[l.id]?.articles?.length" style="margin-top:8px">
                <table>
                  <thead><tr><th>Article</th><th>Qté</th><th>Statut</th><th>QR</th></tr></thead>
                  <tbody>
                    <ng-container *ngFor="let a of contenu[l.id].articles">
                      <tr class="row-link" (click)="artDetailId = artDetailId===a.id ? null : a.id">
                        <td><strong>{{ a.designation || '—' }}</strong></td>
                        <td>{{ a.quantite ?? '—' }}</td>
                        <td><span class="badge badge-gray">{{ a.statutReception || '—' }}</span></td>
                        <td style="white-space:nowrap" (click)="$event.stopPropagation()">
                          <img [src]="qrArticleUrl(a.id)" alt="QR" style="width:48px;height:48px;vertical-align:middle">
                          <a class="btn btn-outline btn-sm" style="margin-left:6px"
                             [href]="qrArticleUrl(a.id)" [download]="'qr-article-' + a.id + '.png'" target="_blank" title="Télécharger le QR">
                            <i class="fa-solid fa-download"></i></a>
                        </td>
                      </tr>
                      <tr *ngIf="artDetailId===a.id">
                        <td colspan="4" class="muted" style="font-size:12px;background:#faf9fb">
                          N° prix : <code>{{ a.numPrix || '—' }}</code> ·
                          Projet : {{ a.projet || '—' }} ·
                          Heure scan : {{ a.heureScan ? (a.heureScan | date:'dd/MM/yy HH:mm:ss') : '—' }} ·
                          Réf ligne : <code>#{{ a.id }}</code>
                        </td>
                      </tr>
                    </ng-container>
                  </tbody>
                </table>
              </div>

              <!-- Matières premières -->
              <div class="table-wrap" *ngIf="contenu[l.id]?.matieres?.length" style="margin-top:8px">
                <table>
                  <thead><tr><th>Matière première</th><th>Réf</th><th>Qté</th><th>QR</th></tr></thead>
                  <tbody>
                    <tr *ngFor="let m of contenu[l.id].matieres">
                      <td><strong>{{ m.designation || '—' }}</strong></td>
                      <td><code>{{ m.reference || '—' }}</code></td>
                      <td>{{ m.quantite ?? '—' }}</td>
                      <td><img [src]="qrMatiereUrl(m.id)" alt="QR" style="width:48px;height:48px"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div *ngIf="!contenu[l.id]?.articles?.length && !contenu[l.id]?.matieres?.length"
                   class="muted" style="margin-top:6px;font-size:12px">Aucun contenu</div>
              </div>
            </div>
          </div>

          <h4 class="art-title">Matières premières ({{ detailMatieres.length }})</h4>
          <div *ngIf="detailMatieres.length===0" class="empty" style="padding:14px">
            <i class="fa-solid fa-cubes"></i> Aucune matière première</div>
          <div class="table-wrap" *ngIf="detailMatieres.length">
            <table>
              <thead><tr><th>Désignation</th><th>Pièce fournisseur</th><th>Affaire</th>
                <th>Qté cmd.</th><th>Qté livrée</th><th>Reste</th><th>Statut</th><th>QR</th><th></th></tr></thead>
              <tbody>
                <tr *ngFor="let m of detailMatieres" [class.row-done]="estCloturee(m)">
                  <td><strong>{{ m.designation || '—' }}</strong>
                    <div class="muted" style="font-size:11px">Réf {{ m.reference || '—' }}</div></td>
                  <td><code>{{ m.pieceFournisseur || '—' }}</code></td>
                  <td>{{ m.projet || '—' }}</td>
                  <td>{{ m.qteCommande ?? '—' }}</td>
                  <td>{{ qteLivree(m) }}</td>
                  <td><strong>{{ resteALivrer(m) }}</strong></td>
                  <td><span class="badge" [ngClass]="estCloturee(m) ? 'badge-green' : 'badge-orange'">
                    {{ estCloturee(m) ? 'Livrée' : 'En attente' }}</span></td>
                  <td style="white-space:nowrap">
                    <img [src]="qrMatiereUrl(m.id)" alt="QR" style="width:48px;height:48px;vertical-align:middle">
                    <a class="btn btn-outline btn-sm" style="margin-left:6px"
                       [href]="qrMatiereUrl(m.id)" [download]="'qr-mp-' + m.id + '.png'" target="_blank" title="Télécharger le QR">
                      <i class="fa-solid fa-download"></i></a>
                  </td>
                  <td style="white-space:nowrap">
                    <button class="btn btn-sm" [ngClass]="estCloturee(m) ? 'btn-outline' : 'btn-primary'"
                            (click)="basculerMatiere(m)" [disabled]="majMatiere"
                            [title]="estCloturee(m) ? 'Rouvrir' : 'Clôturer (marquer livrée)'">
                      <i class="fa-solid" [ngClass]="estCloturee(m) ? 'fa-rotate-left' : 'fa-check'"></i>
                      {{ estCloturee(m) ? 'Rouvrir' : 'Clôturer' }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h4 class="art-title">Suivi GPS du chauffeur</h4>
          <div *ngIf="trajetLoading" class="spinner" style="margin:20px auto"></div>
          <div *ngIf="!trajetLoading && (!trajet || !trajet.nbPoints)" class="empty" style="padding:16px">
            <i class="fa-solid fa-location-dot"></i> Aucun mouvement enregistré</div>
          <div *ngIf="!trajetLoading && trajet && trajet.nbPoints">
            <div class="detail-grid">
              <div><span class="dk">Durée</span><span class="dv"><strong>{{ dureeLabel(trajet.dureeMinutes) }}</strong></span></div>
              <div><span class="dk">Points</span><span class="dv">{{ trajet.nbPoints }}</span></div>
            </div>
            <div id="conteneur-trajet-map"
                 style="height:300px;border-radius:10px;margin-top:10px;overflow:hidden;border:1px solid #e5e7eb"></div>
          </div>
        </div>
        <div class="m-foot">
          <button class="btn btn-outline" (click)="fermerDetailModal()">Fermer</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    tr.row-done td { opacity: .65; }
    tr.row-done strong { text-decoration: line-through; }
    h5.ligne-section { margin: 14px 0 6px; font-size: 13px; font-weight: 700; color: var(--primary); }
    h5.ligne-section i { margin-right: 6px; color: var(--accent-dark); }
    h5.ligne-section.clic { cursor: pointer; user-select: none; }
    h5.ligne-section.clic:hover { color: var(--primary-dark); }
    /* Lignes de commande (MP) : une par rangée, pleine largeur, désignation sur plusieurs lignes */
    .art-list.full { grid-template-columns: 1fr; max-height: 320px; }
    .art-list.full .art-info strong { white-space: normal; }
  `]
})
export class VoyagesConteneursComponent implements OnInit {
  voyages: VoyageConteneur[] = [];
  loading = true;
  page = 1; pageSize = 10;
  filters: ColumnFilters = {};
  sortState: SortState = { key: '', dir: 'asc' };
  vue: 'en-cours' | 'archives' | 'historique' = 'en-cours';
  modal = false; saving = false;
  editId: number | null = null;

  chauffeurs: GapChauffeur[] = [];
  chauffeurId?: number;
  filtreChauffeur = '';
  comboOpen = false;

  chantiers: Chantier[] = [];
  allLivraisons: GapVoyage[] = [];   // livraisons assignables (filtrées par chantier dans chaque ligne)
  lignes: VoyageLigne[] = [];

  // Nouvelle saisie (interrupteur Administration « voyage-nouvelle-saisie »)
  nouvelleSaisie = true;
  ligneModal = false;
  ligneDraft: VoyageLigne | null = null;
  /** Recherche ng-select pour le choix de commande (nouvelle saisie). */
  rechercheCommande = (term: string, item: CommandeMp): boolean => {
    const t = (term || '').toLowerCase();
    return `${item.cdno} ${item.tiers || ''} ${item.pieceFournisseur || ''} ${item.reference || ''} ${item.marche || ''}`
      .toLowerCase().includes(t);
  };
  form: { localNom?: string; localLat?: number; localLng?: number; localRayon?: number } = {};
  depots: Depot[] = [];
  depotId?: number;

  // Détail (consultation)
  detail: VoyageConteneur | null = null;
  detailLivraisons: GapVoyage[] = [];
  contenu: Record<number, { articles: GapVoyageArticle[]; matieres: MatierePremiere[] }> = {};
  detailLoading = false;
  detailMatieres: MatierePremiere[] = [];
  trajet: TrajetVoyage | null = null;
  trajetLoading = false;
  artDetailId: number | null = null;
  openLivId: number | null = null;
  regenForce = false;
  majMatiere = false;
  private trajetMap?: L.Map;

  constructor(
    private svc: VoyageConteneurService,
    private chauffeurSvc: ChauffeurService,
    private chantierSvc: ChantierService,
    private matiereSvc: MatierePremiereService,
    private depotSvc: DepotService,
    private voyageSvc: VoyageService,
    private adminSvc: AdminService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.charger();
    // Interrupteur Administration : nouveau parcours de saisie ou ancien.
    this.adminSvc.getFeatures().subscribe({
      next: fs => { const f = fs.find(x => x.cle === 'voyage-nouvelle-saisie'); this.nouvelleSaisie = f ? f.actif : true; },
      error: () => { this.nouvelleSaisie = true; }
    });
  }

  /** Voyages filtrés par la recherche (chauffeur, statut, id). */
  voyagesFiltres(): VoyageConteneur[] {
    return this.voyages.filter(v => matchesFilters(v, this.filters));
  }

  charger(): void {
    this.loading = true;
    this.page = 1;
    this.svc.getAll(this.vue).subscribe({
      next: d => { this.voyages = d; this.loading = false; },
      error: () => { this.voyages = []; this.loading = false; this.toastr.error('Impossible de charger les voyages.'); }
    });
  }

  /** Voyage scanné = chargement réel enregistré → plus de modification/suppression. */
  estScanne(v: VoyageConteneur | null): boolean { return !!v && v.realChargement != null; }
  /** Livraison scannée (en-tête CHARGE/LIVRE ou ligne scannée) → ni modification ni suppression. */
  livraisonScannee(l: GapVoyage | null): boolean {
    const s = (l?.statutReception || '').toUpperCase();
    return ['CHARGE', 'LIVRE', 'SCANNE_CHARGEMENT', 'SCANNE_LIVRAISON'].includes(s);
  }
  /** Voyage livré = déchargement réel enregistré. */
  estLivre(v: VoyageConteneur | null): boolean { return !!v && v.realDechargement != null; }

  archiver(v: VoyageConteneur): void {
    if (!this.estLivre(v)) { this.toastr.warning('Archivage possible uniquement une fois le voyage livré.'); return; }
    this.svc.archiver(v.id).subscribe({
      next: () => { this.toastr.success('Voyage archivé.'); this.charger(); },
      error: () => this.toastr.error('Échec de l’archivage.')
    });
  }

  ouvrir(v?: VoyageConteneur): void {
    if (v && this.estScanne(v)) { this.toastr.warning('Voyage scanné : modification impossible.'); return; }
    this.editId = v ? v.id : null;
    this.chauffeurId = v ? v.chauffeurId : undefined;
    this.filtreChauffeur = v && v.chauffeur ? v.chauffeur : '';
    this.comboOpen = false;
    this.lignes = [];
    this.form = {
      localNom: v?.localNom, localLat: v?.localLat, localLng: v?.localLng, localRayon: v?.localRayon
    };
    this.depotId = undefined;
    this.modal = true;
    const vid = v ? v.id : 0;
    forkJoin({
      chauffeurs: this.chauffeurSvc.getFromGap().pipe(catchError(() => of([] as GapChauffeur[]))),
      chantiers:  this.chantierSvc.getFromGap().pipe(catchError(() => of([] as Chantier[]))),
      depots:     this.depotSvc.getAll().pipe(catchError(() => of([] as Depot[]))),
      livraisons: this.svc.livraisonsAssignables(vid).pipe(catchError(() => of([] as GapVoyage[])))
    }).subscribe(({ chauffeurs, chantiers, depots, livraisons }) => {
      this.chauffeurs = chauffeurs;
      this.chantiers = chantiers;
      this.depots = depots;
      if (v?.localNom) { const dp = depots.find(d => d.nom === v.localNom); if (dp) this.depotId = dp.id; }
      this.allLivraisons = livraisons;
      // À l'édition : reconstruit une ligne « articles » par chantier déjà rattaché
      if (v) {
        const parChantier = new Map<number, GapVoyage[]>();
        livraisons.filter(l => l.voyageId === v.id).forEach(l => {
          const k = l.projetId ?? 0;
          if (!parChantier.has(k)) parChantier.set(k, []);
          parChantier.get(k)!.push(l);
        });
        parChantier.forEach((livs, projetId) => {
          const lg = this.nouvelleLigne();
          lg.chantierId = projetId;
          const ch = chantiers.find(c => c.id === projetId);
          lg.chantierCode = ch?.code; lg.filtreChantier = ch ? ch.nom : (livs[0].projetDesignation || '');
          livs.forEach(l => lg.selectedLiv[l.id] = true);
          // La ligne peut aussi recevoir des MP : on charge ses commandes.
          if (lg.chantierCode) this.chargerCommandes(lg);
          this.lignes.push(lg);
        });
        // Reconstruit les lignes « matières premières » (groupées par chantier + commande)
        this.svc.matieres(v.id).subscribe({
          next: mps => {
            const grp = new Map<string, MatierePremiere[]>();
            mps.forEach(m => {
              const k = `${m.projet || ''}|${m.cdno || ''}`;
              if (!grp.has(k)) grp.set(k, []);
              grp.get(k)!.push(m);
            });
            grp.forEach(items => {
              const first = items[0];
              const lg = this.nouvelleLigne();
              lg.type = 'MATIERE_PREMIERE';
              lg.chantierCode = first.projet;
              const ch = chantiers.find(c => c.code === first.projet);
              if (ch) { lg.chantierId = ch.id; lg.filtreChantier = ch.nom; } else { lg.filtreChantier = first.projet || ''; }
              lg.commandeId = first.cdno;
              const split = (iso?: string) => iso ? { j: iso.slice(0, 10), h: iso.slice(11, 16) } : { j: undefined, h: undefined };
              const c = split(first.dateChargement); const d = split(first.dateDechargement);
              lg.chargementJour = c.j; lg.chargementHeure = c.h; lg.dechargementJour = d.j; lg.dechargementHeure = d.h;
              lg.lignesMp = items;
              items.forEach(m => { const r = m.reference || ''; lg.selectedMp[r] = true; lg.qteMp[r] = m.quantite || 1; });
              if (first.cdno) this.matiereSvc.getCommandes(first.projet).subscribe({ next: cmds => lg.commandes = cmds, error: () => {} });
              this.lignes.push(lg);
            });
          },
          error: () => {}
        });
      }
      // Ancienne saisie : une ligne vide d'office. Nouvelle saisie : on ajoute via la modale.
      if (this.lignes.length === 0 && !this.nouvelleSaisie) this.ajouterLigne();
    });
  }

  supprimer(v: VoyageConteneur): void {
    if (this.estScanne(v)) { this.toastr.warning('Voyage scanné : suppression impossible.'); return; }
    if (!confirm(`Supprimer le voyage #${v.id} ? Les livraisons seront détachées (non supprimées).`)) return;
    this.svc.delete(v.id).subscribe({
      next: () => { this.toastr.success('Voyage supprimé.'); this.charger(); },
      error: () => this.toastr.error('Échec de la suppression.')
    });
  }

  nouvelleLigne(): VoyageLigne {
    return {
      filtreChantier: '', comboOpen: false, type: 'ARTICLE',
      selectedLiv: {}, commandes: [], lignesMp: [], loadingMp: false,
      selectedMp: {}, qteMp: {}, filtreContenu: '', filtreLignesMp: ''
    };
  }
  ajouterLigne(): void { this.lignes.push(this.nouvelleLigne()); }
  retirerLigne(i: number): void { this.lignes.splice(i, 1); }

  /* ─────────── Nouvelle saisie : ajout d'une ligne via une modale ─────────── */
  ouvrirLigneModal(): void { this.ligneDraft = this.nouvelleLigne(); this.ligneModal = true; }
  fermerLigneModal(e: Event): void { if (e.target === e.currentTarget) this.ligneModal = false; }
  /** Choix du chantier dans la modale d'ajout de ligne (ng-select) → charge les commandes. */
  onDraftChantier(): void {
    const lg = this.ligneDraft;
    if (!lg) return;
    const ch = this.chantiers.find(c => c.id === lg.chantierId);
    if (ch) { lg.chantierCode = ch.code; lg.filtreChantier = ch.nom + (ch.ville ? ` — ${ch.ville}` : ''); }
    lg.selectedLiv = {}; lg.commandes = []; lg.commandeId = undefined; lg.lignesMp = []; lg.selectedMp = {}; lg.qteMp = {};
    if (lg.chantierId) this.chargerCommandes(lg);
  }
  /** Valide la modale : ajoute la ligne configurée (section OF dépliée par défaut). */
  validerLigne(): void {
    if (!this.ligneDraft || !this.ligneDraft.chantierId) return;
    this.ligneDraft.ofOuvert = true;
    this.lignes.push(this.ligneDraft);
    this.ligneDraft = null;
    this.ligneModal = false;
  }

  fermer(e: Event): void { if (e.target === e.currentTarget) this.modal = false; }

  chauffeursFiltres(): GapChauffeur[] {
    const t = this.filtreChauffeur.toLowerCase().trim();
    if (!t) return this.chauffeurs;
    return this.chauffeurs.filter(c =>
      `${c.prenom || ''} ${c.nom || ''} ${c.matricule ?? ''}`.toLowerCase().includes(t));
  }
  choisirChauffeur(c: GapChauffeur): void {
    this.chauffeurId = c.id;
    this.filtreChauffeur = `${c.prenom || ''} ${c.nom || ''} (${c.matricule ?? ''})`.trim();
    this.comboOpen = false;
  }
  fermerCombo(): void { setTimeout(() => this.comboOpen = false, 150); }

  /** Sélection d'un dépôt : copie sa localisation dans le voyage (local de départ). */
  choisirDepot(): void {
    const dp = this.depots.find(d => d.id === this.depotId);
    this.form.localNom = dp?.nom;
    this.form.localLat = dp?.latitude;
    this.form.localLng = dp?.longitude;
    this.form.localRayon = dp?.rayon;
  }

  private combine(jour?: string, heure?: string): string | undefined {
    return jour ? `${jour}T${heure || '00:00'}` : undefined;
  }

  /* ─────────── Lignes : chantier ─────────── */
  chantiersFiltres(lg: VoyageLigne): Chantier[] {
    const t = lg.filtreChantier.toLowerCase().trim();
    if (!t) return this.chantiers;
    return this.chantiers.filter(c => `${c.nom || ''} ${c.ville || ''} ${c.code || ''}`.toLowerCase().includes(t));
  }
  choisirChantierLigne(lg: VoyageLigne, ch: Chantier): void {
    lg.chantierId = ch.id; lg.chantierCode = ch.code;
    lg.filtreChantier = ch.nom + (ch.ville ? ` — ${ch.ville}` : '');
    lg.comboOpen = false;
    lg.selectedLiv = {}; lg.commandes = []; lg.commandeId = undefined; lg.lignesMp = []; lg.selectedMp = {}; lg.qteMp = {};
    // Une ligne porte articles ET MP : on charge les commandes dès le choix du chantier.
    this.chargerCommandes(lg);
  }

  /** Nb de livraisons (articles) sélectionnées dans une ligne. */
  selectedLivCount(lg: VoyageLigne): number {
    return Object.keys(lg.selectedLiv).filter(k => lg.selectedLiv[+k]).length;
  }
  /** Nb de matières premières sélectionnées dans une ligne. */
  selectedMpCount(lg: VoyageLigne): number {
    return lg.lignesMp.filter(m => lg.selectedMp[m.reference || '']).length;
  }
  fermerComboLigne(lg: VoyageLigne): void { setTimeout(() => lg.comboOpen = false, 150); }

  livraisonsDuChantier(lg: VoyageLigne): GapVoyage[] {
    const t = (lg.filtreContenu || '').toLowerCase().trim();
    return this.allLivraisons.filter(l =>
      l.projetId === lg.chantierId &&
      // uniquement les livraisons en cours (pas livrées / archivées)
      !['LIVRE', 'ARCHIVE'].includes((l.statutReception || '').toUpperCase()) &&
      (!t || `#${l.id} ${l.projetDesignation || ''} ${l.statutReception || ''}`.toLowerCase().includes(t)));
  }

  /** Lignes de la commande filtrées par la recherche dédiée aux lignes. */
  lignesMpFiltrees(lg: VoyageLigne): MatierePremiere[] {
    const t = (lg.filtreLignesMp || '').toLowerCase().trim();
    if (!t) return lg.lignesMp;
    return lg.lignesMp.filter(m =>
      `${m.designation || ''} ${m.reference || ''}`.toLowerCase().includes(t));
  }

  /** Commandes filtrées par la recherche de la ligne (n°, fournisseur, pièce fournisseur, réf). */
  commandesFiltrees(lg: VoyageLigne): CommandeMp[] {
    const t = (lg.filtreContenu || '').toLowerCase().trim();
    if (!t) return lg.commandes;
    return lg.commandes.filter(c =>
      `${c.cdno} ${c.tiers || ''} ${c.pieceFournisseur || ''} ${c.reference || ''} ${c.marche || ''}`
        .toLowerCase().includes(t));
  }

  /* ─────────── Lignes : matières premières ─────────── */
  setTypeMp(lg: VoyageLigne): void {
    lg.type = 'MATIERE_PREMIERE';
    if (lg.chantierId && lg.commandes.length === 0) this.chargerCommandes(lg);
  }
  chargerCommandes(lg: VoyageLigne): void {
    this.matiereSvc.getCommandes(lg.chantierCode).subscribe({
      next: d => lg.commandes = d,
      error: () => this.toastr.error('Commandes indisponibles (Divalto).')
    });
  }
  chargerLignesMp(lg: VoyageLigne): void {
    if (!lg.commandeId) return;
    lg.loadingMp = true; lg.lignesMp = [];
    this.matiereSvc.getLignes(lg.commandeId).subscribe({
      next: d => { lg.lignesMp = d; lg.loadingMp = false; },
      error: () => { lg.loadingMp = false; this.toastr.error('Lignes indisponibles (Divalto).'); }
    });
  }
  onToggleMp(lg: VoyageLigne, m: MatierePremiere): void {
    const k = m.reference || '';
    if (lg.selectedMp[k] && (lg.qteMp[k] == null || lg.qteMp[k] <= 0)) lg.qteMp[k] = 1;
  }

  enregistrer(): void {
    if (!this.chauffeurId) { this.toastr.warning('Veuillez choisir un chauffeur.'); return; }
    if (!this.form.localNom) { this.toastr.warning('Veuillez choisir un local de départ (obligatoire).'); return; }
    const livraisonIds: number[] = [];
    const livraisonDates: NonNullable<VoyageConteneurRequest['livraisonDates']> = [];
    const matieres: NonNullable<VoyageConteneurRequest['matieres']> = [];
    for (const lg of this.lignes) {
      const ch = this.combine(lg.chargementJour, lg.chargementHeure);
      const de = this.combine(lg.dechargementJour, lg.dechargementHeure);
      // Une ligne peut porter À LA FOIS des articles et des matières premières.
      Object.keys(lg.selectedLiv).filter(k => lg.selectedLiv[+k]).forEach(k => {
        livraisonIds.push(+k);
        livraisonDates.push({ id: +k, chargement: ch, dechargement: de });
      });
      const cmd = lg.commandes.find(c => c.cdno === lg.commandeId);
      lg.lignesMp.filter(m => lg.selectedMp[m.reference || '']).forEach(m => {
        const ref = m.reference || '';
        matieres.push({
          projet: lg.chantierCode, cdno: lg.commandeId, ref,
          designation: m.designation, of: m.of, unite: m.unite,
          pieceFournisseur: cmd?.pieceFournisseur ?? m.pieceFournisseur,
          qteCommande: m.qteCommande ?? m.quantite,
          quantite: lg.qteMp[ref] && lg.qteMp[ref] > 0 ? lg.qteMp[ref] : 1,
          dateChargement: ch, dateDechargement: de
        });
      });
    }
    const req: VoyageConteneurRequest = {
      chauffeurId: this.chauffeurId, livraisonIds, livraisonDates, matieres,
      localNom: this.form.localNom, localLat: this.form.localLat,
      localLng: this.form.localLng, localRayon: this.form.localRayon
    };
    this.saving = true;
    const ok = () => {
      this.toastr.success(this.editId ? 'Voyage modifié.' : 'Voyage créé.');
      this.modal = false; this.saving = false; this.charger();
    };
    const ko = () => { this.toastr.error('Échec de l’enregistrement.'); this.saving = false; };
    if (this.editId) {
      this.svc.update(this.editId, req).subscribe({ next: ok, error: ko });
    } else {
      this.svc.create(req).subscribe({ next: ok, error: ko });
    }
  }

  /* ─────────── Consultation du détail ─────────── */
  consulter(v: VoyageConteneur): void {
    this.detail = v;
    this.detailLivraisons = [];
    this.contenu = {};
    this.detailMatieres = [];
    this.svc.matieres(v.id).subscribe({ next: m => this.detailMatieres = m, error: () => {} });
    this.detailLoading = true;
    this.detruireCarte();
    this.trajet = null;
    this.trajetLoading = true;

    this.svc.livraisons(v.id).subscribe({
      next: livs => {
        this.detailLivraisons = livs;
        this.detailLoading = false;
        // Charge le contenu (articles + matières premières) de chaque livraison
        livs.forEach(l => {
          this.contenu[l.id] = { articles: [], matieres: [] };
          this.voyageSvc.articles(l.id).subscribe({ next: a => this.contenu[l.id].articles = a, error: () => {} });
          this.voyageSvc.matieres(l.id).subscribe({ next: m => this.contenu[l.id].matieres = m, error: () => {} });
        });
      },
      error: () => { this.detailLoading = false; this.toastr.error('Livraisons indisponibles.'); }
    });

    this.svc.trajet(v.id).subscribe({
      next: t => { this.trajet = t; this.trajetLoading = false; setTimeout(() => this.afficherTrajet(), 150); },
      error: () => { this.trajet = null; this.trajetLoading = false; }
    });
  }

  /** Régénère le code de forçage d'une livraison (ligne de voyage). */
  regenererForce(l: GapVoyage): void {
    this.regenForce = true;
    this.voyageSvc.regenererForceCode(l.id).subscribe({
      next: maj => { l.forceCode = maj.forceCode; this.regenForce = false; this.toastr.success('Nouveau code : ' + maj.forceCode); },
      error: () => { this.regenForce = false; this.toastr.error('Échec de la régénération.'); }
    });
  }

  /** Télécharge le bon de livraison d'une livraison du voyage. */
  telechargerBL(l: GapVoyage): void {
    this.voyageSvc.telechargerBL(l.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `bon-livraison-${l.id}`; a.target = '_blank';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      },
      error: () => this.toastr.error('Bon de livraison indisponible.')
    });
  }

  qrArticleUrl(detailId: number): string { return `${environment.apiUrl}/articles/detail/${detailId}/qrcode`; }
  qrMatiereUrl(detailMpId: number): string { return `${environment.apiUrl}/articles/matiere/${detailMpId}/qrcode`; }
  qrVoyageUrl(voyageId: number): string { return `${environment.apiUrl}/voyages-conteneurs/${voyageId}/qrcode`; }
  qrLivraisonUrl(livId: number): string { return `${environment.apiUrl}/voyages-conteneurs/livraisons/${livId}/qrcode`; }

  /** Détache une livraison du voyage affiché (sans la supprimer de GAP). */
  detacher(l: GapVoyage): void {
    if (this.livraisonScannee(l)) { this.toastr.warning('Livraison scannée : modification impossible.'); return; }
    if (!confirm(`Retirer la livraison #${l.id} de ce voyage ? (la livraison n'est pas supprimée)`)) return;
    this.svc.detacherLivraison(l.id).subscribe({
      next: () => {
        this.toastr.success('Livraison retirée du voyage.');
        this.detailLivraisons = this.detailLivraisons.filter(x => x.id !== l.id);
        this.charger();
      },
      error: (e) => this.toastr.error(e?.error?.message || 'Échec du retrait.')
    });
  }

  /* ─────────── Matières premières : clôture (statut local, sans impact ERP) ─────────── */
  estCloturee(m: MatierePremiere): boolean { return (m.statut || '').toUpperCase() === 'LIVRE'; }
  /** Qté livrée = qté de la ligne une fois clôturée, sinon 0. */
  qteLivree(m: MatierePremiere): number { return this.estCloturee(m) ? (m.quantite ?? 0) : 0; }
  /** Reste à livrer = qté commandée − qté livrée. */
  resteALivrer(m: MatierePremiere): number {
    const cmd = m.qteCommande ?? m.quantite ?? 0;
    return Math.max(0, cmd - this.qteLivree(m));
  }
  basculerMatiere(m: MatierePremiere): void {
    const nouveau = this.estCloturee(m) ? 'EN_ATTENTE' : 'LIVRE';
    this.majMatiere = true;
    this.svc.statutMatiere(m.id, nouveau).subscribe({
      next: () => { m.statut = nouveau; this.majMatiere = false;
        this.toastr.success(nouveau === 'LIVRE' ? 'Matière clôturée.' : 'Matière rouverte.'); },
      error: () => { this.majMatiere = false; this.toastr.error('Échec de la mise à jour du statut.'); }
    });
  }

  dureeLabel(min?: number | null): string {
    if (min == null) return '—';
    const h = Math.floor(min / 60); const m = min % 60;
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  }

  fermerDetail(e: Event): void { if (e.target === e.currentTarget) this.fermerDetailModal(); }
  fermerDetailModal(): void { this.detruireCarte(); this.detail = null; }

  private afficherTrajet(): void {
    const pts = (this.trajet?.points || [])
      .filter(p => p.latitude != null && p.longitude != null)
      .map(p => [p.latitude as number, p.longitude as number] as L.LatLngTuple);
    const el = document.getElementById('conteneur-trajet-map');
    if (!el || pts.length === 0) return;
    this.detruireCarte();
    const map = L.map('conteneur-trajet-map');
    this.trajetMap = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    const ligne = L.polyline(pts, { color: '#2563eb', weight: 4, opacity: 0.85 }).addTo(map);
    const dot = (couleur: string) => L.divIcon({ className: '',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${couleur};border:2px solid #fff"></div>`,
      iconSize: [14, 14], iconAnchor: [7, 7] });
    L.marker(pts[0], { icon: dot('#16a34a') }).addTo(map).bindPopup('Départ');
    L.marker(pts[pts.length - 1], { icon: dot('#dc2626') }).addTo(map).bindPopup('Dernière position');
    const distincts = new Set(pts.map(p => p[0] + ',' + p[1]));
    if (distincts.size > 1) map.fitBounds(ligne.getBounds().pad(0.2)); else map.setView(pts[0], 16);
    setTimeout(() => map.invalidateSize(), 50);
  }
  private detruireCarte(): void { if (this.trajetMap) { this.trajetMap.remove(); this.trajetMap = undefined; } }
}
