import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import * as L from 'leaflet';
import { ChantierService } from '../services/chantier.service';
import { Chantier, ChantierRequest } from '../core/models';
import { SortState } from '../shared/sort.pipe';
import { matchesSearch, matchesFilters, ColumnFilters } from '../shared/column-filter';

@Component({
  selector: 'app-chantiers',
  template: `
    <div class="toolbar">
      <div class="search"><i class="fa-solid fa-magnifying-glass"></i>
        <input [(ngModel)]="q" (ngModelChange)="page=1" placeholder="Rechercher un chantier…"></div>
      <button class="btn" [ngClass]="filtresUI ? 'btn-primary' : 'btn-outline'" (click)="basculerFiltres()"
              title="Filtrer par colonne">
        <i class="fa-solid fa-filter"></i> Filtres</button>
      <button class="btn btn-primary right" (click)="ouvrir()">
        <i class="fa-solid fa-plus"></i> Nouveau chantier</button>
    </div>

    <div class="card"><div class="card-body" style="padding:0">
      <div *ngIf="loading" class="spinner"></div>
      <div *ngIf="!loading && filtres().length===0" class="empty"><i class="fa-solid fa-helmet-safety"></i> Aucun chantier</div>
      <div class="table-wrap" *ngIf="!loading && filtres().length">
        <table>
          <thead>
            <tr>
            <th appSortable="id" [(state)]="sortState">ID</th>
            <th appSortable="nom" [(state)]="sortState">Nom</th>
            <th appSortable="ville" [(state)]="sortState">Ville</th>
            <th appSortable="lieu" [(state)]="sortState">Lieu</th>
            <th>Coordonnées</th>
            <th appSortable="rayonMetres" [(state)]="sortState">Zone</th>
            <th appSortable="actif" [(state)]="sortState">Statut</th>
            <th>Actions</th></tr>
            <tr class="col-filter-row" *ngIf="filtresUI">
              <th appColFilter="id" [filters]="colF" (filterChange)="page=1" placeholder="ID"></th>
              <th appColFilter="nom" [filters]="colF" (filterChange)="page=1" placeholder="Nom"></th>
              <th appColFilter="ville" [filters]="colF" (filterChange)="page=1" placeholder="Ville"></th>
              <th appColFilter="lieu" [filters]="colF" (filterChange)="page=1" placeholder="Lieu"></th>
              <th></th>
              <th appColFilter="rayonMetres" [filters]="colF" (filterChange)="page=1" placeholder="m"></th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let c of filtres() | sortBy:sortState | paginate:page:pageSize">
              <td><code>{{ c.id }}</code></td>
              <td><strong>{{ c.nom }}</strong></td>
              <td>{{ c.ville || '—' }}</td>
              <td>{{ c.lieu || '—' }}</td>
              <td class="mono">{{ c.latitude!=null ? (c.latitude | number:'1.4-4') : '—' }}, {{ c.longitude!=null ? (c.longitude | number:'1.4-4') : '—' }}</td>
              <td><span class="badge badge-blue">{{ c.rayonMetres || 100 }} m</span></td>
              <td><span class="badge" [ngClass]="c.actif ? 'badge-green' : 'badge-gray'">{{ c.actif ? 'Actif' : 'Archivé' }}</span></td>
              <td class="flex">
                <button class="btn btn-outline btn-sm" (click)="ouvrir(c)"><i class="fa-solid fa-pen"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <app-paginator [total]="filtres().length" [page]="page" [pageSize]="pageSize"
                     (pageChange)="page = $event" (pageSizeChange)="pageSize = $event; page = 1"></app-paginator>
    </div></div>

    <div class="modal-backdrop" *ngIf="modal" (click)="fermer($event)">
      <div class="modal" style="max-width:680px" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>{{ editId ? 'Modifier' : 'Nouveau' }} chantier</h3>
          <button class="x" (click)="close()">&times;</button></div>
        <div class="m-body">
          <div class="form-grid">
            <div class="field"><label>Nom *</label><input [(ngModel)]="form.nom"></div>
            <div class="field"><label>Ville</label><input [(ngModel)]="form.ville"></div>
            <div class="field"><label>Lieu / adresse</label><input [(ngModel)]="form.lieu"></div>
          </div>

          <div class="map-pick">
            <div class="map-pick-head">
              <label><i class="fa-solid fa-location-dot"></i> Localisation &amp; zone du chantier</label>
              <span class="muted">Cliquez sur la carte pour positionner le chantier</span>
            </div>
            <div id="chantier-map" class="map" style="height:300px"></div>

            <div class="zone-row">
              <div class="field" style="flex:1">
                <label>Rayon de la zone : <strong>{{ form.rayonMetres || 100 }} m</strong></label>
                <input type="range" min="50" max="2000" step="10"
                       [(ngModel)]="form.rayonMetres" (ngModelChange)="majCercle()">
              </div>
              <div class="zone-presets">
                <button type="button" class="btn btn-outline btn-sm" *ngFor="let r of presets"
                        [class.btn-primary]="form.rayonMetres===r" (click)="setRayon(r)">{{ r }} m</button>
              </div>
            </div>

            <div class="form-grid">
              <div class="field"><label>Latitude</label>
                <input type="number" step="0.00001" [(ngModel)]="form.latitude" (ngModelChange)="majDepuisChamps()"></div>
              <div class="field"><label>Longitude</label>
                <input type="number" step="0.00001" [(ngModel)]="form.longitude" (ngModelChange)="majDepuisChamps()"></div>
            </div>
          </div>
        </div>
        <div class="m-foot">
          <button class="btn btn-outline" (click)="close()">Annuler</button>
          <button class="btn btn-primary" (click)="enregistrer()" [disabled]="saving">
            <i class="fa-solid fa-floppy-disk"></i> Enregistrer</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .map-pick { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 14px; }
    .map-pick-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; flex-wrap:wrap; gap:4px; }
    .map-pick-head label { font-weight:600; font-size:13px; }
    .zone-row { display:flex; gap:16px; align-items:flex-end; margin:14px 0; flex-wrap:wrap; }
    .zone-row input[type=range] { width:100%; accent-color: var(--primary); }
    .zone-presets { display:flex; gap:6px; flex-wrap:wrap; }
  `]
})
export class ChantiersComponent implements OnInit {
  chantiers: Chantier[] = [];
  loading = true; saving = false; modal = false;
  page = 1; pageSize = 10;
  q = ''; editId: number | null = null;
  filtresUI = false;
  colF: ColumnFilters = {};
  sortState: SortState = { key: '', dir: 'asc' };
  form: ChantierRequest = { nom: '', rayonMetres: 100 };
  presets = [100, 250, 500, 1000];

