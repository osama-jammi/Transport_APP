import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { VoyageService } from '../services/voyage.service';
import { ChauffeurService } from '../services/chauffeur.service';
import { ChantierService } from '../services/chantier.service';
import { ArticleService } from '../services/article.service';
import { MatierePremiereService } from '../services/matiere-premiere.service';
import {
  Voyage, VoyageRequest, Chantier,
  GapArticle, GapChauffeur, GapVoyageArticle, TrajetVoyage, MatierePremiere, CommandeMp
} from '../core/models';
import { environment } from '../../environments/environment';
import * as L from 'leaflet';

@Component({
  selector: 'app-voyages',
  template: `
    <div class="toolbar">
      <div class="search">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input [(ngModel)]="q" placeholder="Rechercher (client, camion, chauffeur, transporteur)…">
      </div>
    </div>

    <div class="card"><div class="card-body" style="padding:0">
      <div *ngIf="loading" class="spinner"></div>
      <div *ngIf="!loading && filtres().length===0" class="empty">
        <i class="fa-solid fa-route"></i> Aucune livraison
      </div>
      <div class="table-wrap" *ngIf="!loading && filtres().length">
        <table>
          <thead><tr><th>ID</th><th>Client / Chantier</th><th>Chauffeur</th>
            <th>Chargement</th><th>Déchargement</th><th>Articles</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let v of filtres()" class="row-link" (click)="voirDetails(v)">
              <td><code>#{{ v.id }}</code></td>
              <td><strong>{{ v.client || '—' }}</strong></td>
              <td>{{ v.chauffeur || '—' }}</td>
              <td>{{ v.chargementJour || '—' }} {{ v.chargementHeure || '' }}</td>
              <td>{{ v.dechargementJour || '—' }} {{ v.dechargementHeure || '' }}</td>
              <td><span class="badge badge-gray">{{ v.nbArticles ?? v.nbColis }}</span></td>
              <td><span class="badge" [ngClass]="statutVoyage(v).cls">{{ statutVoyage(v).label }}</span></td>
              <td class="flex" (click)="$event.stopPropagation()">
                <button class="btn btn-outline btn-sm" (click)="voirDetails(v)" title="Détails">
                  <i class="fa-solid fa-eye"></i></button>
                <button class="btn btn-outline btn-sm" (click)="ouvrir(v)" title="Modifier">
                  <i class="fa-solid fa-pen"></i></button>
                <button *ngIf="v.statut==='EN_COURS'" class="btn btn-outline btn-sm" (click)="archiver(v)" title="Archiver">
                  <i class="fa-solid fa-box-archive"></i></button>
                <button class="btn btn-danger btn-sm" (click)="supprimer(v)" title="Supprimer">
                  <i class="fa-solid fa-trash"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div></div>

    <!-- ════════ Modal NOUVEAU VOYAGE ════════ -->
    <div class="modal-backdrop" *ngIf="modal" (click)="fermer($event)">
      <div class="modal" style="max-width:1040px" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>{{ editId ? 'Modifier' : 'Nouvelle' }} livraison</h3><button class="x" (click)="modal=false">&times;</button></div>
        <div class="m-body">
          <p class="muted" style="margin:0 0 12px;font-size:12px">
            <i class="fa-solid fa-circle-info"></i> Le chauffeur et les heures de chargement/déchargement
            se définissent au niveau du <strong>Voyage</strong>.
          </p>
          <div class="form-grid">
            <div class="field combo">
              <label>Chantier (client) *</label>
              <input class="filtre-input" [(ngModel)]="filtreChantier" autocomplete="off"
                     (focus)="comboChantierOpen=true"
                     (input)="comboChantierOpen=true; form.chantierId=undefined"
                     (blur)="fermerCombo('chantier')"
                     placeholder="Taper pour rechercher un chantier…">
              <div class="combo-list" *ngIf="comboChantierOpen && chantiersFiltres().length">
                <div class="combo-item" *ngFor="let ch of chantiersFiltres()" (mousedown)="choisirChantier(ch)">
                  {{ ch.nom }}<span *ngIf="ch.ville" class="muted"> — {{ ch.ville }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Type de contenu : Articles ou Matières premières -->
          <div class="type-toggle">
            <button type="button" [class.active]="typeLivraison==='ARTICLE'" (click)="setType('ARTICLE')">
              <i class="fa-solid fa-boxes-stacked"></i> Articles</button>
            <button type="button" [class.active]="typeLivraison==='MATIERE_PREMIERE'" (click)="setType('MATIERE_PREMIERE')">
              <i class="fa-solid fa-cubes"></i> Matières premières</button>
          </div>

          <!-- Sélection des articles actifs -->
          <div class="art-section" *ngIf="typeLivraison==='ARTICLE'">
            <div class="art-head">
              <label>Articles à transporter <span class="muted">({{ selectedCount() }} sélectionné(s))</span></label>
              <button type="button" class="btn btn-outline btn-sm" (click)="toggleAll()">
                {{ allSelected() ? 'Tout désélectionner' : 'Tout sélectionner' }}
              </button>
            </div>
            <input class="filtre-input" [(ngModel)]="filtreArticle"
                   placeholder="🔍 Filtrer les articles (désignation, n° prix, origine)…"
                   style="margin-bottom:10px">
            <div *ngIf="articlesLoading" class="spinner" style="margin:18px auto"></div>
            <div *ngIf="!articlesLoading && articlesDispo.length===0" class="empty" style="padding:20px">
              <i class="fa-solid fa-boxes-stacked"></i> Aucun article actif disponible
            </div>
            <div class="art-list" *ngIf="!articlesLoading && articlesDispo.length">
              <label class="art-item" *ngFor="let a of articlesFiltres()" [class.checked]="selected[a.id]">
                <input type="checkbox" [(ngModel)]="selected[a.id]" (change)="onToggleArticle(a)">
                <div class="art-info">
                  <strong>{{ a.designation }}</strong>
                  <span class="muted">{{ a.unite }} · {{ a.origineArticle || '—' }} · reste {{ a.quantiteReste ?? '—' }}</span>
                </div>
                <input *ngIf="selected[a.id]" type="number" min="1" step="1" class="qte-input"
                       [(ngModel)]="quantites[a.id]" (click)="$event.stopPropagation()"
                       title="Quantité à livrer" placeholder="Qté">
              </label>
            </div>
          </div>

          <!-- Sélection des matières premières (Divalto) -->
          <div class="art-section" *ngIf="typeLivraison==='MATIERE_PREMIERE'">
            <div class="art-head">
              <label>Matières premières à transporter <span class="muted">({{ selectedMpCount() }} sélectionnée(s))</span></label>
            </div>
            <div class="field" style="margin-bottom:10px">
              <label>Commande (Divalto)</label>
              <select [(ngModel)]="commandeMpId" (change)="chargerLignesMp()">
                <option [ngValue]="undefined" disabled>— Choisir une commande —</option>
                <option *ngFor="let c of commandesMp" [ngValue]="c.cdno">
                  #{{ c.cdno }} — {{ c.projet || c.marche || '—' }}<span *ngIf="c.tiers"> · {{ c.tiers }}</span>
                </option>
              </select>
            </div>
            <input class="filtre-input" [(ngModel)]="filtreMatiere"
                   placeholder="🔍 Filtrer les lignes (désignation, réf)…" style="margin-bottom:10px">
            <div *ngIf="matieresLoading" class="spinner" style="margin:18px auto"></div>
            <div *ngIf="!matieresLoading && commandeMpId && matieresDispo.length===0" class="empty" style="padding:20px">
              <i class="fa-solid fa-cubes"></i> Aucune ligne pour cette commande
            </div>
            <div *ngIf="!commandeMpId" class="empty" style="padding:20px">
              <i class="fa-solid fa-file-invoice"></i> Choisissez d'abord une commande
            </div>
            <div class="art-list" *ngIf="!matieresLoading && matieresDispo.length">
              <label class="art-item" *ngFor="let m of matieresFiltres()" [class.checked]="selectedMp[m.reference || '']">
                <input type="checkbox" [(ngModel)]="selectedMp[m.reference || '']" (change)="onToggleMp(m)">
                <div class="art-info">
                  <strong>{{ m.designation || m.reference }}</strong>
                  <span class="muted">{{ m.reference }} · {{ m.unite || '—' }}<span *ngIf="m.projet"> · {{ m.projet }}</span></span>
                </div>
                <input *ngIf="selectedMp[m.reference || '']" type="number" min="1" step="1" class="qte-input"
                       [(ngModel)]="quantitesMp[m.reference || '']" (click)="$event.stopPropagation()"
                       title="Quantité à livrer" placeholder="Qté">
              </label>
            </div>
          </div>
        </div>
        <div class="m-foot">
          <button class="btn btn-outline" (click)="modal=false">Annuler</button>
          <button class="btn btn-primary" (click)="enregistrer()" [disabled]="saving">
            <i class="fa-solid fa-floppy-disk"></i> Enregistrer</button>
        </div>
      </div>
    </div>

    <!-- ════════ Modal DÉTAILS VOYAGE ════════ -->
    <div class="modal-backdrop" *ngIf="detail" (click)="fermerDetail($event)">
      <div class="modal" style="max-width:720px" (click)="$event.stopPropagation()">
        <div class="m-head">
          <h3>Voyage #{{ detail.id }} — {{ detail.client || 'Sans client' }}</h3>
          <button class="x" (click)="fermerDetailModal()">&times;</button>
        </div>
        <div class="m-body">
          <div class="detail-grid">
            <div><span class="dk">Transporteur</span><span class="dv">{{ detail.transporteur || '—' }}</span></div>
            <div><span class="dk">Camion</span><span class="dv">{{ detail.camionImmatriculation || '—' }}</span></div>
            <div><span class="dk">Chauffeur</span><span class="dv">{{ detail.chauffeur || '—' }}</span></div>
            <div><span class="dk">Statut</span><span class="dv"><span class="badge" [ngClass]="statutVoyage(detail).cls">{{ statutVoyage(detail).label }}</span></span></div>
            <div><span class="dk">Bon de livraison</span><span class="dv">
              <ng-container *ngIf="detail.hasBl; else noBl">
                <button class="btn btn-primary btn-sm" (click)="telechargerBL(detail)">
                  <i class="fa-solid fa-file-arrow-down"></i> Télécharger le BL</button>
                <span *ngIf="detail.bl" class="muted" style="margin-left:8px">Réf : {{ detail.bl }}</span>
              </ng-container>
              <ng-template #noBl><span class="muted">Pas encore livré</span></ng-template>
            </span></div>
            <div><span class="dk">Chargement</span><span class="dv">{{ detail.chargementJour || '—' }} {{ detail.chargementHeure || '' }}</span></div>
            <div><span class="dk">Déchargement</span><span class="dv">{{ detail.dechargementJour || '—' }} {{ detail.dechargementHeure || '' }}</span></div>
          </div>

          <div class="force-box">
            <div>
              <span class="dk">Code de forçage d'arrivée</span>
              <span class="force-code">{{ detail.forceCode || '— non généré —' }}</span>
              <span class="muted" style="font-size:11px">À communiquer au chauffeur pour valider l'arrivée hors zone.</span>
            </div>
            <button class="btn btn-outline btn-sm" (click)="regenererCode(detail)" [disabled]="regenCode">
              <i class="fa-solid fa-rotate"></i> Régénérer
            </button>
          </div>

          <h4 class="art-title">Articles du voyage ({{ detailArticles.length }})</h4>
          <div *ngIf="detailLoading" class="spinner" style="margin:20px auto"></div>
          <div *ngIf="!detailLoading && detailArticles.length===0" class="empty" style="padding:20px">
            <i class="fa-solid fa-boxes-stacked"></i> Aucun article rattaché
          </div>
          <div class="table-wrap" *ngIf="!detailLoading && detailArticles.length">
            <table>
              <thead><tr><th>Article</th><th>N° prix</th><th>Qté</th><th>Statut réception</th><th>Heure de scan</th><th>QR code</th></tr></thead>
              <tbody>
                <tr *ngFor="let a of detailArticles">
                  <td><strong>{{ a.designation || '—' }}</strong></td>
                  <td><code>{{ a.numPrix || '—' }}</code></td>
                  <td>{{ a.quantite ?? '—' }}</td>
                  <td><span class="badge badge-gray">{{ a.statutReception || '—' }}</span></td>
                  <td>{{ a.heureScan ? (a.heureScan | date:'dd/MM/yy HH:mm:ss') : '—' }}</td>
                  <td style="white-space:nowrap">
                    <img [src]="qrDetailUrl(a.id)" alt="QR" style="width:56px;height:56px;vertical-align:middle">
                    <a class="btn btn-outline btn-sm" style="margin-left:6px"
                       [href]="qrDetailUrl(a.id)" [download]="'qr-article-' + a.id + '.png'" target="_blank"
                       title="Télécharger le QR">
                      <i class="fa-solid fa-download"></i></a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="muted" style="font-size:12px;margin-top:14px">
            <i class="fa-solid fa-circle-info"></i> Le suivi GPS du chauffeur est consultable dans le <strong>Voyage</strong>.
          </p>
        </div>
        <div class="m-foot">
          <button class="btn btn-outline" (click)="fermerDetailModal()">Fermer</button>
        </div>
      </div>
    </div>
  `
})
export class VoyagesComponent implements OnInit {
  voyages: Voyage[] = [];
  loading = true; saving = false; modal = false;
  q = ''; vue: 'en-cours' | 'archives' = 'en-cours';
  dateDebut = ''; dateFin = '';

