import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { VoyageConteneurService } from '../services/voyage-conteneur.service';
import { ChauffeurService } from '../services/chauffeur.service';
import { VoyageService } from '../services/voyage.service';
import { environment } from '../../environments/environment';
import {
  VoyageConteneur, VoyageConteneurRequest, GapVoyage, GapChauffeur,
  GapVoyageArticle, MatierePremiere, TrajetVoyage
} from '../core/models';
import * as L from 'leaflet';

@Component({
  selector: 'app-voyages-conteneurs',
  template: `
    <div class="toolbar">
      <span class="badge badge-blue"><i class="fa-solid fa-truck-fast"></i> Un voyage regroupe plusieurs livraisons</span>
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
          <thead><tr><th>ID</th><th>Date</th><th>Chauffeur</th><th>Livraisons</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let v of voyages">
              <td><code>#{{ v.id }}</code></td>
              <td>{{ v.dateVoyage ? (v.dateVoyage | date:'dd/MM/yy HH:mm') : '—' }}</td>
              <td>{{ v.chauffeur || '—' }}</td>
              <td><span class="badge badge-gray">{{ v.nbLivraisons ?? 0 }}</span></td>
              <td><span class="badge badge-orange">{{ v.statut || '—' }}</span></td>
              <td class="flex">
                <button class="btn btn-outline btn-sm" (click)="consulter(v)" title="Consulter le détail">
                  <i class="fa-solid fa-eye"></i> Détails</button>
                <button class="btn btn-outline btn-sm" (click)="ouvrir(v)" title="Gérer les livraisons">
                  <i class="fa-solid fa-pen"></i> Gérer</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div></div>

    <!-- Modal créer / gérer un voyage -->
    <div class="modal-backdrop" *ngIf="modal" (click)="fermer($event)">
      <div class="modal" style="max-width:760px" (click)="$event.stopPropagation()">
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

          <div class="form-grid">
            <div class="field"><label>Jour chargement</label>
              <input type="date" [(ngModel)]="form.chargementJour"></div>
            <div class="field"><label>Heure chargement</label>
              <input type="time" [(ngModel)]="form.chargementHeure"></div>
            <div class="field"><label>Jour déchargement</label>
              <input type="date" [(ngModel)]="form.dechargementJour"></div>
            <div class="field"><label>Heure déchargement</label>
              <input type="time" [(ngModel)]="form.dechargementHeure"></div>
          </div>

          <div class="art-section">
            <div class="art-head">
              <label>Livraisons du voyage <span class="muted">({{ selectedCount() }} sélectionnée(s))</span></label>
            </div>
            <input class="filtre-input" [(ngModel)]="filtreLivraison"
                   placeholder="🔍 Filtrer les livraisons (chantier, chauffeur)…" style="margin-bottom:10px">
            <div *ngIf="livLoading" class="spinner" style="margin:18px auto"></div>
            <div *ngIf="!livLoading && livraisons.length===0" class="empty" style="padding:20px">
              <i class="fa-solid fa-box"></i> Aucune livraison disponible
            </div>
            <div class="art-list" *ngIf="!livLoading && livraisons.length">
              <label class="art-item" *ngFor="let l of livraisonsFiltres()" [class.checked]="selected[l.id]">
                <input type="checkbox" [(ngModel)]="selected[l.id]">
                <div class="art-info">
                  <strong>#{{ l.id }} — {{ l.projetDesignation || l.projetCode || 'Sans chantier' }}</strong>
                  <span class="muted">{{ l.chauffeur || '—' }} · {{ l.nbArticles }} article(s) · {{ l.statutReception || '—' }}</span>
                </div>
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

    <!-- Modal DÉTAIL du voyage -->
    <div class="modal-backdrop" *ngIf="detail" (click)="fermerDetail($event)">
      <div class="modal" style="max-width:900px" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>Voyage #{{ detail.id }}</h3>
          <button class="x" (click)="fermerDetailModal()">&times;</button></div>
        <div class="m-body">
          <div class="detail-grid">
            <div><span class="dk">Chauffeur</span><span class="dv">{{ detail.chauffeur || '—' }}</span></div>
            <div><span class="dk">Statut</span><span class="dv"><span class="badge badge-orange">{{ detail.statut || '—' }}</span></span></div>
            <div><span class="dk">Chargement</span><span class="dv">{{ detail.chargement ? (detail.chargement | date:'dd/MM/yy HH:mm') : '—' }}</span></div>
            <div><span class="dk">Déchargement</span><span class="dv">{{ detail.dechargement ? (detail.dechargement | date:'dd/MM/yy HH:mm') : '—' }}</span></div>
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
              <strong>#{{ l.id }} — {{ l.projetDesignation || l.projetCode || 'Sans chantier' }}</strong>
              <span class="badge badge-gray" style="margin-left:8px">{{ l.statutReception || '—' }}</span>

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
  modal = false; saving = false;
  editId: number | null = null;

  chauffeurs: GapChauffeur[] = [];
  chauffeurId?: number;
  filtreChauffeur = '';
  comboOpen = false;
  form: { chargementJour?: string; chargementHeure?: string; dechargementJour?: string; dechargementHeure?: string } = {};

  livraisons: GapVoyage[] = [];
  livLoading = false;
  filtreLivraison = '';
  selected: Record<number, boolean> = {};

  // Détail (consultation)
  detail: VoyageConteneur | null = null;
  detailLivraisons: GapVoyage[] = [];
  contenu: Record<number, { articles: GapVoyageArticle[]; matieres: MatierePremiere[] }> = {};
  detailLoading = false;
  trajet: TrajetVoyage | null = null;
  trajetLoading = false;
  artDetailId: number | null = null;
  private trajetMap?: L.Map;

  constructor(
    private svc: VoyageConteneurService,
    private chauffeurSvc: ChauffeurService,
    private voyageSvc: VoyageService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading = true;
    this.svc.getAll().subscribe({
      next: d => { this.voyages = d; this.loading = false; },
      error: () => { this.voyages = []; this.loading = false; this.toastr.error('Impossible de charger les voyages.'); }
    });
  }

  ouvrir(v?: VoyageConteneur): void {
    this.editId = v ? v.id : null;
    this.chauffeurId = v ? v.chauffeurId : undefined;
    this.filtreChauffeur = v && v.chauffeur ? v.chauffeur : '';
    this.filtreLivraison = '';
    this.selected = {};
    this.comboOpen = false;
    // Pré-remplit les heures (datetime ISO → jour + heure)
    const split = (iso?: string) => iso ? { jour: iso.slice(0, 10), heure: iso.slice(11, 16) } : { jour: undefined, heure: undefined };
    const c = split(v?.chargement); const d = split(v?.dechargement);
    this.form = {
      chargementJour: c.jour, chargementHeure: c.heure,
      dechargementJour: d.jour, dechargementHeure: d.heure
    };
    this.modal = true;
    this.livLoading = true;
    const vid = v ? v.id : 0; // 0 = nouveau voyage → renvoie les livraisons libres
    forkJoin({
      chauffeurs: this.chauffeurSvc.getFromGap().pipe(catchError(() => of([] as GapChauffeur[]))),
      livraisons: this.svc.livraisonsAssignables(vid).pipe(catchError(() => of([] as GapVoyage[])))
    }).subscribe(({ chauffeurs, livraisons }) => {
      this.chauffeurs = chauffeurs;
      this.livraisons = livraisons;
      // Pré-cocher celles déjà rattachées à ce voyage
      if (v) livraisons.forEach(l => { if (l.voyageId === v.id) this.selected[l.id] = true; });
      this.livLoading = false;
    });
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

  livraisonsFiltres(): GapVoyage[] {
    const t = this.filtreLivraison.toLowerCase().trim();
    if (!t) return this.livraisons;
    return this.livraisons.filter(l =>
      `${l.projetDesignation || ''} ${l.projetCode || ''} ${l.chauffeur || ''} ${l.id}`.toLowerCase().includes(t));
  }

  selectedIds(): number[] {
    return Object.keys(this.selected).filter(k => this.selected[+k]).map(k => +k);
  }
  selectedCount(): number { return this.selectedIds().length; }

  enregistrer(): void {
    if (!this.chauffeurId) { this.toastr.warning('Veuillez choisir un chauffeur.'); return; }
    const req: VoyageConteneurRequest = {
      chauffeurId: this.chauffeurId,
      livraisonIds: this.selectedIds(),
      chargementJour: this.form.chargementJour,
      chargementHeure: this.form.chargementHeure,
      dechargementJour: this.form.dechargementJour,
      dechargementHeure: this.form.dechargementHeure
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
