import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { VoyageConteneurService } from '../services/voyage-conteneur.service';
import { ChauffeurService } from '../services/chauffeur.service';
import { ChantierService } from '../services/chantier.service';
import { MatierePremiereService } from '../services/matiere-premiere.service';
import { VoyageService } from '../services/voyage.service';
import { environment } from '../../environments/environment';
import {
  VoyageConteneur, VoyageConteneurRequest, GapVoyage, GapChauffeur, Chantier,
  CommandeMp, GapVoyageArticle, MatierePremiere, TrajetVoyage
} from '../core/models';
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
}

@Component({
  selector: 'app-voyages-conteneurs',
  template: `
    <div class="toolbar">
      <select [(ngModel)]="vue" (change)="charger()" class="btn btn-outline">
        <option value="en-cours">Voyages en cours</option>
        <option value="archives">Voyages archivés</option>
      </select>
      <button class="btn btn-primary right" (click)="ouvrir()">
        <i class="fa-solid fa-plus"></i> Nouveau voyage
      </button>
    </div>

    <div class="card"><div class="card-body" style="padding:0">
      <div *ngIf="loading" class="spinner"></div>
      <div *ngIf="!loading && voyages.length===0" class="empty">
        <i class="fa-solid fa-truck-fast"></i> Aucun voyage
      </div>
      <div class="table-wrap" *ngIf="!loading && voyages.length">
        <table>
          <thead><tr><th>ID</th><th>Date</th><th>Chauffeur</th><th>Livraisons</th><th>Mat. premières</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let v of voyages">
              <td><code>#{{ v.id }}</code></td>
              <td>{{ v.dateVoyage ? (v.dateVoyage | date:'dd/MM/yy HH:mm') : '—' }}</td>
              <td>{{ v.chauffeur || '—' }}</td>
              <td><span class="badge badge-gray">{{ v.nbLivraisons ?? 0 }}</span></td>
              <td><span class="badge badge-blue">{{ v.nbMatieres ?? 0 }}</span></td>
              <td><span class="badge badge-orange">{{ v.statut || '—' }}</span></td>
              <td class="flex">
                <button class="btn btn-outline btn-sm" (click)="consulter(v)" title="Consulter le détail">
                  <i class="fa-solid fa-eye"></i> Détails</button>
                <button class="btn btn-outline btn-sm" (click)="ouvrir(v)" title="Gérer les livraisons">
                  <i class="fa-solid fa-pen"></i> Gérer</button>
                <button *ngIf="vue==='en-cours'" class="btn btn-outline btn-sm" (click)="archiver(v)" title="Archiver">
                  <i class="fa-solid fa-box-archive"></i></button>
                <button class="btn btn-danger btn-sm" (click)="supprimer(v)" title="Supprimer">
                  <i class="fa-solid fa-trash"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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

          <div style="margin-top:10px">
            <button class="btn btn-outline btn-sm" (click)="toggleLocal()">
              <i class="fa-solid fa-location-dot"></i>
              {{ localOpen ? 'Masquer le local de départ' : 'Mettre un local de départ (optionnel)' }}
            </button>
            <div *ngIf="localOpen" style="margin-top:8px;padding:10px;border:1px solid var(--border);border-radius:8px">
              <div class="form-grid">
                <div class="field"><label>Nom du dépôt</label><input [(ngModel)]="form.localNom" placeholder="Ex : Dépôt central"></div>
                <div class="field"><label>Rayon (m)</label><input type="number" [(ngModel)]="form.localRayon" placeholder="100"></div>
              </div>
              <p class="muted" style="font-size:12px;margin:6px 0">Cliquez sur la carte pour placer le point de départ.</p>
              <div id="local-map" style="height:260px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb"></div>
              <div class="muted" style="font-size:12px;margin-top:6px" *ngIf="form.localLat != null">
                Position : {{ form.localLat | number:'1.5-5' }}, {{ form.localLng | number:'1.5-5' }}
              </div>
            </div>
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

              <div class="type-toggle">
                <button type="button" [class.active]="lg.type==='ARTICLE'" (click)="lg.type='ARTICLE'">
                  <i class="fa-solid fa-boxes-stacked"></i> Articles</button>
                <button type="button" [class.active]="lg.type==='MATIERE_PREMIERE'" (click)="setTypeMp(lg)">
                  <i class="fa-solid fa-cubes"></i> Matières premières</button>
              </div>

              <!-- Articles : livraisons de ce chantier -->
              <div *ngIf="lg.type==='ARTICLE'">
                <div *ngIf="!lg.chantierId" class="muted" style="font-size:12px;padding:8px">Choisissez d'abord un chantier.</div>
                <div class="art-list" *ngIf="lg.chantierId">
                  <div *ngIf="livraisonsDuChantier(lg).length===0" class="muted" style="font-size:12px;padding:8px">Aucune livraison pour ce chantier.</div>
                  <label class="art-item" *ngFor="let l of livraisonsDuChantier(lg)" [class.checked]="lg.selectedLiv[l.id]">
                    <input type="checkbox" [(ngModel)]="lg.selectedLiv[l.id]">
                    <div class="art-info"><strong>#{{ l.id }}</strong>
                      <span class="muted">{{ l.nbArticles }} article(s) · {{ l.statutReception || '—' }}</span></div>
                  </label>
                </div>
              </div>

              <!-- Matières premières : commande de ce chantier -> lignes -->
              <div *ngIf="lg.type==='MATIERE_PREMIERE'">
                <div *ngIf="!lg.chantierId" class="muted" style="font-size:12px;padding:8px">Choisissez d'abord un chantier.</div>
                <div *ngIf="lg.chantierId">
                  <div class="field" style="margin-bottom:8px"><label>Commande</label>
                    <select [(ngModel)]="lg.commandeId" (change)="chargerLignesMp(lg)">
                      <option [ngValue]="undefined" disabled>— Choisir une commande —</option>
                      <option *ngFor="let c of lg.commandes" [ngValue]="c.cdno">
                        #{{ c.cdno }}<span *ngIf="c.tiers"> · {{ c.tiers }}</span></option>
                    </select>
                  </div>
                  <div *ngIf="lg.loadingMp" class="spinner" style="margin:12px auto"></div>
                  <div class="art-list" *ngIf="lg.commandeId && !lg.loadingMp">
                    <div *ngIf="lg.lignesMp.length===0" class="muted" style="font-size:12px;padding:8px">Aucune ligne.</div>
                    <div class="art-item" *ngFor="let m of lg.lignesMp" [class.checked]="lg.selectedMp[m.reference||'']">
                      <input type="checkbox" [(ngModel)]="lg.selectedMp[m.reference||'']" (change)="onToggleMp(lg, m)">
                      <div class="art-info"><strong>{{ m.designation || m.reference }}</strong>
                        <span class="muted">{{ m.reference }} · OF {{ m.of || '—' }} · dispo {{ m.quantite ?? '—' }}</span></div>
                      <input *ngIf="lg.selectedMp[m.reference||'']" type="number" min="1" step="any" class="qte-input"
                             [(ngModel)]="lg.qteMp[m.reference||'']" placeholder="Qté">
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button class="btn btn-outline" (click)="ajouterLigne()"><i class="fa-solid fa-plus"></i> Ajouter une ligne</button>
        </div>
        <div class="m-foot">
          <button class="btn btn-outline" (click)="modal=false">Annuler</button>
          <button class="btn btn-primary" (click)="enregistrer()" [disabled]="saving">
            <i class="fa-solid fa-floppy-disk"></i> Enregistrer</button>
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
                <button *ngIf="l.hasBl" class="btn btn-outline btn-sm" style="margin-left:auto"
                        (click)="telechargerBL(l); $event.stopPropagation()" title="Télécharger le BL">
                  <i class="fa-solid fa-file-arrow-down"></i> BL</button>
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
                        <td><img [src]="qrArticleUrl(a.id)" alt="QR" style="width:48px;height:48px"></td>
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
              <thead><tr><th>Désignation</th><th>Réf</th><th>OF</th><th>Affaire</th><th>Qté</th><th>QR</th></tr></thead>
              <tbody>
                <tr *ngFor="let m of detailMatieres">
                  <td><strong>{{ m.designation || '—' }}</strong></td>
                  <td><code>{{ m.reference || '—' }}</code></td>
                  <td><code>{{ m.of || '—' }}</code></td>
                  <td>{{ m.projet || '—' }}</td>
                  <td>{{ m.quantite ?? '—' }}</td>
                  <td style="white-space:nowrap">
                    <img [src]="qrMatiereUrl(m.id)" alt="QR" style="width:48px;height:48px;vertical-align:middle">
                    <a class="btn btn-outline btn-sm" style="margin-left:6px"
                       [href]="qrMatiereUrl(m.id)" [download]="'qr-mp-' + m.id + '.png'" target="_blank" title="Télécharger le QR">
                      <i class="fa-solid fa-download"></i></a>
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
  `
})
export class VoyagesConteneursComponent implements OnInit {
  voyages: VoyageConteneur[] = [];
  loading = true;
  vue: 'en-cours' | 'archives' = 'en-cours';
  modal = false; saving = false;
  editId: number | null = null;