  // Référentiels pour le formulaire (tous depuis GAP)
  chauffeurs: GapChauffeur[] = [];
  chantiers: Chantier[] = [];
  articlesDispo: GapArticle[] = [];
  articlesLoading = false;
  selected: Record<number, boolean> = {};

  // Filtres / combobox des listes déroulantes (A3)
  filtreChauffeur = '';
  filtreChantier = '';
  filtreArticle = '';
  comboChauffeurOpen = false;
  comboChantierOpen = false;

  // Quantité à livrer par article sélectionné (A2)
  quantites: Record<number, number> = {};

  // Type de contenu de la livraison + matières premières
  typeLivraison: 'ARTICLE' | 'MATIERE_PREMIERE' = 'ARTICLE';
  commandesMp: CommandeMp[] = [];
  commandeMpId?: number;
  matieresDispo: MatierePremiere[] = [];
  matieresLoading = false;
  filtreMatiere = '';
  selectedMp: Record<string, boolean> = {};
  quantitesMp: Record<string, number> = {};
  private commandesChargees = false;

  form: VoyageRequest = {};
  editId: number | null = null;

  // Détails
  detail: Voyage | null = null;
  detailArticles: GapVoyageArticle[] = [];
  detailLoading = false;
  regenCode = false;
  trajet: TrajetVoyage | null = null;
  trajetLoading = false;
  private trajetMap?: L.Map;