  private map?: L.Map;
  private marker?: L.Marker;
  private circle?: L.Circle;

  private icon = L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });

  constructor(private svc: ChantierService, private toastr: ToastrService) {}

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading = true;
    // Chantiers lus depuis la base GAP (table projet)
    this.svc.getFromGap().subscribe({
      next: d => { this.chantiers = d; this.loading = false; },
      error: () => { this.chantiers = []; this.loading = false; }
    });
  }

  filtres(): Chantier[] {
    return this.chantiers.filter(c => matchesSearch(c, this.q) && matchesFilters(c, this.colF));
  }

  /** Affiche/masque la ligne de filtres par colonne (et réinitialise à la fermeture). */
  basculerFiltres(): void {
    this.filtresUI = !this.filtresUI;
    if (!this.filtresUI) { this.colF = {}; this.page = 1; }
  }

  ouvrir(c?: Chantier): void {
    if (c) {
      this.editId = c.id;
      this.form = { nom: c.nom, ville: c.ville, lieu: c.lieu, latitude: c.latitude,
                    longitude: c.longitude, rayonMetres: c.rayonMetres || 100 };
    } else {
      this.editId = null;
      this.form = { nom: '', rayonMetres: 100 };
    }
    this.modal = true;
    setTimeout(() => this.initMap(), 80);
  }

  fermer(e: Event): void { if (e.target === e.currentTarget) this.close(); }
  close(): void { this.modal = false; this.detruireMap(); }

  /* ─────────── Carte ─────────── */
  private initMap(): void {
    this.detruireMap();
    const lat = this.form.latitude ?? 36.7372;   // Alger par défaut
    const lng = this.form.longitude ?? 3.0865;
    const hasPoint = this.form.latitude != null && this.form.longitude != null;

    this.map = L.map('chantier-map').setView([lat, lng], hasPoint ? 15 : 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap'
    }).addTo(this.map);

    if (hasPoint) this.placer(lat, lng);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.form.latitude = +e.latlng.lat.toFixed(6);
      this.form.longitude = +e.latlng.lng.toFixed(6);
      this.placer(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => this.map?.invalidateSize(), 120);
  }

  private placer(lat: number, lng: number): void {
    if (!this.map) return;
    const rayon = +(this.form.rayonMetres || 100);
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = L.marker([lat, lng], { icon: this.icon, draggable: true }).addTo(this.map);
      this.marker.on('dragend', () => {
        const p = this.marker!.getLatLng();
        this.form.latitude = +p.lat.toFixed(6);
        this.form.longitude = +p.lng.toFixed(6);
        this.circle?.setLatLng(p);
      });
    }
    if (this.circle) {
      this.circle.setLatLng([lat, lng]);
      this.circle.setRadius(rayon);
    } else {
      this.circle = L.circle([lat, lng], {
        radius: rayon, color: '#17A2B8', fillColor: '#17A2B8', fillOpacity: 0.15, weight: 2
      }).addTo(this.map);
    }
  }

  majCercle(): void {
    this.form.rayonMetres = +(this.form.rayonMetres || 100);
    if (this.circle) this.circle.setRadius(this.form.rayonMetres);
  }
  setRayon(r: number): void { this.form.rayonMetres = r; this.majCercle(); }

  majDepuisChamps(): void {
    if (this.form.latitude != null && this.form.longitude != null && this.map) {
      this.placer(this.form.latitude, this.form.longitude);
      this.map.setView([this.form.latitude, this.form.longitude], Math.max(this.map.getZoom(), 14));
    }
  }

  private detruireMap(): void {
    this.map?.remove();
    this.map = undefined; this.marker = undefined; this.circle = undefined;
  }

  /* ─────────── CRUD ─────────── */
  enregistrer(): void {
    if (!this.form.nom) { this.toastr.warning('Le nom est obligatoire.'); return; }
    this.saving = true;
    const obs = this.editId ? this.svc.update(this.editId, this.form) : this.svc.create(this.form);
    obs.subscribe({
      next: () => { this.toastr.success('Chantier enregistré.'); this.close(); this.saving = false; this.charger(); },
      error: () => { this.toastr.error('Échec enregistrement.'); this.saving = false; }
    });
  }
}
