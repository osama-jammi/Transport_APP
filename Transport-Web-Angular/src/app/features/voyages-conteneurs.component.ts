import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { blobQrEnPdf } from '../core/qr-pdf';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { VoyageConteneurService, BonLivraisonFile } from '../services/voyage-conteneur.service';
import { ChauffeurService } from '../services/chauffeur.service';
import { ChantierService } from '../services/chantier.service';
import { MatierePremiereService } from '../services/matiere-premiere.service';
import { StockService } from '../services/stock.service';
import { DepotService } from '../services/depot.service';
import { VoyageService } from '../services/voyage.service';
import { AdminService } from '../services/admin.service';
import { environment } from '../../environments/environment';
import {
  VoyageConteneur, VoyageConteneurRequest, GapVoyage, GapChauffeur, Chantier,
  CommandeMp, GapVoyageArticle, MatierePremiere, TrajetVoyage, Depot, ArticleStock
} from '../core/models';
import { SortState } from '../shared/sort.pipe';
import { matchesSearch, matchesFilters, ColumnFilters } from '../shared/column-filter';
import { FiltreField } from '../shared/filtre-panel.component';
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
  /** OF disponibles du chantier (référence stable pour le ng-select / la table). */
  livrDispo?: GapVoyage[];
  /** Ids des OF sélectionnés (modèle stable du ng-select multiple). */
  selLivIds?: number[];
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
  /** MP déjà confirmées depuis d'autres commandes (accumulées entre changements de commande). */
  mpSauvegardes: { m: MatierePremiere; cdno?: number; pieceFournisseur?: string; qte: number }[];
  // ── Stock (vue Article_en_stock DivNet, lecture seule) ──
  stockOuvert?: boolean;            // section « Stock » dépliée
  depotStock?: string;              // dépôt choisi (code DEPO, ex. RB1)
  articlesStock?: ArticleStock[];     // articles disponibles du dépôt (liste complète)
  articlesStockFiltered?: ArticleStock[]; // liste filtrée complète (après recherche)
  articlesStockView?: ArticleStock[]; // page courante affichée (ne JAMAIS calculer dans le *ngFor)
  stockPage?: number;                 // index de page (0-based)
  loadingStock?: boolean;
  selectedStock?: Record<string, boolean>;  // clé = référence article
  qteStock?: Record<string, number>;
  filtreStock?: string;             // recherche dans les articles disponibles
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
      <div class="search"><i class="fa-solid fa-magnifying-glass"></i>
        <input [(ngModel)]="q" (ngModelChange)="page=1" placeholder="Rechercher (chauffeur, statut)…"></div>
      <button class="btn" [ngClass]="filtresUI ? 'btn-primary' : 'btn-outline'" (click)="basculerFiltres()"
              title="Filtrer par colonne">
        <i class="fa-solid fa-filter"></i> Filtres</button>
      <button class="btn btn-outline" (click)="exporterExcel()" [disabled]="exporting"
              title="Exporter la liste en Excel">
        <i class="fa-solid fa-file-excel"></i> Excel</button>
      <button class="btn btn-outline" (click)="exporterPdf()"
              title="Exporter / imprimer la liste en PDF">
        <i class="fa-solid fa-file-pdf"></i> PDF</button>
      <button class="btn btn-primary right" (click)="ouvrir()">
        <i class="fa-solid fa-plus"></i> Nouveau voyage
      </button>
    </div>

    <app-filtre-panel *ngIf="filtresUI" [fields]="filterFields" [filters]="colF" (change)="page=1"></app-filtre-panel>

    <div class="card"><div class="card-body" style="padding:0">
      <div *ngIf="loading" class="spinner"></div>
      <div *ngIf="!loading && voyagesFiltres().length===0" class="empty">
        <i class="fa-solid fa-truck-fast"></i> Aucun voyage
      </div>
      <div class="table-wrap" *ngIf="!loading && voyagesFiltres().length">
        <table>
          <thead>
            <tr>
            <th appSortable="id" [(state)]="sortState">ID</th>
            <th appSortable="dateVoyage" [(state)]="sortState">Date</th>
            <th appSortable="chauffeur" [(state)]="sortState">Chauffeur</th>
            <th appSortable="nbLivraisons" [(state)]="sortState">Livraisons</th>
            <th appSortable="nbMatieres" [(state)]="sortState">Mat. premières</th>
            <th appSortable="statut" [(state)]="sortState">Statut</th>
            <th></th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let v of voyagesFiltres() | sortBy:sortState | paginate:page:pageSize">
              <td><code>#{{ v.id }}</code></td>
              <td>{{ v.dateVoyage ? (v.dateVoyage | date:'dd/MM/yy HH:mm') : '—' }}</td>
              <td>{{ v.chauffeur || '—' }}</td>
              <td><span class="badge badge-gray">{{ v.nbLivraisons ?? 0 }}</span></td>
              <td><span class="badge badge-blue">{{ v.nbMatieres ?? 0 }}</span></td>
              <td><span [ngClass]="v.statut | statutBadge">{{ v.statut || '—' }}</span></td>
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
      <div class="modal" style="max-width:min(1280px,96vw)" (click)="$event.stopPropagation()">
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

              <!-- Nouvelle saisie : résumé de la ligne (l'édition se fait dans la modale) -->
              <div *ngIf="nouvelleSaisie" style="display:flex;align-items:center;gap:12px">
                <div style="flex:1">
                  <strong>{{ lg.filtreChantier || ('Ligne ' + (i + 1)) }}</strong>
                  <div class="muted" style="font-size:12px">
                    {{ selectedLivCount(lg) }} ordre(s) de fab. · {{ selectedMpCount(lg) }} matière(s)
                    <span *ngIf="lg.chargementJour"> · chargement {{ lg.chargementJour }} {{ lg.chargementHeure || '' }}</span>
                  </div>
                </div>
                <button class="btn btn-outline btn-sm" (click)="modifierLigne(i)"><i class="fa-solid fa-pen"></i> Modifier</button>
                <button class="btn btn-danger btn-sm" (click)="retirerLigne(i)" title="Retirer"><i class="fa-solid fa-trash"></i></button>
              </div>

              <!-- Ancienne saisie : éditeur en ligne -->
              <ng-container *ngIf="!nouvelleSaisie">
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
                <!-- Ordre de fabrication : livraisons de ce chantier (repliable, fermé par défaut) -->
                <ng-container *ngIf="ofActif">
                <h5 class="ligne-section clic" (click)="lg.ofOuvert = !lg.ofOuvert">
                  <i class="fa-solid" [ngClass]="lg.ofOuvert ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
                  <i class="fa-solid fa-boxes-stacked"></i> Ordre de fabrication
                  <span class="muted">({{ selectedLivCount(lg) }} sélectionné(s))</span></h5>
                <div class="art-list full" *ngIf="lg.ofOuvert">
                  <div *ngIf="livraisonsDuChantier(lg).length===0" class="muted" style="font-size:12px;padding:8px">Aucune livraison pour ce chantier.</div>
                  <label class="art-item" *ngFor="let l of livraisonsDuChantier(lg)" [class.checked]="lg.selectedLiv[l.id]">
                    <input type="checkbox" [(ngModel)]="lg.selectedLiv[l.id]">
                    <div class="art-info"><strong>#{{ l.id }}</strong>
                      <span class="muted">{{ l.nbArticles }} article(s) · {{ l.statutReception || '—' }}</span></div>
                  </label>
                </div>
                </ng-container>

                <!-- Matières premières : commande de ce chantier -> lignes (repliable, fermé par défaut) -->
                <ng-container *ngIf="mpActif">
                <h5 class="ligne-section clic" (click)="lg.mpOuvert = !lg.mpOuvert">
                  <i class="fa-solid" [ngClass]="lg.mpOuvert ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
                  <i class="fa-solid fa-cubes"></i> Matières premières
                  <span class="muted">({{ selectedMpCount(lg) }} sélectionnée(s))</span></h5>
                <div *ngIf="lg.mpOuvert">
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
                </ng-container>

                <!-- Stock : dépôt -> articles disponibles (repliable) -->
                <ng-container *ngIf="stockActif">
                <h5 class="ligne-section clic" (click)="lg.stockOuvert = !lg.stockOuvert">
                  <i class="fa-solid" [ngClass]="lg.stockOuvert ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
                  <i class="fa-solid fa-warehouse"></i> Stock
                  <span class="muted">({{ selectedStockCount(lg) }} sélectionné(s))</span></h5>
                <div *ngIf="lg.stockOuvert">
                  <div class="field" style="margin-bottom:8px"><label>Dépôt</label>
                    <select [(ngModel)]="lg.depotStock" (change)="chargerArticlesStock(lg)">
                      <option [ngValue]="undefined" disabled>— Choisir un dépôt —</option>
                      <option *ngFor="let d of depotsStock" [ngValue]="d">{{ d }}</option>
                    </select>
                  </div>
                  <input *ngIf="lg.depotStock && !lg.loadingStock" class="filtre-input" [(ngModel)]="lg.filtreStock"
                         (ngModelChange)="majArticlesStockView(lg)" placeholder="🔍 Chercher un article…" style="margin-bottom:6px">
                  <div *ngIf="lg.loadingStock" class="spinner" style="margin:12px auto"></div>
                  <div *ngIf="lg.depotStock && !lg.loadingStock" class="muted" style="font-size:12px;padding:0 0 4px">
                    Articles disponibles — {{ lg.articlesStockFiltered?.length || 0 }} article(s)</div>
                  <div class="art-list full" *ngIf="lg.depotStock && !lg.loadingStock">
                    <div *ngIf="(lg.articlesStockFiltered?.length || 0)===0" class="muted" style="font-size:12px;padding:8px">Aucun article en stock.</div>
                    <div class="art-item" *ngFor="let a of lg.articlesStockView; trackBy: trackStock" [class.checked]="lg.selectedStock?.[a.reference||'']">
                      <input type="checkbox" [(ngModel)]="lg.selectedStock![a.reference||'']" (change)="onToggleStock(lg, a)">
                      <div class="art-info"><strong>{{ a.designation || a.reference }}</strong>
                        <span class="muted">{{ a.reference }} · {{ a.unite || '' }} · stock {{ a.stockDisponible ?? '—' }}</span></div>
                      <input *ngIf="lg.selectedStock?.[a.reference||'']" type="number" min="1" step="any" class="qte-input"
                             [(ngModel)]="lg.qteStock![a.reference||'']" placeholder="Qté">
                    </div>
                  </div>
                  <div *ngIf="stockNbPages(lg) > 1" style="display:flex;align-items:center;gap:10px;justify-content:center;margin-top:6px">
                    <button type="button" class="btn btn-outline" [disabled]="(lg.stockPage || 0) === 0" (click)="stockPagePrecedente(lg)">‹</button>
                    <span class="muted" style="font-size:12px">Page {{ (lg.stockPage || 0) + 1 }} / {{ stockNbPages(lg) }}</span>
                    <button type="button" class="btn btn-outline" [disabled]="(lg.stockPage || 0) >= stockNbPages(lg) - 1" (click)="stockPageSuivante(lg)">›</button>
                  </div>
                </div>
                </ng-container>
              </div>
              </ng-container>
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
      <div class="modal" style="max-width:min(1100px,96vw)" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>{{ ligneEditIndex===null ? 'Ajouter une ligne' : 'Modifier la ligne' }}</h3>
          <button class="x" (click)="ligneModal=false">&times;</button></div>
        <div class="m-body">
          <div class="field"><label>Chantier *</label>
            <ng-select [items]="chantiers" bindValue="id" bindLabel="nom" [(ngModel)]="ligneDraft.chantierId"
                       (change)="onDraftChantier()" [searchable]="true" [searchFn]="rechercheChantier"
                       placeholder="Rechercher un chantier (nom, ville, code)" notFoundText="Aucun chantier">
              <ng-template ng-label-tmp let-item="item">{{ item.nom }}<span *ngIf="item.ville" class="muted"> — {{ item.ville }}</span></ng-template>
              <ng-template ng-option-tmp let-item="item">{{ item.nom }}<span *ngIf="item.ville" class="muted"> — {{ item.ville }}</span><span *ngIf="item.code" class="muted"> · {{ item.code }}</span></ng-template>
            </ng-select>
          </div>
          <div class="form-grid">
            <div class="field"><label>Chargement prévu (jour)</label><input type="date" [(ngModel)]="ligneDraft.chargementJour"></div>
            <div class="field"><label>Heure</label><input type="time" [(ngModel)]="ligneDraft.chargementHeure"></div>
            <div class="field"><label>Déchargement prévu (jour)</label><input type="date" [(ngModel)]="ligneDraft.dechargementJour"></div>
            <div class="field"><label>Heure</label><input type="time" [(ngModel)]="ligneDraft.dechargementHeure"></div>
          </div>

          <div *ngIf="!ligneDraft.chantierId" class="muted" style="font-size:12px;padding:8px">Choisissez d'abord un chantier.</div>

          <div *ngIf="ligneDraft.chantierId">
            <!-- ═══ Ordre de fabrication : clic sur l'entête → table + ng-select ═══ -->
            <ng-container *ngIf="ofActif">
            <h5 class="ligne-section clic" (click)="ligneDraft.ofOuvert = !ligneDraft.ofOuvert">
              <i class="fa-solid" [ngClass]="ligneDraft.ofOuvert ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
              <i class="fa-solid fa-boxes-stacked"></i> Ordre de fabrication
              <span class="muted">({{ selectedLivCount(ligneDraft) }} sélectionné(s))</span></h5>
            <div *ngIf="ligneDraft.ofOuvert">
              <ng-select [items]="ligneDraft.livrDispo || []" bindValue="id" [multiple]="true"
                         [closeOnSelect]="false" [searchFn]="rechercheLivraison"
                         [ngModel]="ligneDraft.selLivIds || []" (ngModelChange)="onSelLivChange(ligneDraft, $event)"
                         placeholder="Sélectionner une ou plusieurs livraisons"
                         notFoundText="Aucune livraison" clearAllText="Effacer" style="margin-bottom:8px">
                <ng-template ng-label-tmp let-item="item">#{{ item.id }}</ng-template>
                <ng-template ng-option-tmp let-item="item">
                  #{{ item.id }} — {{ item.nbArticles }} article(s)<span class="muted"> · {{ item.statutReception || '—' }}</span></ng-template>
              </ng-select>
              <div *ngIf="!(ligneDraft.livrDispo?.length)" class="muted" style="font-size:12px;padding:8px">
                Aucune livraison pour ce chantier.</div>
              <div class="table-wrap pick-table" *ngIf="ligneDraft.livrDispo?.length">
                <table>
                  <thead><tr><th style="width:38px"></th><th>N° OF</th><th>Articles</th><th>Statut</th></tr></thead>
                  <tbody>
                    <tr *ngFor="let l of ligneDraft.livrDispo" class="row-link"
                        [class.row-active]="ligneDraft.selectedLiv[l.id]" (click)="toggleLiv(ligneDraft, l.id)">
                      <td (click)="$event.stopPropagation()"><input type="checkbox"
                          [checked]="!!ligneDraft.selectedLiv[l.id]" (change)="toggleLiv(ligneDraft, l.id)"></td>
                      <td><code>#{{ l.id }}</code></td>
                      <td>{{ l.nbArticles }}</td>
                      <td><span [ngClass]="l.statutReception | statutBadge">{{ l.statutReception || '—' }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            </ng-container>

            <!-- MP sauvegardées d'autres commandes -->
            <div *ngIf="mpActif && ligneDraft.mpSauvegardes?.length" style="margin:6px 0;padding:8px;background:#f0faf0;border-radius:8px;border:1px solid #c3e6c3">
              <span class="muted" style="font-size:11px"><i class="fa-solid fa-circle-check" style="color:#21ba45;margin-right:4px"></i>
                {{ ligneDraft.mpSauvegardes.length }} matière(s) conservée(s) depuis d'autres commandes :</span>
              <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
                <span *ngFor="let s of ligneDraft.mpSauvegardes" class="badge badge-green" style="font-size:10px">
                  {{ s.m.designation || s.m.reference }}
                  <button style="background:none;border:none;cursor:pointer;color:inherit;margin-left:4px;padding:0;line-height:1"
                          (click)="retirerMpSauvegardee(ligneDraft, s.m.reference)">×</button>
                </span>
              </div>
            </div>
            <!-- ═══ Matières premières : clic sur l'entête → commande (ng-select) + table ═══ -->
            <ng-container *ngIf="mpActif">
            <h5 class="ligne-section clic" (click)="ligneDraft.mpOuvert = !ligneDraft.mpOuvert">
              <i class="fa-solid" [ngClass]="ligneDraft.mpOuvert ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
              <i class="fa-solid fa-cubes"></i> Matières premières
              <span class="muted">({{ selectedMpCount(ligneDraft) }} sélectionnée(s))</span></h5>
            <div *ngIf="ligneDraft.mpOuvert">
              <div class="field" style="margin-bottom:8px"><label>Commande</label>
                <ng-select [items]="ligneDraft.commandes" bindValue="cdno" [(ngModel)]="ligneDraft.commandeId"
                           (change)="chargerLignesMp(ligneDraft)" [searchable]="true" [clearable]="true" [searchFn]="rechercheCommande"
                           placeholder="Choisir une commande" notFoundText="Aucune commande" clearAllText="Effacer">
                  <ng-template ng-label-tmp let-item="item">
                    #{{ item.cdno }}<span *ngIf="item.tiers"> · {{ item.tiers }}</span></ng-template>
                  <ng-template ng-option-tmp let-item="item">
                    #{{ item.cdno }}<span *ngIf="item.tiers"> · {{ item.tiers }}</span><span *ngIf="item.pieceFournisseur" class="muted"> · {{ item.pieceFournisseur }}</span></ng-template>
                </ng-select>
              </div>
              <input *ngIf="ligneDraft.commandeId && !ligneDraft.loadingMp" class="filtre-input"
                     [(ngModel)]="ligneDraft.filtreLignesMp" placeholder="🔍 Filtrer les lignes (désignation, réf)…">
              <div *ngIf="ligneDraft.loadingMp" class="spinner" style="margin:12px auto"></div>
              <div class="table-wrap pick-table" *ngIf="ligneDraft.commandeId && !ligneDraft.loadingMp && lignesMpFiltrees(ligneDraft).length">
                <table>
                  <thead><tr><th style="width:38px"></th><th>Désignation</th><th>Référence</th><th>Dispo</th><th style="width:90px">Qté</th></tr></thead>
                  <tbody>
                    <tr *ngFor="let m of lignesMpFiltrees(ligneDraft)" [class.row-active]="ligneDraft.selectedMp[m.reference||'']">
                      <td><input type="checkbox" [(ngModel)]="ligneDraft.selectedMp[m.reference||'']" (change)="onToggleMp(ligneDraft, m)"></td>
                      <td><strong>{{ m.designation || m.reference }}</strong></td>
                      <td><code>{{ m.reference }}</code></td>
                      <td>{{ m.quantite ?? '—' }}</td>
                      <td><input *ngIf="ligneDraft.selectedMp[m.reference||'']" type="number" min="1" step="any" class="qte-input"
                                 [(ngModel)]="ligneDraft.qteMp[m.reference||'']" placeholder="Qté"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div *ngIf="ligneDraft.commandeId && !ligneDraft.loadingMp && lignesMpFiltrees(ligneDraft).length===0"
                   class="muted" style="font-size:12px;padding:8px">Aucune ligne.</div>
            </div>
            </ng-container>

            <!-- ═══ Stock : clic sur l'entête → dépôt + articles disponibles ═══ -->
            <ng-container *ngIf="stockActif">
            <h5 class="ligne-section clic" (click)="ligneDraft.stockOuvert = !ligneDraft.stockOuvert">
              <i class="fa-solid" [ngClass]="ligneDraft.stockOuvert ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
              <i class="fa-solid fa-warehouse"></i> Stock
              <span class="muted">({{ selectedStockCount(ligneDraft) }} sélectionné(s))</span></h5>
            <div *ngIf="ligneDraft.stockOuvert">
              <div class="field" style="margin-bottom:8px"><label>Dépôt</label>
                <select [(ngModel)]="ligneDraft.depotStock" (change)="chargerArticlesStock(ligneDraft)">
                  <option [ngValue]="undefined" disabled>— Choisir un dépôt —</option>
                  <option *ngFor="let d of depotsStock" [ngValue]="d">{{ d }}</option>
                </select>
                <div *ngIf="depotsStock.length===0" class="muted" style="font-size:11px;margin-top:4px">
                  Aucun dépôt de stock disponible.</div>
              </div>
              <input *ngIf="ligneDraft.depotStock && !ligneDraft.loadingStock" class="filtre-input"
                     [(ngModel)]="ligneDraft.filtreStock" (ngModelChange)="majArticlesStockView(ligneDraft)"
                     placeholder="🔍 Chercher un article (désignation, réf)…">
              <div *ngIf="ligneDraft.loadingStock" class="spinner" style="margin:12px auto"></div>
              <div *ngIf="ligneDraft.depotStock && !ligneDraft.loadingStock" class="muted" style="font-size:12px;margin:4px 0">
                Articles disponibles — {{ ligneDraft.articlesStockFiltered?.length || 0 }} article(s)</div>
              <div class="table-wrap pick-table" *ngIf="ligneDraft.depotStock && !ligneDraft.loadingStock && (ligneDraft.articlesStockView?.length || 0)">
                <table>
                  <thead><tr><th style="width:38px"></th><th>Référence</th><th>Désignation</th><th>Unité</th><th>Stock disponible</th><th style="width:90px">Quantité</th></tr></thead>
                  <tbody>
                    <tr *ngFor="let a of ligneDraft.articlesStockView; trackBy: trackStock" [class.row-active]="ligneDraft.selectedStock?.[a.reference||'']">
                      <td><input type="checkbox" [(ngModel)]="ligneDraft.selectedStock![a.reference||'']" (change)="onToggleStock(ligneDraft, a)"></td>
                      <td><code>{{ a.reference }}</code></td>
                      <td><strong>{{ a.designation || a.reference }}</strong></td>
                      <td>{{ a.unite || '—' }}</td>
                      <td>{{ a.stockDisponible ?? '—' }}</td>
                      <td><input *ngIf="ligneDraft.selectedStock?.[a.reference||'']" type="number" min="1" step="any" class="qte-input"
                                 [(ngModel)]="ligneDraft.qteStock![a.reference||'']" placeholder="Qté"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div *ngIf="stockNbPages(ligneDraft) > 1" style="display:flex;align-items:center;gap:10px;justify-content:center;margin-top:6px">
                <button type="button" class="btn btn-outline" [disabled]="(ligneDraft.stockPage || 0) === 0" (click)="stockPagePrecedente(ligneDraft)">‹</button>
                <span class="muted" style="font-size:12px">Page {{ (ligneDraft.stockPage || 0) + 1 }} / {{ stockNbPages(ligneDraft) }}</span>
                <button type="button" class="btn btn-outline" [disabled]="(ligneDraft.stockPage || 0) >= stockNbPages(ligneDraft) - 1" (click)="stockPageSuivante(ligneDraft)">›</button>
              </div>
              <div *ngIf="ligneDraft.depotStock && !ligneDraft.loadingStock && (ligneDraft.articlesStockFiltered?.length || 0)===0"
                   class="muted" style="font-size:12px;padding:8px">Aucun article en stock pour ce dépôt.</div>
            </div>
            </ng-container>
          </div>
        </div>
        <div class="m-foot">
          <button class="btn btn-outline" (click)="ligneModal=false">Annuler</button>
          <button class="btn btn-primary" (click)="validerLigne()" [disabled]="!ligneDraft.chantierId">
            <i class="fa-solid fa-check"></i> {{ ligneEditIndex===null ? 'Ajouter la ligne' : 'Enregistrer la ligne' }}</button>
        </div>
      </div>
    </div>

    <!-- ════════ Modal RÉCAPITULATIF avant enregistrement ════════ -->
    <div class="modal-backdrop" *ngIf="recap" (click)="fermerRecap($event)" style="z-index:1200">
      <div class="modal" style="max-width:min(820px,96vw)" (click)="$event.stopPropagation()">
        <div class="m-head"><h3><i class="fa-solid fa-clipboard-check"></i> Récapitulatif du voyage</h3>
          <button class="x" (click)="recap=false">&times;</button></div>
        <div class="m-body">
          <p class="muted" style="margin:0 0 12px;font-size:12px">
            <i class="fa-solid fa-circle-info"></i> Vérifiez le détail ci-dessous puis confirmez l'enregistrement.
          </p>
          <div class="detail-grid">
            <div><span class="dk">Chauffeur</span><span class="dv">{{ filtreChauffeur || '—' }}</span></div>
            <div><span class="dk">Local de départ</span><span class="dv">{{ form.localNom || '—' }}</span></div>
            <div><span class="dk">Lignes</span><span class="dv">{{ lignes.length }}</span></div>
          </div>

          <h4 class="art-title">Lignes du voyage ({{ lignes.length }})</h4>
          <div *ngIf="lignes.length===0" class="empty" style="padding:16px">
            <i class="fa-solid fa-layer-group"></i> Aucune ligne ajoutée</div>

          <div *ngFor="let lg of lignes; let i = index" class="card" style="margin-bottom:12px">
            <div class="card-body">
              <strong>{{ lg.filtreChantier || ('Ligne ' + (i + 1)) }}</strong>
              <div class="muted" style="font-size:12px;margin:2px 0 8px">
                <span *ngIf="lg.chargementJour">Chargement {{ lg.chargementJour }} {{ lg.chargementHeure || '' }}</span>
                <span *ngIf="lg.dechargementJour"> · Déchargement {{ lg.dechargementJour }} {{ lg.dechargementHeure || '' }}</span>
                <span *ngIf="!lg.chargementJour && !lg.dechargementJour">Aucune date planifiée</span>
              </div>

              <div *ngIf="selectedLivCount(lg)" style="margin-bottom:8px">
                <span class="dk">Livraisons ({{ selectedLivCount(lg) }})</span>
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
                  <span class="badge badge-gray" *ngFor="let id of selectedLivArray(lg)">#{{ id }}</span>
                </div>
              </div>

              <div *ngIf="selectedMpCount(lg)">
                <span class="dk">Matières premières ({{ selectedMpCount(lg) }})</span>
                <div class="table-wrap" style="margin-top:4px">
                  <table>
                    <thead><tr><th>Désignation</th><th>Référence</th><th>Qté</th></tr></thead>
                    <tbody>
                      <tr *ngFor="let m of selectedMpLignes(lg)">
                        <td><strong>{{ m.designation || m.reference }}</strong></td>
                        <td><code>{{ m.reference }}</code></td>
                        <td>{{ lg.qteMp[m.reference || ''] || 1 }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div *ngIf="selectedStockCount(lg)">
                <span class="dk">Stock — dépôt {{ lg.depotStock }} ({{ selectedStockCount(lg) }})</span>
                <div class="table-wrap" style="margin-top:4px">
                  <table>
                    <thead><tr><th>Désignation</th><th>Référence</th><th>Unité</th><th>Qté</th></tr></thead>
                    <tbody>
                      <tr *ngFor="let a of selectedStockLignes(lg)">
                        <td><strong>{{ a.designation || a.reference }}</strong></td>
                        <td><code>{{ a.reference }}</code></td>
                        <td>{{ a.unite || '—' }}</td>
                        <td>{{ lg.qteStock?.[a.reference || ''] || 1 }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div *ngIf="!selectedLivCount(lg) && !selectedMpCount(lg) && !selectedStockCount(lg)" class="muted" style="font-size:12px">
                Aucun ordre de fabrication, matière première ni article de stock sélectionné.</div>
            </div>
          </div>
        </div>
        <div class="m-foot">
          <button class="btn btn-outline" (click)="recap=false"><i class="fa-solid fa-arrow-left"></i> Retour</button>
          <button class="btn btn-primary" (click)="confirmerEnregistrement()" [disabled]="saving">
            <i class="fa-solid fa-floppy-disk"></i> Confirmer et enregistrer</button>
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
            <div><span class="dk">Statut</span><span class="dv"><span [ngClass]="detail.statut | statutBadge">{{ detail.statut || '—' }}</span></span></div>
            <div><span class="dk">Local de départ</span><span class="dv">{{ detail.localNom || '—' }}</span></div>
          </div>

          <!-- Dates du voyage : lecture + bouton Modifier -->
          <div *ngIf="!editDates" style="margin-top:10px">
            <div class="detail-grid">
              <div><span class="dk">Chargement prévu</span><span class="dv">{{ chargementPrevu() ? (chargementPrevu() | date:'dd/MM/yy HH:mm') : '—' }}</span></div>
              <div><span class="dk">Chargement réel</span><span class="dv">{{ detail.realChargement ? (detail.realChargement | date:'dd/MM/yy HH:mm') : '—' }}</span></div>
              <div><span class="dk">Déchargement prévu</span><span class="dv">{{ dechargementPrevu() ? (dechargementPrevu() | date:'dd/MM/yy HH:mm') : '—' }}</span></div>
              <div><span class="dk">Déchargement réel</span><span class="dv">{{ detail.realDechargement ? (detail.realDechargement | date:'dd/MM/yy HH:mm') : '—' }}</span></div>
            </div>
            <button class="btn btn-outline btn-sm" style="margin-top:8px" (click)="ouvrirEditDates()">
              <i class="fa-solid fa-pen"></i> Modifier les dates</button>
          </div>

          <!-- Dates : formulaire d'édition -->
          <div *ngIf="editDates" style="margin-top:10px;padding:12px;border:1px solid var(--border);border-radius:10px;background:#faf9fb">
            <h5 style="margin:0 0 10px;font-size:13px;font-weight:700">Modifier les dates</h5>
            <div class="form-grid">
              <div class="field"><label>Chargement prévu — jour</label><input type="date" [(ngModel)]="datesForm.chJour"></div>
              <div class="field"><label>Heure</label><input type="time" [(ngModel)]="datesForm.chHeure"></div>
              <div class="field"><label>Déchargement prévu — jour</label><input type="date" [(ngModel)]="datesForm.deJour"></div>
              <div class="field"><label>Heure</label><input type="time" [(ngModel)]="datesForm.deHeure"></div>
            </div>
            <div class="form-grid" style="margin-top:6px">
              <div class="field"><label>Chargement réel — jour</label><input type="date" [(ngModel)]="datesForm.rChJour"></div>
              <div class="field"><label>Heure</label><input type="time" [(ngModel)]="datesForm.rChHeure"></div>
              <div class="field"><label>Déchargement réel — jour</label><input type="date" [(ngModel)]="datesForm.rDeJour"></div>
              <div class="field"><label>Heure</label><input type="time" [(ngModel)]="datesForm.rDeHeure"></div>
            </div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <button class="btn btn-outline btn-sm" (click)="editDates=false">Annuler</button>
              <button class="btn btn-primary btn-sm" (click)="enregistrerDates()" [disabled]="savingDates">
                <i class="fa-solid fa-floppy-disk"></i> Enregistrer</button>
            </div>
          </div>

          <!-- QR du voyage : un seul scan vaut le scan de toutes les lignes -->
          <div style="display:flex;align-items:center;gap:14px;margin-top:12px;padding:12px;border:1px solid var(--border);border-radius:10px">
            <img [src]="qrVoyageUrl(detail.id)" alt="QR voyage" style="width:96px;height:96px;cursor:zoom-in"
                 title="Voir le QR" (click)="voirQr(qrVoyageUrl(detail.id), 'QR voyage #' + detail.id, 'qr-voyage-' + detail.id)">
            <div style="flex:1">
              <strong>QR du voyage</strong>
              <div class="muted" style="font-size:12px">Scanné par le chauffeur, il valide toutes les lignes du voyage en une fois.</div>
              <button class="btn btn-outline btn-sm" style="margin-top:6px"
                      (click)="voirQr(qrVoyageUrl(detail.id), 'QR voyage #' + detail.id, 'qr-voyage-' + detail.id)">
                <i class="fa-solid fa-eye"></i> Voir / Télécharger</button>
            </div>
            <!-- Code de forçage d'arrivée (au niveau du voyage conteneur) -->
            <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
              <span class="dk" style="font-size:11px">Code de forçage</span>
              <strong style="font-size:14px">{{ (detail.forceCode || '—') }}</strong>
              <button class="btn btn-outline btn-sm"
                      (click)="regenererForce()" [disabled]="regenForce || detail.statut === 'ANNULE'">
                <i class="fa-solid fa-rotate"></i> Régénérer</button>
            </div>
          </div>

          <h4 class="art-title">Lignes du voyage ({{ livraisonsGroupees().length }})</h4>
          <div *ngIf="detailLoading" class="spinner" style="margin:20px auto"></div>
          <div *ngIf="!detailLoading && detailLivraisons.length===0 && detailMatieres.length===0"
               class="empty" style="padding:16px">
            <i class="fa-solid fa-box"></i> Aucune livraison rattachée</div>

          <!-- Groupes par chantier : livraisons + MP affichées UNE SEULE FOIS -->
          <div *ngFor="let grp of livraisonsGroupees()" style="margin-bottom:16px;border:1px solid var(--border);border-radius:12px;overflow:hidden">

            <!-- En-tête du groupe -->
            <div style="padding:10px 14px;background:#f5f3ff;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)">
              <i class="fa-solid fa-location-dot" style="color:var(--accent-dark)"></i>
              <strong style="flex:1">{{ grp.label }}</strong>
              <span class="badge badge-gray">{{ grp.livraisons.length }} OF</span>
              <span *ngIf="mpDe(grp.matieres).length" class="badge badge-blue">{{ mpDe(grp.matieres).length }} MP</span>
              <span *ngIf="stockDe(grp.matieres).length" class="badge badge-green">{{ stockDe(grp.matieres).length }} Stock</span>
              <!-- QR code de la ligne complète (groupe) -->
              <img *ngIf="grp.livraisons.length > 0" [src]="qrLivraisonUrl(grp.livraisons[0].id)" alt="QR ligne"
                   style="width:36px;height:36px;vertical-align:middle;cursor:zoom-in"
                   (click)="voirQr(qrLivraisonUrl(grp.livraisons[0].id), 'QR ligne ' + grp.label, 'qr-ligne-' + grp.code)">
              <button class="btn btn-outline btn-sm" *ngIf="grp.livraisons.length > 0"
                      (click)="voirQr(qrLivraisonUrl(grp.livraisons[0].id), 'QR ligne ' + grp.label, 'qr-ligne-' + grp.code)">
                <i class="fa-solid fa-qrcode"></i></button>
            </div>

            <!-- Livraisons du groupe -->
            <div *ngFor="let l of grp.livraisons; let last=last" style="border-bottom:1px solid var(--border)">
              <div class="row-link" (click)="openLivId = openLivId===l.id ? null : l.id"
                   style="display:flex;align-items:center;gap:8px;padding:12px 14px">
                <i class="fa-solid" [ngClass]="openLivId===l.id ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
                <strong>#{{ l.id }}</strong>
                <span [ngClass]="l.statutReception | statutBadge">{{ l.statutReception || '—' }}</span>
                <span style="margin-left:auto;display:flex;gap:6px" (click)="$event.stopPropagation()">
                  <button *ngIf="(blsParLivraison[l.id]?.length ?? 0) > 0" class="btn btn-outline btn-sm"
                          (click)="openLivId = l.id" title="Voir les bons de livraison">
                    <i class="fa-solid fa-file-lines"></i> BL
                    <span class="badge badge-blue" style="margin-left:4px">{{ blsParLivraison[l.id].length }}</span>
                  </button>
                  <button class="btn btn-outline btn-sm" (click)="annulerLigneWeb(l)"
                          [disabled]="estScanne(detail) || l.statutReception === 'ANNULE'"
                          [ngClass]="l.statutReception === 'ANNULE' ? 'btn-gray' : ''"
                          [title]="l.statutReception === 'ANNULE' ? 'Livraison annulée' : 'Annuler la livraison'">
                    <i class="fa-solid fa-ban"></i> {{ l.statutReception === 'ANNULE' ? 'Annulée' : 'Annuler' }}</button>
                  <button class="btn btn-danger btn-sm" (click)="detacher(l)"
                          [disabled]="estScanne(detail) || livraisonScannee(l)"
                          [title]="(estScanne(detail) || livraisonScannee(l)) ? 'Scannée : modification impossible' : 'Retirer du voyage'">
                    <i class="fa-solid fa-link-slash"></i> Retirer</button>
                </span>
              </div>

              <div *ngIf="openLivId===l.id" style="padding:0 14px 12px">
                <!-- Articles -->
                <div class="table-wrap" *ngIf="contenu[l.id]?.articles?.length" style="margin-top:8px">
                  <table>
                    <thead><tr><th>Article</th><th>Qté</th><th>Statut</th><th>QR</th></tr></thead>
                    <tbody>
                      <ng-container *ngFor="let a of contenu[l.id].articles">
                        <tr class="row-link" (click)="artDetailId = artDetailId===a.id ? null : a.id">
                          <td><strong>{{ a.designation || '—' }}</strong></td>
                          <td>{{ a.quantite ?? '—' }}</td>
                          <td><span [ngClass]="a.statutReception | statutBadge">{{ a.statutReception || '—' }}</span></td>
                          <td style="white-space:nowrap" (click)="$event.stopPropagation()">
                            <img [src]="qrArticleUrl(a.id)" alt="QR" style="width:48px;height:48px;vertical-align:middle;cursor:zoom-in"
                                 (click)="voirQr(qrArticleUrl(a.id), 'QR article #' + a.id, 'qr-article-' + a.id)">
                            <button class="btn btn-outline btn-sm" style="margin-left:6px"
                                    (click)="voirQr(qrArticleUrl(a.id), 'QR article #' + a.id, 'qr-article-' + a.id)">
                              <i class="fa-solid fa-eye"></i></button>
                          </td>
                        </tr>
                        <tr *ngIf="artDetailId===a.id">
                          <td colspan="4" class="muted" style="font-size:12px;background:#faf9fb">
                            N° prix : <code>{{ a.numPrix || '—' }}</code> ·
                            Projet : {{ a.projet || '—' }} ·
                            Heure scan : {{ a.heureScan ? (a.heureScan | date:'dd/MM/yy HH:mm:ss') : '—' }}
                          </td>
                        </tr>
                      </ng-container>
                    </tbody>
                  </table>
                </div>
                <div *ngIf="!contenu[l.id]?.articles?.length" class="muted" style="margin-top:6px;font-size:12px">Aucun article</div>

                <!-- BL par livraison -->
                <div style="margin-top:10px">
                  <h5 style="margin:0 0 6px;font-size:13px;font-weight:700">
                    <i class="fa-solid fa-file-lines" style="margin-right:6px;color:var(--accent-dark)"></i>
                    Bons de livraison ({{ blsParLivraison[l.id]?.length ?? '?' }})</h5>
                  <div *ngIf="!blsParLivraison[l.id]" class="muted" style="font-size:12px">Chargement…</div>
                  <div *ngIf="blsParLivraison[l.id]?.length===0" class="muted" style="font-size:12px">Aucun BL enregistré.</div>
                  <div *ngFor="let bl of (blsParLivraison[l.id] ?? [])"
                       style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
                    <i class="fa-solid fa-file-image" style="color:var(--accent)"></i>
                    <span style="flex:1;font-size:13px">{{ bl.reference || ('BL #' + bl.id) }}</span>
                    <span class="badge badge-gray" style="font-size:10px">{{ bl.contentType?.includes('pdf') ? 'PDF' : 'Image' }}</span>
                    <a [href]="svc.blUrl(l.id, bl.id)" target="_blank" rel="noopener" class="btn btn-outline btn-sm" title="Afficher"><i class="fa-solid fa-eye"></i></a>
                    <a [href]="svc.blUrl(l.id, bl.id, true)" class="btn btn-outline btn-sm" title="Télécharger"><i class="fa-solid fa-download"></i></a>
                  </div>
                  <div *ngIf="blUploadLivId !== l.id" style="margin-top:8px">
                    <button class="btn btn-outline btn-sm" (click)="blUploadLivId=l.id;blUploadRef='';blUploadFile=null">
                      <i class="fa-solid fa-plus"></i> Ajouter un BL</button>
                  </div>
                  <div *ngIf="blUploadLivId===l.id" style="margin-top:8px;padding:10px;background:#faf9fb;border-radius:8px;border:1px solid var(--border)">
                    <div class="form-grid" style="margin-bottom:8px">
                      <div class="field"><label>Référence (optionnel)</label><input [(ngModel)]="blUploadRef" placeholder="Réf BL…"></div>
                      <div class="field"><label>Fichier</label><input type="file" accept="image/*,application/pdf" (change)="onBlFileChange($event)"></div>
                    </div>
                    <div style="display:flex;gap:8px">
                      <button class="btn btn-outline btn-sm" (click)="blUploadLivId=null">Annuler</button>
                      <button class="btn btn-primary btn-sm" (click)="uploaderBl(l.id)" [disabled]="blUploading||!blUploadFile">
                        <i class="fa-solid fa-upload"></i> {{ blUploading ? 'Envoi…' : 'Envoyer' }}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Matières premières du groupe — affichées UNE SEULE FOIS, repliables ; statut piloté par le scan -->
            <ng-container *ngIf="mpDe(grp.matieres).length">
              <div style="border-top:1px solid var(--border)">
                <h5 class="ligne-section clic" style="margin:0;padding:10px 14px;background:#fdf8ff"
                    (click)="toggleMpGroup(grp.code)">
                  <i class="fa-solid" [ngClass]="mpGroupOpen(grp.code) ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
                  <i class="fa-solid fa-cubes"></i> Matières premières ({{ mpDe(grp.matieres).length }})
                  <span class="muted">· {{ mpLivrees(mpDe(grp.matieres)) }}/{{ mpDe(grp.matieres).length }} livrée(s)</span></h5>
                <div class="table-wrap" *ngIf="mpGroupOpen(grp.code)" style="padding:0 14px 12px;background:#fdf8ff">
                  <table>
                    <thead><tr><th>Désignation</th><th>Pièce fournisseur</th><th>Affaire</th>
                      <th>Qté cmd.</th><th>Qté livrée</th><th>Reste</th><th>Statut</th><th>QR</th></tr></thead>
                    <tbody>
                      <tr *ngFor="let m of mpDe(grp.matieres)" [class.row-done]="estLivree(m)">
                        <td><strong>{{ m.designation || '—' }}</strong>
                          <div class="muted" style="font-size:11px">Réf {{ m.reference || '—' }}</div></td>
                        <td><code>{{ m.pieceFournisseur || '—' }}</code></td>
                        <td>{{ m.projet || '—' }}</td>
                        <td>{{ m.qteCommande ?? '—' }}</td>
                        <td>{{ qteLivree(m) }}</td>
                        <td><strong>{{ resteALivrer(m) }}</strong></td>
                        <td><span class="badge" [ngClass]="statutMpClass(m)">{{ statutMpLabel(m) }}</span></td>
                        <td style="white-space:nowrap">
                          <img [src]="qrMatiereUrl(m.id)" alt="QR" style="width:48px;height:48px;vertical-align:middle;cursor:zoom-in"
                               (click)="voirQr(qrMatiereUrl(m.id), 'QR matière #' + m.id, 'qr-mp-' + m.id)">
                          <button class="btn btn-outline btn-sm" style="margin-left:6px"
                                  (click)="voirQr(qrMatiereUrl(m.id), 'QR matière #' + m.id, 'qr-mp-' + m.id)">
                            <i class="fa-solid fa-eye"></i></button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </ng-container>

            <!-- Stock du groupe — section DÉDIÉE (séparée des matières premières) -->
            <ng-container *ngIf="stockDe(grp.matieres).length">
              <div style="border-top:1px solid var(--border)">
                <h5 class="ligne-section clic" style="margin:0;padding:10px 14px;background:#f0fbf4"
                    (click)="toggleStockGroup(grp.code)">
                  <i class="fa-solid" [ngClass]="stockGroupOpen(grp.code) ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
                  <i class="fa-solid fa-warehouse"></i> Stock ({{ stockDe(grp.matieres).length }})
                  <span class="muted">· {{ mpLivrees(stockDe(grp.matieres)) }}/{{ stockDe(grp.matieres).length }} livré(s)</span></h5>
                <div class="table-wrap" *ngIf="stockGroupOpen(grp.code)" style="padding:0 14px 12px;background:#f0fbf4">
                  <table>
                    <thead><tr><th>Désignation</th><th>Référence</th><th>Dépôt</th><th>Affaire</th>
                      <th>Qté</th><th>Statut</th><th>QR</th></tr></thead>
                    <tbody>
                      <tr *ngFor="let m of stockDe(grp.matieres)" [class.row-done]="estLivree(m)">
                        <td><strong>{{ m.designation || '—' }}</strong></td>
                        <td><code>{{ m.reference || '—' }}</code></td>
                        <td><span class="badge badge-green">{{ m.depot || '—' }}</span></td>
                        <td>{{ m.projet || '—' }}</td>
                        <td>{{ m.quantite ?? '—' }}</td>
                        <td><span class="badge" [ngClass]="statutMpClass(m)">{{ statutMpLabel(m) }}</span></td>
                        <td style="white-space:nowrap">
                          <img [src]="qrMatiereUrl(m.id)" alt="QR" style="width:48px;height:48px;vertical-align:middle;cursor:zoom-in"
                               (click)="voirQr(qrMatiereUrl(m.id), 'QR stock #' + m.id, 'qr-stock-' + m.id)">
                          <button class="btn btn-outline btn-sm" style="margin-left:6px"
                                  (click)="voirQr(qrMatiereUrl(m.id), 'QR stock #' + m.id, 'qr-stock-' + m.id)">
                            <i class="fa-solid fa-eye"></i></button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </ng-container>

          </div><!-- fin groupe -->

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

    <!-- Aperçu d'un QR : voir en grand + télécharger PNG / PDF -->
    <div class="modal-backdrop" *ngIf="qrApercu" (click)="fermerQr()" style="z-index:1200">
      <div class="modal" style="max-width:420px" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>{{ qrApercu.titre }}</h3>
          <button class="x" (click)="fermerQr()">&times;</button></div>
        <div class="m-body" style="text-align:center">
          <img [src]="qrApercu.url" alt="QR" style="width:260px;height:260px;max-width:100%;border:1px solid var(--border);border-radius:8px;padding:8px;background:#fff">
        </div>
        <div class="m-foot" style="justify-content:center;gap:10px">
          <button class="btn btn-outline" (click)="telechargerQrPng()">
            <i class="fa-solid fa-image"></i> PNG</button>
          <button class="btn btn-primary" (click)="telechargerQrPdf()" [disabled]="qrPdfEnCours">
            <i class="fa-solid" [ngClass]="qrPdfEnCours ? 'fa-spinner fa-spin' : 'fa-file-pdf'"></i> PDF</button>
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
    /* Tables de sélection (OF / MP) dans la modale d'ajout de ligne */
    .pick-table { max-height: 300px; overflow-y: auto; margin-top: 6px; }
    .pick-table tr.row-link { cursor: pointer; }
    .pick-table tr.row-active { background: var(--primary-light); }
    .pick-table .qte-input { width: 90px; min-width: 90px; flex: none; }
    .pick-table input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--accent); }
  `]
})
export class VoyagesConteneursComponent implements OnInit {
  voyages: VoyageConteneur[] = [];
  loading = true;
  page = 1; pageSize = 10;
  q = '';
  sortState: SortState = { key: '', dir: 'asc' };
  vue: 'en-cours' | 'archives' | 'historique' = 'en-cours';
  filtresUI = false;
  colF: ColumnFilters = {};
  filterFields: FiltreField[] = [
    { key: 'id', label: 'ID', icon: 'fa-hashtag', placeholder: 'ID' },
    { key: 'dateVoyage', label: 'Date', icon: 'fa-calendar-day', placeholder: 'AAAA-MM-JJ' },
    { key: 'chauffeur', label: 'Chauffeur', icon: 'fa-id-card', placeholder: 'Chauffeur' },
    { key: 'nbLivraisons', label: 'Livraisons', icon: 'fa-truck-ramp-box', placeholder: 'Nombre' },
    { key: 'nbMatieres', label: 'Mat. premières', icon: 'fa-cubes', placeholder: 'Nombre' },
    { key: 'statut', label: 'Statut', icon: 'fa-flag', placeholder: 'Statut' },
  ];
  modal = false; saving = false;
  exporting = false;
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
  // Interrupteurs Administration : sections de contenu activables/désactivables à la saisie.
  ofActif = true;
  mpActif = true;
  stockActif = true;
  ligneModal = false;
  ligneDraft: VoyageLigne | null = null;
  ligneEditIndex: number | null = null;   // null = ajout ; sinon index de la ligne éditée
  /** Recherche ng-select pour le choix de commande (nouvelle saisie). */
  rechercheCommande = (term: string, item: CommandeMp): boolean => {
    const t = (term || '').toLowerCase();
    return `${item.cdno} ${item.tiers || ''} ${item.pieceFournisseur || ''} ${item.reference || ''} ${item.marche || ''}`
      .toLowerCase().includes(t);
  };
  /** Recherche ng-select pour le choix d'un chantier (nom, ville, code). */
  rechercheChantier = (term: string, item: Chantier): boolean => {
    const t = (term || '').toLowerCase();
    return `${item.nom || ''} ${item.ville || ''} ${item.code || ''}`.toLowerCase().includes(t);
  };
  /** Recherche ng-select pour le choix d'un ordre de fabrication (#OF, chantier, statut). */
  rechercheLivraison = (term: string, item: GapVoyage): boolean => {
    const t = (term || '').toLowerCase();
    return `#${item.id} ${item.projetDesignation || ''} ${item.statutReception || ''}`.toLowerCase().includes(t);
  };
  form: { localNom?: string; localLat?: number; localLng?: number; localRayon?: number } = {};
  depots: Depot[] = [];
  depotId?: number;

  // Récapitulatif avant enregistrement
  recap = false;

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
  openMpGroups = new Set<string>();   // sections MP dépliées, par code chantier
  openStockGroups = new Set<string>(); // sections Stock dépliées, par code chantier
  regenForce = false;
  private trajetMap?: L.Map;

  // Édition des dates dans le modal détail
  editDates = false;
  datesForm = { chJour: '', chHeure: '', deJour: '', deHeure: '', rChJour: '', rChHeure: '', rDeJour: '', rDeHeure: '' };
  savingDates = false;

  // BL multiples par livraison
  blsParLivraison: Record<number, BonLivraisonFile[]> = {};
  blUploadLivId: number | null = null;   // id de la livraison pour laquelle on uploade
  blUploadRef = '';
  blUploadFile: File | null = null;
  blUploading = false;

  /** Dépôts de stock disponibles (codes DEPO, ex. RB1..RB5) — chargés à la demande. */
  depotsStock: string[] = [];

  constructor(
    public svc: VoyageConteneurService,
    private chauffeurSvc: ChauffeurService,
    private chantierSvc: ChantierService,
    private matiereSvc: MatierePremiereService,
    private stockSvc: StockService,
    private depotSvc: DepotService,
    private voyageSvc: VoyageService,
    private adminSvc: AdminService,
    private http: HttpClient,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.charger();
    // Interrupteurs Administration : parcours de saisie + sections de contenu activables.
    this.adminSvc.getFeatures().subscribe({
      next: fs => {
        const actif = (cle: string) => { const f = fs.find(x => x.cle === cle); return f ? f.actif : true; };
        this.nouvelleSaisie = actif('voyage-nouvelle-saisie');
        this.ofActif = actif('of-voyage');
        this.mpActif = actif('cloture-mp');
        this.stockActif = actif('stock-voyage');
      },
      error: () => { this.nouvelleSaisie = true; this.ofActif = true; this.mpActif = true; this.stockActif = true; }
    });
    // Dépôts de stock (RB1..RB5) — silencieux si le stock DivNet est injoignable.
    this.stockSvc.getDepots().subscribe({ next: d => this.depotsStock = d, error: () => { this.depotsStock = []; } });
  }

  /** Voyages filtrés par la recherche globale ET les filtres par colonne. */
  voyagesFiltres(): VoyageConteneur[] {
    return this.voyages.filter(v => matchesSearch(v, this.q) && matchesFilters(v, this.colF));
  }

  /** Affiche/masque la ligne de filtres par colonne (et réinitialise à la fermeture). */
  basculerFiltres(): void {
    this.filtresUI = !this.filtresUI;
    if (!this.filtresUI) { this.colF = {}; this.page = 1; }
  }

  charger(): void {
    this.loading = true;
    this.page = 1;
    this.svc.getAll(this.vue).subscribe({
      next: d => { this.voyages = d; this.loading = false; },
      error: () => { this.voyages = []; this.loading = false; this.toastr.error('Impossible de charger les voyages.'); }
    });
  }

  /** Exporte la liste des voyages (vue courante) au format Excel. */
  exporterExcel(): void {
    this.exporting = true;
    this.svc.exportExcel(this.vue).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `voyages-${this.vue}.xlsx`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        this.exporting = false;
      },
      error: () => { this.exporting = false; this.toastr.error('Échec de l’export Excel.'); }
    });
  }

  /** Exporte la liste filtrée en PDF via une fenêtre d'impression (sans dépendance). */
  exporterPdf(): void {
    const lignes = this.voyagesFiltres();
    const dt = (v?: string | null) => v ? new Date(v).toLocaleString('fr-FR') : '—';
    const rows = lignes.map(v => `<tr>
      <td>#${v.id}</td><td>${dt(v.dateVoyage)}</td><td>${v.chauffeur || '—'}</td>
      <td style="text-align:center">${v.nbLivraisons ?? 0}</td>
      <td style="text-align:center">${v.nbMatieres ?? 0}</td>
      <td>${v.statut || '—'}</td></tr>`).join('');
    const html = `<html><head><meta charset="utf-8"><title>Voyages</title><style>
      body{font-family:Arial,Helvetica,sans-serif;padding:20px;color:#222}
      h2{margin:0 0 12px;font-size:18px}
      .sub{color:#666;font-size:12px;margin-bottom:14px}
      table{border-collapse:collapse;width:100%;font-size:12px}
      th,td{border:1px solid #d0d0d0;padding:6px 8px;text-align:left}
      th{background:#f2f2f2}
    </style></head><body>
      <h2>Voyages — ${this.vue}</h2>
      <div class="sub">${lignes.length} voyage(s) · édité le ${new Date().toLocaleString('fr-FR')}</div>
      <table><thead><tr><th>ID</th><th>Date</th><th>Chauffeur</th><th>Livraisons</th><th>Mat. premières</th><th>Statut</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">Aucun voyage</td></tr>'}</tbody></table>
    </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { this.toastr.error('Autorisez les pop-ups pour exporter en PDF.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
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
    // Pour un nouveau voyage, récupérer les livraisons libres ; pour une édition, les livraisons assignables
    const livraisonsObs = v ? this.svc.livraisonsAssignables(v.id) : this.svc.livraisonsLibres();
    forkJoin({
      chauffeurs: this.chauffeurSvc.getFromGap().pipe(catchError(() => of([] as GapChauffeur[]))),
      chantiers:  this.chantierSvc.getFromGap().pipe(catchError(() => of([] as Chantier[]))),
      depots:     this.depotSvc.getAll().pipe(catchError(() => of([] as Depot[]))),
      livraisons: livraisonsObs.pipe(catchError(() => of([] as GapVoyage[])))
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
          if (lg.chantierCode || lg.chantierId) this.chargerCommandes(lg);
          this.lignes.push(lg);
        });
        // Reconstruit les lignes « matières premières »
        // Priorité : si une ligne livraison existe pour le même chantier et n'a pas encore de commande,
        // on y fusionne les MP plutôt que de créer une nouvelle ligne.
        this.svc.matieres(v.id).subscribe({
          next: mps => {
            // Sépare les lignes de stock (source=STOCK) des matières premières Divalto.
            const mpItems = mps.filter(m => (m.source || 'MATIERE') !== 'STOCK');
            const stockItems = mps.filter(m => m.source === 'STOCK');
            const grp = new Map<string, MatierePremiere[]>();
            mpItems.forEach(m => {
              const k = `${m.projet || ''}|${m.cdno || ''}`;
              if (!grp.has(k)) grp.set(k, []);
              grp.get(k)!.push(m);
            });
            grp.forEach(items => {
              const first = items[0];
              // Trouver le chantier par code (normalisation : null == '')
              const norm = (s?: string | null) => (s || '').trim();
              const ch = chantiers.find(c => norm(c.code) === norm(first.projet));
              // Chercher une ligne existante par chantierId (plus fiable que chantierCode)
              // ou par chantierCode normalisé en fallback
              const existante = ch
                ? this.lignes.find(lg => lg.chantierId === ch.id && !lg.commandeId)
                : this.lignes.find(lg => norm(lg.chantierCode) === norm(first.projet) && !lg.commandeId);
              const lg = existante ?? this.nouvelleLigne();
              if (!existante) {
                lg.type = 'MATIERE_PREMIERE';
                lg.chantierCode = ch?.code ?? first.projet;
                if (ch) { lg.chantierId = ch.id; lg.filtreChantier = ch.nom; } else { lg.filtreChantier = first.projet || ''; }
                const split = (iso?: string) => iso ? { j: iso.slice(0, 10), h: iso.slice(11, 16) } : { j: undefined, h: undefined };
                const c = split(first.dateChargement); const d = split(first.dateDechargement);
                lg.chargementJour = c.j; lg.chargementHeure = c.h; lg.dechargementJour = d.j; lg.dechargementHeure = d.h;
                this.lignes.push(lg);
              }
              // Assurer que chantierCode est renseigné même sur une ligne existante
              if (!lg.chantierCode && (ch?.code || first.projet)) {
                lg.chantierCode = ch?.code ?? first.projet;
              }
              lg.commandeId = first.cdno;
              lg.lignesMp = items;
              items.forEach(m => { const r = m.reference || ''; lg.selectedMp[r] = true; lg.qteMp[r] = m.quantite || 1; });
              const codeChantier = lg.chantierCode || first.projet;
              if (codeChantier) this.matiereSvc.getCommandes(codeChantier).subscribe({ next: cmds => lg.commandes = cmds, error: () => {} });
            });
            // Reconstruit les lignes « stock » (groupées par chantier + dépôt).
            const norm = (s?: string | null) => (s || '').trim();
            const grpStock = new Map<string, MatierePremiere[]>();
            stockItems.forEach(m => {
              const k = `${norm(m.projet)}|${norm(m.depot)}`;
              if (!grpStock.has(k)) grpStock.set(k, []);
              grpStock.get(k)!.push(m);
            });
            grpStock.forEach(items => {
              const first = items[0];
              const ch = chantiers.find(c => norm(c.code) === norm(first.projet));
              const existante = ch
                ? this.lignes.find(lg => lg.chantierId === ch.id && !lg.depotStock)
                : this.lignes.find(lg => norm(lg.chantierCode) === norm(first.projet) && !lg.depotStock);
              const lg = existante ?? this.nouvelleLigne();
              if (!existante) {
                lg.chantierCode = ch?.code ?? first.projet;
                if (ch) { lg.chantierId = ch.id; lg.filtreChantier = ch.nom; } else { lg.filtreChantier = first.projet || ''; }
                const split = (iso?: string) => iso ? { j: iso.slice(0, 10), h: iso.slice(11, 16) } : { j: undefined, h: undefined };
                const c = split(first.dateChargement); const d = split(first.dateDechargement);
                lg.chargementJour = c.j; lg.chargementHeure = c.h; lg.dechargementJour = d.j; lg.dechargementHeure = d.h;
                this.lignes.push(lg);
              }
              lg.depotStock = first.depot || undefined;
              lg.stockOuvert = true;
              // Reconstitue la liste cochée à partir des lignes enregistrées (sans réinterroger le stock).
              lg.articlesStock = items.map(m => ({
                reference: m.reference, designation: m.designation, unite: m.unite,
                stockDisponible: m.qteCommande, depot: m.depot
              }));
              lg.filtreStock = '';
              this.majArticlesStockView(lg);
              lg.selectedStock = {}; lg.qteStock = {};
              items.forEach(m => { const r = m.reference || ''; lg.selectedStock![r] = true; lg.qteStock![r] = m.quantite || 1; });
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
      selectedLiv: {}, livrDispo: [], selLivIds: [], commandes: [], lignesMp: [], loadingMp: false,
      selectedMp: {}, qteMp: {}, filtreContenu: '', filtreLignesMp: '', mpSauvegardes: [],
      articlesStock: [], loadingStock: false, selectedStock: {}, qteStock: {}, filtreStock: ''
    };
  }
  ajouterLigne(): void { this.lignes.push(this.nouvelleLigne()); }
  retirerLigne(i: number): void { this.lignes.splice(i, 1); }

  /* ─────────── Nouvelle saisie : ajout/édition d'une ligne via une modale ─────────── */
  ouvrirLigneModal(): void { this.ligneDraft = this.nouvelleLigne(); this.ligneEditIndex = null; this.ligneModal = true; }
  /** Édite une ligne existante : travaille sur une copie (annulable). */
  modifierLigne(i: number): void {
    this.ligneDraft = JSON.parse(JSON.stringify(this.lignes[i])) as VoyageLigne;
    // Recalcule la liste des OF disponibles + le modèle du ng-select (références stables).
    this.majLivrDispo(this.ligneDraft);
    this.syncSelLivIds(this.ligneDraft);
    // Déplie d'emblée les sections qui contiennent déjà une sélection.
    this.ligneDraft.ofOuvert = this.ligneDraft.ofOuvert || this.selectedLivCount(this.ligneDraft) > 0;
    this.ligneDraft.mpOuvert = this.ligneDraft.mpOuvert || this.selectedMpCount(this.ligneDraft) > 0;
    this.ligneDraft.stockOuvert = this.ligneDraft.stockOuvert || this.selectedStockCount(this.ligneDraft) > 0;
    this.majArticlesStockView(this.ligneDraft);
    this.ligneEditIndex = i;
    this.ligneModal = true;
  }
  fermerLigneModal(e: Event): void { if (e.target === e.currentTarget) this.ligneModal = false; }
  /** Choix du chantier dans la modale d'ajout de ligne (ng-select) → charge les commandes. */
  onDraftChantier(): void {
    const lg = this.ligneDraft;
    if (!lg) return;
    const ch = this.chantiers.find(c => c.id === lg.chantierId);
    if (ch) { lg.chantierCode = ch.code; lg.filtreChantier = ch.nom + (ch.ville ? ` — ${ch.ville}` : ''); }
    lg.selectedLiv = {}; lg.selLivIds = []; lg.commandes = []; lg.commandeId = undefined; lg.lignesMp = []; lg.selectedMp = {}; lg.qteMp = {};
    // Le stock est indépendant du chantier (on choisit un dépôt) : on garde le dépôt mais on réinitialise la sélection.
    lg.selectedStock = {}; lg.qteStock = {};
    this.majLivrDispo(lg);
    if (lg.chantierId) this.chargerCommandes(lg);
  }
  /** Valide la modale : ajoute la nouvelle ligne ou remplace celle en cours d'édition. */
  validerLigne(): void {
    if (!this.ligneDraft || !this.ligneDraft.chantierId) return;
    if (this.ligneEditIndex !== null) {
      this.lignes[this.ligneEditIndex] = this.ligneDraft;
    } else {
      this.lignes.push(this.ligneDraft);
    }
    this.ligneDraft = null;
    this.ligneEditIndex = null;
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
  /** Ids des livraisons sélectionnées (pour le récapitulatif). */
  selectedLivArray(lg: VoyageLigne): number[] {
    return Object.keys(lg.selectedLiv).filter(k => lg.selectedLiv[+k]).map(k => +k);
  }
  /** Recalcule la liste des OF disponibles du chantier (référence stable pour ng-select/table). */
  majLivrDispo(lg: VoyageLigne): void {
    lg.livrDispo = this.allLivraisons.filter(l =>
      l.projetId === lg.chantierId &&
      !['LIVRE', 'ARCHIVE'].includes((l.statutReception || '').toUpperCase()));
  }
  /** Réaligne le tableau d'ids (modèle du ng-select) sur la map selectedLiv. */
  syncSelLivIds(lg: VoyageLigne): void {
    lg.selLivIds = Object.keys(lg.selectedLiv).filter(k => lg.selectedLiv[+k]).map(k => +k);
  }
  /** Coche/décoche un OF depuis la table (et met à jour le ng-select). */
  toggleLiv(lg: VoyageLigne, id: number): void {
    lg.selectedLiv[id] = !lg.selectedLiv[id];
    this.syncSelLivIds(lg);
  }
  /** Sélection via le ng-select multiple : reconstruit la map + le tableau d'ids. */
  onSelLivChange(lg: VoyageLigne, ids: number[]): void {
    const list = ids || [];
    lg.selectedLiv = {};
    list.forEach(id => lg.selectedLiv[id] = true);
    lg.selLivIds = list;
  }
  /** Nb de matières premières sélectionnées dans une ligne. */
  selectedMpCount(lg: VoyageLigne): number {
    const courantes = lg.lignesMp.filter(m => lg.selectedMp[m.reference || '']).length;
    return courantes + (lg.mpSauvegardes?.length ?? 0);
  }
  /** Lignes MP sélectionnées (pour le récapitulatif) — inclut les sauvegardées. */
  selectedMpLignes(lg: VoyageLigne): MatierePremiere[] {
    const courantes = lg.lignesMp.filter(m => lg.selectedMp[m.reference || '']);
    const sauvegardees = (lg.mpSauvegardes ?? []).map(s => s.m);
    return [...sauvegardees, ...courantes.filter(m => !sauvegardees.find(s => s.reference === m.reference))];
  }

  /* ─────────── Lignes : stock (lecture seule, vue Article_en_stock DivNet) ─────────── */
  /** Charge les articles disponibles du dépôt choisi (stock > 0). Lecture seule. */
  /** Nombre d'articles de stock affichés par page (limite le DOM → fluidité). */
  readonly stockPageSize = 50;

  chargerArticlesStock(lg: VoyageLigne): void {
    if (!lg.depotStock) { lg.articlesStock = []; lg.articlesStockFiltered = []; lg.articlesStockView = []; return; }
    lg.loadingStock = true; lg.articlesStock = []; lg.articlesStockFiltered = []; lg.articlesStockView = [];
    this.stockSvc.getArticles(lg.depotStock).subscribe({
      next: d => { lg.articlesStock = d; lg.loadingStock = false; this.majArticlesStockView(lg); },
      error: () => { lg.loadingStock = false; this.toastr.error('Stock indisponible (DivNet).'); }
    });
  }
  /**
   * Recalcule la liste filtrée puis la PAGE affichée.
   * IMPORTANT : ne JAMAIS filtrer/découper dans le *ngFor (381 articles → recalcul à
   * chaque détection de changement = navigateur qui rame). On ne garde dans le DOM que
   * {@link stockPageSize} lignes à la fois.
   */
  majArticlesStockView(lg: VoyageLigne): void {
    const t = (lg.filtreStock || '').toLowerCase().trim();
    const arts = lg.articlesStock ?? [];
    lg.articlesStockFiltered = !t
      ? arts
      : arts.filter(a => `${a.designation || ''} ${a.reference || ''}`.toLowerCase().includes(t));
    lg.stockPage = 0;
    this.sliceStock(lg);
  }
  /** Découpe la page courante depuis la liste filtrée. */
  private sliceStock(lg: VoyageLigne): void {
    const all = lg.articlesStockFiltered ?? [];
    const page = lg.stockPage ?? 0;
    lg.articlesStockView = all.slice(page * this.stockPageSize, (page + 1) * this.stockPageSize);
  }
  stockNbPages(lg: VoyageLigne): number {
    return Math.max(1, Math.ceil((lg.articlesStockFiltered?.length ?? 0) / this.stockPageSize));
  }
  stockPageSuivante(lg: VoyageLigne): void {
    if ((lg.stockPage ?? 0) < this.stockNbPages(lg) - 1) { lg.stockPage = (lg.stockPage ?? 0) + 1; this.sliceStock(lg); }
  }
  stockPagePrecedente(lg: VoyageLigne): void {
    if ((lg.stockPage ?? 0) > 0) { lg.stockPage = (lg.stockPage ?? 0) - 1; this.sliceStock(lg); }
  }
  /** trackBy : évite à Angular de reconstruire les lignes à chaque clic. */
  trackStock(_i: number, a: ArticleStock): string { return a.reference || ''; }
  /** Coche/décoche un article de stock : quantité par défaut = 1 (jamais > stock disponible). */
  onToggleStock(lg: VoyageLigne, a: ArticleStock): void {
    const k = a.reference || '';
    if (!lg.selectedStock) lg.selectedStock = {};
    if (!lg.qteStock) lg.qteStock = {};
    if (lg.selectedStock[k] && (lg.qteStock[k] == null || lg.qteStock[k] <= 0)) lg.qteStock[k] = 1;
  }
  selectedStockCount(lg: VoyageLigne): number {
    return (lg.articlesStock ?? []).filter(a => lg.selectedStock?.[a.reference || '']).length;
  }
  /** Articles de stock sélectionnés (pour le récapitulatif). */
  selectedStockLignes(lg: VoyageLigne): ArticleStock[] {
    return (lg.articlesStock ?? []).filter(a => lg.selectedStock?.[a.reference || '']);
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
    // Avant de charger la nouvelle commande, sauvegarder les MP déjà cochées
    const cmd = lg.commandes.find(c => c.cdno === lg.commandeId);
    const selActuelles = lg.lignesMp.filter(m => lg.selectedMp[m.reference || '']);
    if (selActuelles.length) {
      const nouvelles = selActuelles.map(m => ({
        m, cdno: lg.commandeId,
        pieceFournisseur: cmd?.pieceFournisseur ?? m.pieceFournisseur,
        qte: lg.qteMp[m.reference || ''] > 0 ? lg.qteMp[m.reference || ''] : (m.quantite ?? 1),
      }));
      // Remplace les éventuels doublons par référence
      lg.mpSauvegardes = [
        ...lg.mpSauvegardes.filter(s => !nouvelles.find(n => n.m.reference === s.m.reference)),
        ...nouvelles,
      ];
    }
    // Réinitialise la sélection de la commande en cours
    lg.selectedMp = {}; lg.qteMp = {};
    lg.loadingMp = true; lg.lignesMp = [];
    this.matiereSvc.getLignes(lg.commandeId).subscribe({
      next: d => { lg.lignesMp = d; lg.loadingMp = false; },
      error: () => { lg.loadingMp = false; this.toastr.error('Lignes indisponibles (Divalto).'); }
    });
  }
  retirerMpSauvegardee(lg: VoyageLigne, reference?: string): void {
    lg.mpSauvegardes = (lg.mpSauvegardes ?? []).filter(s => s.m.reference !== reference);
  }

  onToggleMp(lg: VoyageLigne, m: MatierePremiere): void {
    const k = m.reference || '';
    if (lg.selectedMp[k] && (lg.qteMp[k] == null || lg.qteMp[k] <= 0)) lg.qteMp[k] = 1;
  }

  /** Étape 1 : valide puis affiche le récapitulatif (l'enregistrement réel se fait à la confirmation). */
  enregistrer(): void {
    if (!this.chauffeurId) { this.toastr.warning('Veuillez choisir un chauffeur.'); return; }
    if (!this.form.localNom) { this.toastr.warning('Veuillez choisir un local de départ (obligatoire).'); return; }
    this.recap = true;
  }

  fermerRecap(e: Event): void { if (e.target === e.currentTarget) this.recap = false; }

  /** Étape 2 : construit la requête à partir des lignes et enregistre le voyage. */
  confirmerEnregistrement(): void {
    if (!this.chauffeurId || !this.form.localNom) { this.recap = false; return; }
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
      // Refs déjà dans mpSauvegardes → ne pas les envoyer deux fois
      const refsSauvegardees = new Set((lg.mpSauvegardes ?? []).map(s => s.m.reference || ''));
      // MP de la commande courante (exclure celles déjà sauvegardées)
      lg.lignesMp.filter(m => lg.selectedMp[m.reference || ''] && !refsSauvegardees.has(m.reference || '')).forEach(m => {
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
      // MP sauvegardées (d'autres commandes)
      (lg.mpSauvegardes ?? []).forEach(s => {
        const ref = s.m.reference || '';
        matieres.push({
          projet: lg.chantierCode, cdno: s.cdno, ref,
          designation: s.m.designation, of: s.m.of, unite: s.m.unite,
          pieceFournisseur: s.pieceFournisseur ?? s.m.pieceFournisseur,
          qteCommande: s.m.qteCommande ?? s.m.quantite,
          quantite: s.qte > 0 ? s.qte : 1,
          dateChargement: ch, dateDechargement: de
        });
      });
      // Stock : articles sélectionnés (source=STOCK). Lecture seule : la quantité est
      // traitée comme une matière première, le stock DivNet n'est jamais modifié.
      (lg.articlesStock ?? []).filter(a => lg.selectedStock?.[a.reference || '']).forEach(a => {
        const ref = a.reference || '';
        matieres.push({
          projet: lg.chantierCode, ref,
          designation: a.designation, unite: a.unite,
          quantite: lg.qteStock?.[ref] && lg.qteStock[ref] > 0 ? lg.qteStock[ref] : 1,
          qteCommande: a.stockDisponible,
          source: 'STOCK', depot: lg.depotStock,
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
      this.recap = false; this.modal = false; this.saving = false; this.charger();
    };
    const ko = () => { this.toastr.error('Échec de l’enregistrement.'); this.saving = false; };
    if (this.editId) {
      this.svc.update(this.editId, req).subscribe({ next: ok, error: ko });
    } else {
      this.svc.create(req).subscribe({ next: ok, error: ko });
    }
  }

  /* ─────────── Édition des dates du voyage ─────────── */
  ouvrirEditDates(): void {
    if (!this.detail) return;
    const d = this.detail;
    const split = (dt?: string) => dt ? { jour: dt.substring(0, 10), heure: dt.substring(11, 16) } : { jour: '', heure: '' };
    const ch  = split(d.chargement);    const de  = split(d.dechargement);
    const rCh = split(d.realChargement); const rDe = split(d.realDechargement);
    this.datesForm = { chJour: ch.jour, chHeure: ch.heure, deJour: de.jour, deHeure: de.heure,
                       rChJour: rCh.jour, rChHeure: rCh.heure, rDeJour: rDe.jour, rDeHeure: rDe.heure };
    this.editDates = true;
  }

  enregistrerDates(): void {
    if (!this.detail) return;
    this.savingDates = true;
    const f = this.datesForm;
    this.svc.mettreAJourDates(this.detail.id, {
      chargementJour: f.chJour, chargementHeure: f.chHeure,
      dechargementJour: f.deJour, dechargementHeure: f.deHeure,
      realChargementJour: f.rChJour, realChargementHeure: f.rChHeure,
      realDechargementJour: f.rDeJour, realDechargementHeure: f.rDeHeure,
    }).subscribe({
      next: () => {
        this.savingDates = false; this.editDates = false;
        // Remplacer la référence pour déclencher la détection de changements Angular
        if (this.detail) {
          this.detail = {
            ...this.detail,
            chargement:     f.chJour  ? `${f.chJour}T${f.chHeure  || '00:00'}:00` : undefined,
            dechargement:   f.deJour  ? `${f.deJour}T${f.deHeure  || '00:00'}:00` : undefined,
            realChargement: f.rChJour ? `${f.rChJour}T${f.rChHeure || '00:00'}:00` : undefined,
            realDechargement: f.rDeJour ? `${f.rDeJour}T${f.rDeHeure || '00:00'}:00` : undefined,
          };
        }
        this.toastr.success('Dates enregistrées.');
      },
      error: () => { this.savingDates = false; this.toastr.error('Échec de la mise à jour des dates.'); }
    });
  }

  /* ─────────── Bons de livraison multiples ─────────── */
  chargerBls(livraisonId: number): void {
    if (this.blsParLivraison[livraisonId]) return; // déjà chargé
    this.svc.listerBls(livraisonId).subscribe({
      next: bls => this.blsParLivraison[livraisonId] = bls,
      error: () => this.blsParLivraison[livraisonId] = [],
    });
  }

  onBlFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.blUploadFile = input.files?.[0] ?? null;
  }

  uploaderBl(livraisonId: number): void {
    if (!this.blUploadFile || this.blUploading) return;
    this.blUploading = true;
    this.svc.ajouterBl(livraisonId, this.blUploadFile, this.blUploadRef || undefined).subscribe({
      next: () => {
        this.blUploading = false; this.blUploadLivId = null;
        delete this.blsParLivraison[livraisonId]; // forcer rechargement
        this.chargerBls(livraisonId);
        this.toastr.success('BL ajouté.');
      },
      error: () => { this.blUploading = false; this.toastr.error("Échec de l'upload du BL."); }
    });
  }

  /* ─────────── Consultation du détail ─────────── */
  consulter(v: VoyageConteneur): void {
    this.detail = v;
    this.detailLivraisons = [];
    this.contenu = {};
    this.detailMatieres = [];
    this.blsParLivraison = {};
    this.editDates = false;
    this.svc.matieres(v.id).subscribe({ next: m => this.detailMatieres = m, error: () => {} });
    this.detailLoading = true;
    this.detruireCarte();
    this.trajet = null;
    this.trajetLoading = true;

    this.svc.livraisons(v.id).subscribe({
      next: livs => {
        this.detailLivraisons = livs;
        this.detailLoading = false;
        livs.forEach(l => {
          this.contenu[l.id] = { articles: [], matieres: [] };
          this.voyageSvc.articles(l.id).subscribe({ next: a => this.contenu[l.id].articles = a, error: () => {} });
          this.voyageSvc.matieres(l.id).subscribe({ next: m => this.contenu[l.id].matieres = m, error: () => {} });
          this.chargerBls(l.id);
        });
      },
      error: () => { this.detailLoading = false; this.toastr.error('Livraisons indisponibles.'); }
    });

    this.svc.trajet(v.id).subscribe({
      next: t => { this.trajet = t; this.trajetLoading = false; setTimeout(() => this.afficherTrajet(), 150); },
      error: () => { this.trajet = null; this.trajetLoading = false; }
    });
  }

  /** Régénère le code de forçage du voyage conteneur (commun à toutes ses lignes, MP incluses). */
  regenererForce(): void {
    if (!this.detail) return;
    this.regenForce = true;
    this.svc.regenererForceCode(this.detail.id).subscribe({
      next: maj => {
        const code = maj.forceCode;
        if (this.detail) this.detail.forceCode = code;
        this.detailLivraisons.forEach(d => d.forceCode = code);
        this.regenForce = false;
        this.toastr.success('Nouveau code : ' + code);
      },
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

  /* ─────────── Aperçu d'un QR : voir en grand + télécharger PNG / PDF ─────────── */
  qrApercu: { url: string; titre: string; fichier: string } | null = null;
  qrPdfEnCours = false;

  /** Ouvre la fenêtre d'aperçu du QR. */
  voirQr(url: string, titre: string, fichier: string): void {
    this.qrApercu = { url, titre, fichier };
  }
  fermerQr(): void { this.qrApercu = null; }

  /** Télécharge le QR affiché au format PNG. */
  telechargerQrPng(): void {
    if (!this.qrApercu) return;
    const a = document.createElement('a');
    a.href = this.qrApercu.url;
    a.download = this.qrApercu.fichier + '.png';
    a.target = '_blank';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  /** Télécharge le QR affiché au format PDF (généré côté navigateur). */
  telechargerQrPdf(): void {
    if (!this.qrApercu || this.qrPdfEnCours) return;
    const { url, titre, fichier } = this.qrApercu;
    this.qrPdfEnCours = true;
    // Récupère l'image via HttpClient (même origine) puis construit le PDF.
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: async blob => {
        try {
          const pdf = await blobQrEnPdf(blob, titre);
          const objUrl = URL.createObjectURL(pdf);
          const a = document.createElement('a');
          a.href = objUrl; a.download = fichier + '.pdf';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
        } catch {
          this.toastr.error('Génération du PDF impossible.');
        } finally {
          this.qrPdfEnCours = false;
        }
      },
      error: () => { this.qrPdfEnCours = false; this.toastr.error('QR indisponible.'); }
    });
  }

  /** Annule une livraison (change son statut à ANNULE). */
  annulerLigneWeb(l: GapVoyage): void {
    if (l.statutReception === 'ANNULE') { this.toastr.info('Livraison déjà annulée.'); return; }
    if (!confirm(`Annuler la livraison #${l.id} ? Cela changera son statut à "Annulée".`)) return;
    this.http.patch(`${environment.apiUrl}/voyages-conteneurs/livraisons/${l.id}/annuler`, null).subscribe({
      next: () => {
        l.statutReception = 'ANNULE';
        this.toastr.success('Livraison annulée.');
      },
      error: () => this.toastr.error('Erreur lors de l\'annulation.')
    });
  }

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

  /* ─────────── Matières premières : statut piloté par le scan chauffeur (À charger → Chargé → Livré) ─────────── */
  /** Regroupe les livraisons par chantier et y associe les MP (une seule fois par groupe). */
  livraisonsGroupees(): { code: string; label: string; livraisons: GapVoyage[]; matieres: MatierePremiere[] }[] {
    const norm = (s?: string | null) => (s || '').trim();
    // Trier par id ASC = ordre de création
    const livTriees = [...this.detailLivraisons].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    const mpsTriees = [...this.detailMatieres].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

    const map = new Map<string, GapVoyage[]>();
    for (const l of livTriees) {
      const k = norm(l.projetCode);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(l);
    }
    const result: { code: string; label: string; livraisons: GapVoyage[]; matieres: MatierePremiere[] }[] = [];
    const mpUtilisees = new Set<number>();
    map.forEach((livs, code) => {
      const mps = code
        ? mpsTriees.filter(m => norm(m.projet) === code)
        : mpsTriees.filter(m => !m.projet);
      mps.forEach(m => mpUtilisees.add(m.id));
      result.push({ code, label: livs[0].projetDesignation || livs[0].projetCode || 'Sans chantier', livraisons: livs, matieres: mps });
    });
    // MP sans chantier correspondant → groupe orphelin
    const orphelines = mpsTriees.filter(m => !mpUtilisees.has(m.id));
    if (orphelines.length) {
      result.push({ code: '', label: '—', livraisons: [], matieres: orphelines });
    }
    return result;
  }

  /** @deprecated Utiliser livraisonsGroupees() */
  matieresDeLivraison(l: GapVoyage): MatierePremiere[] {
    return this.livraisonsGroupees().find(g => g.livraisons.some(x => x.id === l.id))?.matieres ?? [];
  }

  /** MP livrée = statut LIVRE (2e scan). */
  estLivree(m: MatierePremiere): boolean { return (m.statut || '').toUpperCase() === 'LIVRE'; }
  /** MP chargée = statut CHARGE (1er scan, pas encore livrée). */
  estChargee(m: MatierePremiere): boolean { return (m.statut || '').toUpperCase() === 'CHARGE'; }
  /** Libellé statut MP aligné sur les articles : À charger / Chargé / Livré. */
  statutMpLabel(m: MatierePremiere): string {
    return this.estLivree(m) ? 'Livré' : this.estChargee(m) ? 'Chargé' : 'À charger';
  }
  /** Classe de badge associée au statut MP (alignée sur le code couleur global). */
  statutMpClass(m: MatierePremiere): string {
    return this.estLivree(m) ? 'badge-green' : this.estChargee(m) ? 'badge-blue' : 'badge-gray';
  }
  /** Nombre de MP livrées dans un groupe. */
  mpLivrees(ms: MatierePremiere[]): number { return ms.filter(m => this.estLivree(m)).length; }
  /** Qté livrée = qté de la ligne une fois livrée, sinon 0. */
  qteLivree(m: MatierePremiere): number { return this.estLivree(m) ? (m.quantite ?? 0) : 0; }
  /** Reste à livrer = qté commandée − qté livrée. */
  resteALivrer(m: MatierePremiere): number {
    const cmd = m.qteCommande ?? m.quantite ?? 0;
    return Math.max(0, cmd - this.qteLivree(m));
  }
  /** Repliage de la section MP, par chantier (fermé par défaut). */
  toggleMpGroup(code: string): void {
    this.openMpGroups.has(code) ? this.openMpGroups.delete(code) : this.openMpGroups.add(code);
  }
  mpGroupOpen(code: string): boolean { return this.openMpGroups.has(code); }
  /** Repliage de la section Stock, par chantier (fermé par défaut). */
  toggleStockGroup(code: string): void {
    this.openStockGroups.has(code) ? this.openStockGroups.delete(code) : this.openStockGroups.add(code);
  }
  stockGroupOpen(code: string): boolean { return this.openStockGroups.has(code); }

  /** Lignes « matières premières » d'un groupe (source ≠ STOCK). */
  mpDe(ms: MatierePremiere[]): MatierePremiere[] { return (ms || []).filter(m => (m.source || 'MATIERE') !== 'STOCK'); }
  /** Lignes « stock » d'un groupe (source = STOCK), affichées séparément. */
  stockDe(ms: MatierePremiere[]): MatierePremiere[] { return (ms || []).filter(m => m.source === 'STOCK'); }

  /** Renvoie la date min (ou max) parmi une liste de dates ISO valides (ignore vides/invalides). */
  private extremeDate(vals: (string | null | undefined)[], mode: 'min' | 'max'): string | undefined {
    const dates = vals.filter((d): d is string => !!d && !isNaN(Date.parse(d))).sort();
    return mode === 'min' ? dates[0] : dates[dates.length - 1];
  }
  /** Chargement prévu : date explicite (voyage/lignes/MP) ; à défaut la date de livraison GAP. */
  chargementPrevu(): string | undefined {
    return this.extremeDate([
      this.detail?.chargement,
      ...this.detailLivraisons.map(l => l.chargement),
      ...this.detailMatieres.map(m => m.dateChargement),
    ], 'min')
      ?? this.extremeDate(this.detailLivraisons.map(l => l.dateLivraison), 'min');
  }
  /** Déchargement prévu : date explicite (voyage/lignes/MP) ; à défaut la date de livraison GAP. */
  dechargementPrevu(): string | undefined {
    return this.extremeDate([
      this.detail?.dechargement,
      ...this.detailLivraisons.map(l => l.dechargement),
      ...this.detailMatieres.map(m => m.dateDechargement),
    ], 'max')
      ?? this.extremeDate(this.detailLivraisons.map(l => l.dateLivraison), 'max');
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