  constructor(
    private svc: VoyageService,
    private chauffeurSvc: ChauffeurService,
    private chantierSvc: ChantierService,
    private articleSvc: ArticleService,
    private matiereSvc: MatierePremiereService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading = true;
    const done = (d: Voyage[]) => { this.voyages = d; this.loading = false; };
    const err = () => { this.voyages = []; this.loading = false; };
    if (this.vue === 'archives') {
      if (!this.dateDebut || !this.dateFin) { this.loading = false; return; }
      this.svc.archives(this.dateDebut + 'T00:00:00', this.dateFin + 'T23:59:59').subscribe({ next: done, error: err });
    } else {
      // Voyages lus depuis la base GAP (livraisons)
      this.svc.getFromGap().subscribe({ next: done, error: err });
    }
  }

  filtres(): Voyage[] {
    const t = this.q.toLowerCase().trim();
    if (!t) return this.voyages;
    return this.voyages.filter(v =>
      (v.client || '').toLowerCase().includes(t) ||
      (v.camionImmatriculation || '').toLowerCase().includes(t) ||
      (v.chauffeur || '').toLowerCase().includes(t) ||
      (v.transporteur || '').toLowerCase().includes(t));
  }

  /* ─────────── Création / Édition ─────────── */
  ouvrir(v?: Voyage): void {
    this.editId = v ? v.id : null;
    this.form = v
      ? {
          chauffeurId: v.chauffeurId,
          chantierId: v.chantierId,
          chargementJour: v.chargementJour,
          chargementHeure: v.chargementHeure,
          dechargementJour: v.dechargementJour,
          dechargementHeure: v.dechargementHeure
        }
      : {};
    this.selected = {};
    this.quantites = {};
    this.filtreChauffeur = ''; this.filtreChantier = ''; this.filtreArticle = '';
    this.comboChauffeurOpen = false; this.comboChantierOpen = false;
    // Matières premières : reset
    this.typeLivraison = 'ARTICLE';
    this.selectedMp = {}; this.quantitesMp = {}; this.filtreMatiere = '';
    this.commandesChargees = false; this.commandesMp = []; this.commandeMpId = undefined; this.matieresDispo = [];
    this.modal = true;
    this.articlesLoading = true;
    // Référentiels lus depuis GAP
    forkJoin({
      chauffeurs: this.chauffeurSvc.getFromGap().pipe(catchError(() => of([] as GapChauffeur[]))),
      chantiers:  this.chantierSvc.getFromGap().pipe(catchError(() => of([] as Chantier[]))),
      articles:   this.articleSvc.getFromGap().pipe(catchError(() => of([] as GapArticle[])))
    }).subscribe(({ chauffeurs, chantiers, articles }) => {
      this.chauffeurs = chauffeurs;
      this.chantiers = chantiers;
      this.articlesDispo = articles;
      this.articlesLoading = false;
      // En édition : pré-remplir les libellés des combobox + pré-cocher les articles
      if (v) {
        const c = chauffeurs.find(x => x.id === v.chauffeurId);
        if (c) this.filtreChauffeur = `${c.prenom || ''} ${c.nom || ''} (${c.matricule ?? ''})`.trim();
        const ch = chantiers.find(x => x.id === v.chantierId);
        if (ch) this.filtreChantier = ch.nom + (ch.ville ? ` — ${ch.ville}` : '');
        this.svc.articles(v.id).subscribe({
          next: lignes => lignes.forEach(l => {
            if (l.articleId != null) {
              this.selected[l.articleId] = true;
              if (l.quantite != null) this.quantites[l.articleId] = l.quantite;
            }
          }),
          error: () => {}
        });
      }
    });
  }