  chauffeurs: GapChauffeur[] = [];
  chauffeurId?: number;
  filtreChauffeur = '';
  comboOpen = false;

  chantiers: Chantier[] = [];
  allLivraisons: GapVoyage[] = [];   // livraisons assignables (filtrées par chantier dans chaque ligne)
  lignes: VoyageLigne[] = [];
  form: { localNom?: string; localLat?: number; localLng?: number; localRayon?: number } = {};
  localOpen = false;
  private localMap?: L.Map;
  private localMarker?: L.Marker;

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
  private trajetMap?: L.Map;

  constructor(
    private svc: VoyageConteneurService,
    private chauffeurSvc: ChauffeurService,
    private chantierSvc: ChantierService,
    private matiereSvc: MatierePremiereService,
    private voyageSvc: VoyageService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading = true;
    this.svc.getAll(this.vue === 'archives').subscribe({
      next: d => { this.voyages = d; this.loading = false; },
      error: () => { this.voyages = []; this.loading = false; this.toastr.error('Impossible de charger les voyages.'); }
    });
  }

  archiver(v: VoyageConteneur): void {
    this.svc.archiver(v.id).subscribe({
      next: () => { this.toastr.success('Voyage archivé.'); this.charger(); },
      error: () => this.toastr.error('Échec de l’archivage.')
    });
  }

