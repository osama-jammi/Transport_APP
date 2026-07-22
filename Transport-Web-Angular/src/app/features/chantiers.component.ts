import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import * as L from 'leaflet';
import { ChantierService } from '../services/chantier.service';
import { Chantier, ChantierRequest } from '../core/models';
import { SortState } from '../shared/sort.pipe';
import { matchesSearch, matchesFilters, ColumnFilters } from '../shared/column-filter';
import { FiltreField } from '../shared/filtre-panel.component';

@Component({
  selector: 'app-chantiers',
  template: `
    <div class="premium-chantiers">
      <div class="header">
        <h1><i class="fa-solid fa-helmet-safety"></i> Chantiers</h1>
        <p class="subtitle">Gestion des zones géographiques et chantiers de livraison.</p>
      </div>

      <div class="toolbar glass-panel">
        <div class="search-box">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input [(ngModel)]="q" (ngModelChange)="page=1" placeholder="Rechercher un chantier...">
        </div>
        <div class="actions">
          <button class="p-btn p-btn-light" [class.active]="filtresUI" (click)="basculerFiltres()" title="Filtrer par colonne">
            <i class="fa-solid fa-filter"></i> Filtres
          </button>
          <button class="p-btn p-btn-primary" (click)="ouvrir()">
            <i class="fa-solid fa-plus"></i> Nouveau chantier
          </button>
        </div>
      </div>

      <app-filtre-panel *ngIf="filtresUI" [fields]="filterFields" [filters]="colF" (change)="page=1"></app-filtre-panel>

      <div class="glass-card m-t">
        <div *ngIf="loading" class="spinner-modern"></div>
        <div *ngIf="!loading && filtres().length===0" class="empty">
          <i class="fa-solid fa-helmet-safety"></i> Aucun chantier trouvé
        </div>
        <div class="modern-table" *ngIf="!loading && filtres().length">
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of filtres() | sortBy:sortState | paginate:page:pageSize">
                <td class="id-col">#{{ c.id }}</td>
                <td><strong>{{ c.nom }}</strong></td>
                <td>{{ c.ville || '—' }}</td>
                <td class="muted">{{ c.lieu || '—' }}</td>
                <td class="mono">
                  <span *ngIf="c.latitude!=null">{{ c.latitude | number:'1.4-4' }}, {{ c.longitude | number:'1.4-4' }}</span>
                  <span *ngIf="c.latitude==null">—</span>
                </td>
                <td><span class="p-badge blue">{{ c.rayonMetres || 100 }} m</span></td>
                <td><span class="p-badge" [class.green]="c.actif" [class.gray]="!c.actif">{{ c.actif ? 'Actif' : 'Archivé' }}</span></td>
                <td class="action-cell">
                  <button class="p-btn p-btn-icon" (click)="ouvrir(c)"><i class="fa-solid fa-pen"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <app-paginator [total]="filtres().length" [page]="page" [pageSize]="pageSize"
                       (pageChange)="page = $event" (pageSizeChange)="pageSize = $event; page = 1"></app-paginator>
      </div>
    </div>

    <!-- Modal Chantier -->
    <div class="modal-backdrop" *ngIf="modal" (click)="fermer($event)">
      <div class="modal p-modal" style="max-width:800px" (click)="$event.stopPropagation()">
        <div class="m-head">
          <h3>{{ editId ? 'Modifier le chantier' : 'Nouveau chantier' }}</h3>
          <button class="x" (click)="close()">&times;</button>
        </div>
        <div class="m-body">
          <div class="form-grid">
            <div class="field"><label>Nom *</label><input [(ngModel)]="form.nom" class="p-input"></div>
            <div class="field"><label>Ville</label><input [(ngModel)]="form.ville" class="p-input"></div>
            <div class="field"><label>Lieu / adresse</label><input [(ngModel)]="form.lieu" class="p-input"></div>
          </div>

          <div class="map-pick">
            <div class="map-pick-head">
              <label><i class="fa-solid fa-location-dot"></i> Localisation & Zone</label>
              <span class="muted">Cliquez sur la carte pour positionner</span>
            </div>
            
            <div id="chantier-map" class="map-container"></div>

            <div class="zone-row">
              <div class="field flex-grow">
                <label>Rayon de la zone : <strong class="color-primary">{{ form.rayonMetres || 100 }} m</strong></label>
                <input type="range" class="modern-range" min="50" max="2000" step="10" [(ngModel)]="form.rayonMetres" (ngModelChange)="majCercle()">
              </div>
              <div class="zone-presets">
                <button type="button" class="p-btn p-btn-sm" 
                        *ngFor="let r of presets"
                        [ngClass]="form.rayonMetres===r ? 'p-btn-primary' : 'p-btn-light'" 
                        (click)="setRayon(r)">{{ r }}m</button>
              </div>
            </div>

            <div class="form-grid" style="grid-template-columns: 1fr 1fr; margin-top: 15px;">
              <div class="field">
                <label>Latitude</label>
                <input type="number" step="0.00001" [(ngModel)]="form.latitude" (ngModelChange)="majDepuisChamps()" class="p-input mono">
              </div>
              <div class="field">
                <label>Longitude</label>
                <input type="number" step="0.00001" [(ngModel)]="form.longitude" (ngModelChange)="majDepuisChamps()" class="p-input mono">
              </div>
            </div>
          </div>
        </div>
        <div class="m-foot">
          <button class="p-btn p-btn-light" (click)="close()">Annuler</button>
          <button class="p-btn p-btn-primary" (click)="enregistrer()" [disabled]="saving">
            <i class="fa-solid fa-check"></i> Enregistrer
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .premium-chantiers {
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
    .p-btn-sm { padding: 6px 12px; font-size: 0.85rem; }
    .p-btn-primary { background: #0ea5e9; color: #fff; box-shadow: 0 2px 10px rgba(14,165,233,0.3); }
    .p-btn-primary:hover { background: #0284c7; box-shadow: 0 4px 15px rgba(14,165,233,0.4); }
    .p-btn-primary[disabled] { opacity: 0.5; pointer-events: none; }
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
    .modern-table tr:hover td { background: #f8fafc; }
    .id-col { color: #64748b; font-family: monospace; font-size: 0.95rem; }
    .action-cell { text-align: right; white-space: nowrap; }

    .p-badge {
      padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;
      background: #f1f5f9; color: #64748b; text-transform: uppercase;
    }
    .p-badge.blue { background: #e0f2fe; color: #0284c7; }
    .p-badge.green { background: #dcfce7; color: #16a34a; }
    .p-badge.gray { background: #f1f5f9; color: #64748b; }

    .empty { padding: 40px; text-align: center; color: #94a3b8; font-style: italic; font-size: 1.1rem; }
    .muted { color: #94a3b8; }
    .mono { font-family: monospace; }
    .color-primary { color: #0ea5e9; }

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
    
    .spinner-modern {
      width: 40px; height: 40px; margin: 40px auto; border: 3px solid #e0f2fe; border-radius: 50%;
      border-top-color: #0ea5e9; animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Map specifics */
    .map-pick { margin-top: 25px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #f1f5f9; }
    .map-pick-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:15px; }
    .map-pick-head label { font-weight:700; font-size:1.05rem; color: #0f172a; }
    .map-container { height: 350px; border-radius: 12px; border: 1px solid #cbd5e1; z-index: 1; }
    .zone-row { display:flex; gap:20px; align-items:flex-end; margin-top:20px; flex-wrap:wrap; }
    .flex-grow { flex: 1; }
    .modern-range {
      width: 100%; margin-top: 10px; -webkit-appearance: none; background: #cbd5e1;
      height: 6px; border-radius: 3px; outline: none;
    }
    .modern-range::-webkit-slider-thumb {
      -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%;
      background: #0ea5e9; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    .zone-presets { display:flex; gap:8px; flex-wrap:wrap; margin-bottom: 2px; }
  `]
})
export class ChantiersComponent implements OnInit {
  chantiers: Chantier[] = [];
  loading = true; saving = false; modal = false;
  page = 1; pageSize = 10;
  q = ''; editId: number | null = null;
  filtresUI = false;
  colF: ColumnFilters = {};
  filterFields: FiltreField[] = [
    { key: 'id', label: 'ID', icon: 'fa-hashtag', placeholder: 'ID' },
    { key: 'nom', label: 'Nom', icon: 'fa-helmet-safety', placeholder: 'Nom du chantier' },
    { key: 'ville', label: 'Ville', icon: 'fa-city', placeholder: 'Ville' },
    { key: 'lieu', label: 'Lieu', icon: 'fa-location-dot', placeholder: 'Lieu' },
    { key: 'rayonMetres', label: 'Zone (m)', icon: 'fa-circle-notch', placeholder: 'Rayon en mètres' },
  ];
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
    this.svc.getFromGap().subscribe({
      next: d => { this.chantiers = d; this.loading = false; },
      error: () => { this.chantiers = []; this.loading = false; }
    });
  }

  filtres(): Chantier[] {
    return this.chantiers.filter(c => matchesSearch(c, this.q) && matchesFilters(c, this.colF));
  }

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
    const lat = this.form.latitude ?? 36.7372;
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
        radius: rayon, color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.15, weight: 2
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