  fermer(e: Event): void { if (e.target === e.currentTarget) this.modal = false; }

  /* ─────────── Filtres de recherche (A3) ─────────── */
  chauffeursFiltres(): GapChauffeur[] {
    const t = this.filtreChauffeur.toLowerCase().trim();
    if (!t) return this.chauffeurs;
    return this.chauffeurs.filter(c =>
      `${c.prenom || ''} ${c.nom || ''} ${c.matricule ?? ''}`.toLowerCase().includes(t));
  }
  chantiersFiltres(): Chantier[] {
    const t = this.filtreChantier.toLowerCase().trim();
    if (!t) return this.chantiers;
    return this.chantiers.filter(ch =>
      `${ch.nom || ''} ${ch.ville || ''}`.toLowerCase().includes(t));
  }
  articlesFiltres(): GapArticle[] {
    const t = this.filtreArticle.toLowerCase().trim();
    if (!t) return this.articlesDispo;
    return this.articlesDispo.filter(a =>
      `${a.designation || ''} ${a.numPrix || ''} ${a.origineArticle || ''}`.toLowerCase().includes(t));
  }

  /** Sélection d'un chauffeur dans le combobox : fixe l'id et le libellé du champ. */
  choisirChauffeur(c: GapChauffeur): void {
    this.form.chauffeurId = c.id;
    this.filtreChauffeur = `${c.prenom || ''} ${c.nom || ''} (${c.matricule ?? ''})`.trim();
    this.comboChauffeurOpen = false;
  }
  /** Sélection d'un chantier dans le combobox. */
  choisirChantier(ch: Chantier): void {
    this.form.chantierId = ch.id;
    this.filtreChantier = ch.nom + (ch.ville ? ` — ${ch.ville}` : '');
    this.comboChantierOpen = false;
  }
  /** Ferme la liste du combobox (léger délai pour laisser le clic se déclencher). */
  fermerCombo(which: 'chauffeur' | 'chantier'): void {
    setTimeout(() => {
      if (which === 'chauffeur') this.comboChauffeurOpen = false;
      else this.comboChantierOpen = false;
    }, 150);
  }