  ouvrir(v?: VoyageConteneur): void {
    this.editId = v ? v.id : null;
    this.chauffeurId = v ? v.chauffeurId : undefined;
    this.filtreChauffeur = v && v.chauffeur ? v.chauffeur : '';
    this.comboOpen = false;
    this.lignes = [];
    this.form = {
      localNom: v?.localNom, localLat: v?.localLat, localLng: v?.localLng, localRayon: v?.localRayon
    };
    this.localOpen = !!(v && v.localNom);
    this.modal = true;
    const vid = v ? v.id : 0;
    forkJoin({
      chauffeurs: this.chauffeurSvc.getFromGap().pipe(catchError(() => of([] as GapChauffeur[]))),
      chantiers:  this.chantierSvc.getFromGap().pipe(catchError(() => of([] as Chantier[]))),
      livraisons: this.svc.livraisonsAssignables(vid).pipe(catchError(() => of([] as GapVoyage[])))
    }).subscribe(({ chauffeurs, chantiers, livraisons }) => {
      this.chauffeurs = chauffeurs;
      this.chantiers = chantiers;
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
          this.lignes.push(lg);
        });
      }
      if (this.lignes.length === 0) this.ajouterLigne();
    });
  }

  supprimer(v: VoyageConteneur): void {
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
      selectedMp: {}, qteMp: {}
    };
  }
  ajouterLigne(): void { this.lignes.push(this.nouvelleLigne()); }
  retirerLigne(i: number): void { this.lignes.splice(i, 1); }

  fermer(e: Event): void { if (e.target === e.currentTarget) { this.detruireLocalMap(); this.modal = false; } }

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

  /* ─────────── Local de départ (carte) ─────────── */
  toggleLocal(): void {
    this.localOpen = !this.localOpen;
    if (this.localOpen) setTimeout(() => this.afficherLocalMap(), 100);
    else this.detruireLocalMap();
  }
  private afficherLocalMap(): void {
    const el = document.getElementById('local-map');
    if (!el) return;
    this.detruireLocalMap();
    const start: L.LatLngTuple = (this.form.localLat != null && this.form.localLng != null)
      ? [this.form.localLat, this.form.localLng] : [33.5731, -7.5898]; // défaut : Casablanca
    const map = L.map('local-map').setView(start, this.form.localLat != null ? 15 : 11);
    this.localMap = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    if (this.form.localLat != null) this.localMarker = L.marker(start).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => {
      this.form.localLat = +e.latlng.lat.toFixed(6);
      this.form.localLng = +e.latlng.lng.toFixed(6);
      if (this.localMarker) this.localMarker.setLatLng(e.latlng);
      else this.localMarker = L.marker(e.latlng).addTo(map);
    });
    setTimeout(() => map.invalidateSize(), 60);
  }
  private detruireLocalMap(): void { if (this.localMap) { this.localMap.remove(); this.localMap = undefined; this.localMarker = undefined; } }

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
    if (lg.type === 'MATIERE_PREMIERE') this.chargerCommandes(lg);
  }
  fermerComboLigne(lg: VoyageLigne): void { setTimeout(() => lg.comboOpen = false, 150); }

  livraisonsDuChantier(lg: VoyageLigne): GapVoyage[] {
    return this.allLivraisons.filter(l => l.projetId === lg.chantierId);
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
    const livraisonIds: number[] = [];
    const livraisonDates: NonNullable<VoyageConteneurRequest['livraisonDates']> = [];
    const matieres: NonNullable<VoyageConteneurRequest['matieres']> = [];
    for (const lg of this.lignes) {
      const ch = this.combine(lg.chargementJour, lg.chargementHeure);
      const de = this.combine(lg.dechargementJour, lg.dechargementHeure);
      if (lg.type === 'ARTICLE') {
        Object.keys(lg.selectedLiv).filter(k => lg.selectedLiv[+k]).forEach(k => {
          livraisonIds.push(+k);
          livraisonDates.push({ id: +k, chargement: ch, dechargement: de });
        });
      } else {
        lg.lignesMp.filter(m => lg.selectedMp[m.reference || '']).forEach(m => {
          const ref = m.reference || '';
          matieres.push({
            projet: lg.chantierCode, cdno: lg.commandeId, ref,
            designation: m.designation, of: m.of, unite: m.unite,
            quantite: lg.qteMp[ref] && lg.qteMp[ref] > 0 ? lg.qteMp[ref] : 1,
            dateChargement: ch, dateDechargement: de
          });
        });
      }
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