  /** À la coche d'un article : initialise sa quantité à 1 si non définie. */
  onToggleArticle(a: GapArticle): void {
    if (this.selected[a.id] && (this.quantites[a.id] == null || this.quantites[a.id] <= 0)) {
      this.quantites[a.id] = 1;
    }
  }

  /* ─────────── Matières premières (commande → lignes) ─────────── */
  setType(t: 'ARTICLE' | 'MATIERE_PREMIERE'): void {
    this.typeLivraison = t;
    if (t === 'MATIERE_PREMIERE' && !this.commandesChargees) this.chargerCommandesMp();
  }
  chargerCommandesMp(): void {
    this.matiereSvc.getCommandes().subscribe({
      next: d => { this.commandesMp = d; this.commandesChargees = true; },
      error: () => this.toastr.error('Impossible de lire les commandes (Divalto).')
    });
  }
  chargerLignesMp(): void {
    if (!this.commandeMpId) return;
    this.matieresLoading = true;
    this.matieresDispo = [];
    this.matiereSvc.getLignes(this.commandeMpId).subscribe({
      next: d => { this.matieresDispo = d; this.matieresLoading = false; },
      error: () => { this.matieresLoading = false; this.toastr.error('Impossible de lire les lignes (Divalto).'); }
    });
  }
  matieresFiltres(): MatierePremiere[] {
    const t = this.filtreMatiere.toLowerCase().trim();
    if (!t) return this.matieresDispo;
    return this.matieresDispo.filter(m =>
      `${m.designation || ''} ${m.reference || ''} ${m.projet || ''}`.toLowerCase().includes(t));
  }
  onToggleMp(m: MatierePremiere): void {
    const k = m.reference || '';
    if (this.selectedMp[k] && (this.quantitesMp[k] == null || this.quantitesMp[k] <= 0)) {
      this.quantitesMp[k] = 1;
    }
  }
  selectedMpRefs(): string[] {
    return Object.keys(this.selectedMp).filter(k => this.selectedMp[k]);
  }
  selectedMpCount(): number { return this.selectedMpRefs().length; }

  selectedIds(): number[] {
    return Object.keys(this.selected).filter(k => this.selected[+k]).map(k => +k);
  }
  selectedCount(): number { return this.selectedIds().length; }
  allSelected(): boolean {
    return this.articlesDispo.length > 0 && this.selectedCount() === this.articlesDispo.length;
  }
  toggleAll(): void {
    const v = !this.allSelected();
    this.articlesDispo.forEach(a => this.selected[a.id] = v);
  }

  enregistrer(): void {
    if (!this.form.chantierId) { this.toastr.warning('Veuillez choisir un chantier.'); return; }
    this.form.typeLivraison = this.typeLivraison;
    if (this.typeLivraison === 'MATIERE_PREMIERE') {
      // Lignes de matières premières + quantités
      const refs = this.selectedMpRefs();
      this.form.matieres = refs.map(ref => {
        const m = this.matieresDispo.find(x => (x.reference || '') === ref);
        const q = this.quantitesMp[ref];
        return { ref, designation: m?.designation, unite: m?.unite, quantite: q && q > 0 ? q : 1 };
      });
      this.form.articleIds = []; this.form.articleQuantites = {};
    } else {
      this.form.articleIds = this.selectedIds();
      const q: Record<number, number> = {};
      this.form.articleIds.forEach(id => {
        q[id] = this.quantites[id] && this.quantites[id] > 0 ? this.quantites[id] : 1;
      });
      this.form.articleQuantites = q;
      this.form.matieres = [];
    }
    this.saving = true;
    const obs = this.editId
      ? this.svc.update(this.editId, this.form)
      : this.svc.create(this.form);
    obs.subscribe({
      next: () => {
        this.toastr.success(this.editId ? 'Livraison modifiée.' : 'Livraison créée.');
        this.modal = false; this.saving = false; this.charger();
      },
      error: () => { this.toastr.error('Échec de l’enregistrement.'); this.saving = false; }
    });
  }

  /* ─────────── Détails ─────────── */
  voirDetails(v: Voyage): void {
    this.detail = v;
    this.detailArticles = [];
    this.detailLoading = true;
    this.svc.articles(v.id).subscribe({
      next: arts => { this.detailArticles = arts; this.detailLoading = false; },
      error: () => { this.detailLoading = false; this.toastr.error('Articles indisponibles.'); }
    });
    // Suivi GPS du voyage (trajet + durée + carte)
    this.detruireCarte();
    this.trajet = null;
    this.trajetLoading = true;
    this.svc.trajet(v.id).subscribe({
      next: t => {
        this.trajet = t;
        this.trajetLoading = false;
        // Laisse Angular afficher le conteneur puis dessine la carte
        setTimeout(() => this.afficherTrajet(), 150);
      },
      error: () => { this.trajet = null; this.trajetLoading = false; }
    });
  }

  /** Dessine le trajet GPS sur une carte Leaflet (ligne bleue départ → position). */
  private afficherTrajet(): void {
    const pts = (this.trajet?.points || [])
      .filter(p => p.latitude != null && p.longitude != null)
      .map(p => [p.latitude as number, p.longitude as number] as L.LatLngTuple);
    const el = document.getElementById('voyage-trajet-map');
    if (!el || pts.length === 0) return;

    this.detruireCarte();
    const map = L.map('voyage-trajet-map');
    this.trajetMap = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap'
    }).addTo(map);

    // Ligne bleue du trajet
    const ligne = L.polyline(pts, { color: '#2563eb', weight: 4, opacity: 0.85 }).addTo(map);

    // Marqueur départ (vert) et position actuelle (rouge)
    const dot = (couleur: string) => L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${couleur};border:2px solid #fff;box-shadow:0 0 0 1px ${couleur}"></div>`,
      iconSize: [14, 14], iconAnchor: [7, 7],
    });
    L.marker(pts[0], { icon: dot('#16a34a') }).addTo(map).bindPopup('Départ (1ᵉʳ scan)');
    L.marker(pts[pts.length - 1], { icon: dot('#dc2626') }).addTo(map).bindPopup('Dernière position');

    // Destination (chantier) si géolocalisée
    if (this.detail?.destinationLat != null && this.detail?.destinationLng != null) {
      L.marker([this.detail.destinationLat, this.detail.destinationLng])
        .addTo(map).bindPopup('Destination : ' + (this.detail.destinationNom || 'chantier'));
    }

    // Cadrage : si plusieurs points distincts → ajuster aux limites, sinon centrer
    const distincts = new Set(pts.map(p => p[0] + ',' + p[1]));
    if (distincts.size > 1) {
      map.fitBounds(ligne.getBounds().pad(0.2));
    } else {
      map.setView(pts[0], 16);
    }
    setTimeout(() => map.invalidateSize(), 50);
  }

  private detruireCarte(): void {
    if (this.trajetMap) { this.trajetMap.remove(); this.trajetMap = undefined; }
  }

  /** URL du QR code (PNG) d'une ligne d'article du voyage (pour affichage + téléchargement). */
  qrDetailUrl(detailId: number): string {
    return `${environment.apiUrl}/articles/detail/${detailId}/qrcode`;
  }

  /** Durée formatée (ex. 1 h 25 min). */
  dureeLabel(min?: number | null): string {
    if (min == null) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  }
  fermerDetail(e: Event): void { if (e.target === e.currentTarget) this.fermerDetailModal(); }
  fermerDetailModal(): void { this.detruireCarte(); this.detail = null; }

  /** Régénère le code de forçage d'arrivée du voyage affiché */
  regenererCode(v: Voyage): void {
    this.regenCode = true;
    this.svc.regenererForceCode(v.id).subscribe({
      next: maj => {
        this.regenCode = false;
        if (this.detail) this.detail.forceCode = maj.forceCode;
        const idx = this.voyages.findIndex(x => x.id === v.id);
        if (idx >= 0) this.voyages[idx].forceCode = maj.forceCode;
        this.toastr.success('Nouveau code : ' + maj.forceCode);
      },
      error: () => { this.regenCode = false; this.toastr.error('Échec de la régénération.'); }
    });
  }

  /* ─────────── Actions ─────────── */
  archiver(v: Voyage): void {
    this.svc.archiver(v.id).subscribe({
      next: () => { this.toastr.success('Voyage archivé.'); this.charger(); },
      error: () => this.toastr.error('Échec archivage.')
    });
  }

  supprimer(v: Voyage): void {
    if (!confirm(`Supprimer le voyage #${v.id} ?`)) return;
    this.svc.supprimer(v.id).subscribe({
      next: () => { this.toastr.success('Voyage supprimé.'); this.charger(); },
      error: () => this.toastr.error('Échec suppression.')
    });
  }

  /** Statut global affiché : Livré > Chargé > statut brut */
  statutVoyage(v: Voyage): { label: string; cls: string } {
    if (v.etatDechargement === 'TERMINE') return { label: 'Livré', cls: 'badge-green' };
    if (v.etatChargement === 'TERMINE') return { label: 'Chargé', cls: 'badge-blue' };
    if (v.statut === 'ARCHIVE') return { label: 'Archivé', cls: 'badge-gray' };
    return { label: 'En cours', cls: 'badge-orange' };
  }

  /** Télécharge / ouvre le bon de livraison du voyage */
  telechargerBL(v: Voyage): void {
    this.svc.telechargerBL(v.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bon-livraison-voyage-${v.id}`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      },
      error: () => this.toastr.error('Bon de livraison indisponible.')
    });
  }

  etatClass(e?: string): string {
    switch (e) {
      case 'TERMINE': return 'badge-green';
      case 'EN_COURS': return 'badge-orange';
      case 'INCIDENT': return 'badge-red';
      default: return 'badge-gray';
    }
  }
}
