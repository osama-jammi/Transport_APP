import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { DepotService } from '../services/depot.service';
import { Depot } from '../core/models';
import { SortState } from '../shared/sort.pipe';
import { matchesSearch, matchesFilters, ColumnFilters } from '../shared/column-filter';
import { FiltreField } from '../shared/filtre-panel.component';
import * as L from 'leaflet';

@Component({
  selector: 'app-depots',
  template: `
    <div class="premium-depots">
      <div class="header">
        <h1><i class="fa-solid fa-warehouse"></i> Dépôts</h1>
        <p class="subtitle">Gestion des entrepôts et points de chargement.</p>
      </div>

      <div class="toolbar glass-panel">
        <div class="search-box">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input [(ngModel)]="q" (ngModelChange)="page=1" placeholder="Rechercher un dépôt...">
        </div>
        <div class="actions">
          <button class="p-btn p-btn-light" [class.active]="filtresUI" (click)="basculerFiltres()" title="Filtrer par colonne">
            <i class="fa-solid fa-filter"></i> Filtres
          </button>
          <button class="p-btn p-btn-primary" (click)="ouvrir()">
            <i class="fa-solid fa-plus"></i> Nouveau dépôt
          </button>
        </div>
      </div>

      <app-filtre-panel *ngIf="filtresUI" [fields]="filterFields" [filters]="colF" (change)="page=1"></app-filtre-panel>

      <div class="glass-card m-t">
        <div *ngIf="loading" class="spinner-modern"></div>
        <div *ngIf="!loading && depotsFiltres().length===0" class="empty">
          <i class="fa-solid fa-warehouse"></i>
          <div>Aucun dépôt trouvé.</div>
        </div>
        
        <div class="modern-table" *ngIf="!loading && depotsFiltres().length">
          <table>
            <thead>
              <tr>
                <th appSortable="id" [(state)]="sortState">ID</th>
                <th appSortable="nom" [(state)]="sortState">Nom</th>
                <th appSortable="latitude" [(state)]="sortState">Coordonnées</th>
                <th appSortable="rayon" [(state)]="sortState">Rayon (m)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let d of depotsFiltres() | sortBy:sortState | paginate:page:pageSize">
                <td class="id-col">#{{ d.id }}</td>
                <td><strong>{{ d.nom || '—' }}</strong></td>
                <td class="mono muted">
                  <span *ngIf="d.latitude!=null">{{ d.latitude | number:'1.4-4' }}, {{ d.longitude | number:'1.4-4' }}</span>
                  <span *ngIf="d.latitude==null">—</span>
                </td>
                <td><span class="p-badge blue">{{ d.rayon ?? 100 }} m</span></td>
                <td class="action-cell">
                  <button class="p-btn p-btn-icon" (click)="ouvrir(d)" title="Modifier"><i class="fa-solid fa-pen"></i></button>
                  <button class="p-btn p-btn-icon danger" (click)="supprimer(d)" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <app-paginator [total]="depotsFiltres().length" [page]="page" [pageSize]="pageSize"
                       (pageChange)="page = $event" (pageSizeChange)="pageSize = $event; page = 1"></app-paginator>
      </div>
    </div>

    <!-- Modal Dépôt -->
    <div class="modal-backdrop" *ngIf="modal" (click)="fermer($event)">
      <div class="modal p-modal" style="max-width:800px" (click)="$event.stopPropagation()">
        <div class="m-head">
          <h3>{{ editId ? 'Modifier le dépôt' : 'Nouveau dépôt' }}</h3>
          <button class="x" (click)="fermerModal()">&times;</button>
        </div>
        
        <div class="m-body">
          <div class="form-grid">
            <div class="field"><label>Nom du dépôt *</label><input [(ngModel)]="form.nom" class="p-input" placeholder="Ex : Dépôt central"></div>
          </div>
          
          <div class="map-pick">
            <div class="map-pick-head">
              <label><i class="fa-solid fa-location-dot"></i> Localisation & Rayon</label>
              <span class="muted" style="font-size:0.9rem">Cliquez sur la carte ou saisissez les coordonnées</span>
            </div>
            
            <div id="depot-map" class="map-container"></div>
            
            <div class="zone-row">
              <div class="field flex-grow">
                <label>Rayon de la zone : <strong class="color-primary">{{ form.rayon || 100 }} m</strong></label>
                <input type="range" class="modern-range" min="50" max="2000" step="10" [(ngModel)]="form.rayon" (change)="appliquerCoords()">
              </div>
            </div>

            <div class="form-grid" style="grid-template-columns: 1fr 1fr; margin-top: 15px;">
              <div class="field">
                <label>Latitude</label>
                <input type="number" step="any" [(ngModel)]="form.latitude" (change)="appliquerCoords()" class="p-input mono" placeholder="33.5731">
              </div>
              <div class="field">
                <label>Longitude</label>
                <input type="number" step="any" [(ngModel)]="form.longitude" (change)="appliquerCoords()" class="p-input mono" placeholder="-7.5898">
              </div>
            </div>
          </div>
        </div>
        
        <div class="m-foot">
          <button class="p-btn p-btn-light" (click)="fermerModal()">Annuler</button>
          <button class="p-btn p-btn-primary" (click)="enregistrer()" [disabled]="saving">
            <i class="fa-solid fa-check"></i> Enregistrer
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .premium-depots {
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
    .p-btn-primary { background: #0ea5e9; color: #fff; box-shadow: 0 2px 10px rgba(14,165,233,0.3); }
    .p-btn-primary:hover { background: #0284c7; box-shadow: 0 4px 15px rgba(14,165,233,0.4); }
    .p-btn-primary[disabled] { opacity: 0.5; pointer-events: none; }
    .p-btn-light { background: #f1f5f9; color: #475569; }
    .p-btn-light:hover { background: #e2e8f0; }
    .p-btn-light.active { background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; }

    .p-btn-icon { padding: 6px; border-radius: 6px; background: transparent; color: #64748b; font-size: 1rem; }
    .p-btn-icon:hover { background: #f1f5f9; color: #0f172a; }
    .p-btn-icon.danger:hover { background: #fee2e2; color: #ef4444; }

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
      background: #f1f5f9; color: #64748b; text-transform: uppercase; display: inline-flex; align-items: center; gap: 6px;
    }
    .p-badge.blue { background: #e0f2fe; color: #0284c7; }

    .empty { padding: 40px; text-align: center; color: #94a3b8; font-size: 1.1rem; display:flex; flex-direction:column; align-items:center; gap: 15px; }
    .empty i { font-size: 3rem; color: #cbd5e1; }
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
  `]
})
export class DepotsComponent implements OnInit {
  depots: Depot[] = [];
  loading = true; saving = false; modal = false;
  editId: number | null = null;
  form: Depot = {};
  q = ''; page = 1; pageSize = 10;
  filtresUI = false;
  colF: ColumnFilters = {};
  filterFields: FiltreField[] = [
    { key: 'id', label: 'ID', icon: 'fa-hashtag', placeholder: 'ID' },
    { key: 'nom', label: 'Nom', icon: 'fa-warehouse', placeholder: 'Nom du dépôt' },
    { key: 'latitude', label: 'Latitude', icon: 'fa-location-crosshairs', placeholder: 'Lat' },
    { key: 'longitude', label: 'Longitude', icon: 'fa-location-crosshairs', placeholder: 'Lng' },
    { key: 'rayon', label: 'Rayon (m)', icon: 'fa-circle-notch', placeholder: 'Rayon en mètres' },
  ];
  sortState: SortState = { key: '', dir: 'asc' };
  private map?: L.Map;
  private marker?: L.Marker;
  private circle?: L.Circle;

  constructor(private svc: DepotService, private toastr: ToastrService) {}

  ngOnInit(): void { this.charger(); }

  depotsFiltres(): Depot[] {
    return this.depots.filter(d => matchesSearch(d, this.q) && matchesFilters(d, this.colF));
  }

  basculerFiltres(): void {
    this.filtresUI = !this.filtresUI;
    if (!this.filtresUI) { this.colF = {}; this.page = 1; }
  }

  charger(): void {
    this.loading = true;
    this.svc.getAll().subscribe({
      next: d => { this.depots = d; this.loading = false; },
      error: () => { this.depots = []; this.loading = false; this.toastr.error('Impossible de charger les dépôts.'); }
    });
  }

  ouvrir(d?: Depot): void {
    this.editId = d?.id ?? null;
    this.form = d ? { ...d } : {};
    this.modal = true;
    setTimeout(() => this.afficherMap(), 100);
  }
  
  fermer(e: Event): void { if (e.target === e.currentTarget) this.fermerModal(); }
  fermerModal(): void { this.detruireMap(); this.modal = false; }

  private afficherMap(): void {
    const el = document.getElementById('depot-map');
    if (!el) return;
    this.detruireMap();
    const start: L.LatLngTuple = (this.form.latitude != null && this.form.longitude != null)
      ? [this.form.latitude, this.form.longitude] : [33.5731, -7.5898];
    const map = L.map('depot-map').setView(start, this.form.latitude != null ? 15 : 11);
    this.map = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    
    if (this.form.latitude != null) {
      this.marker = L.marker(start).addTo(map);
      this.circle = L.circle(start, {
        radius: this.form.rayon || 100,
        color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.15, weight: 2
      }).addTo(map);
    }
    
    map.on('click', (e: L.LeafletMouseEvent) => {
      this.form.latitude = +e.latlng.lat.toFixed(6);
      this.form.longitude = +e.latlng.lng.toFixed(6);
      if (this.marker) {
        this.marker.setLatLng(e.latlng); 
        this.circle?.setLatLng(e.latlng);
      } else {
        this.marker = L.marker(e.latlng).addTo(map);
        this.circle = L.circle(e.latlng, {
          radius: this.form.rayon || 100,
          color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.15, weight: 2
        }).addTo(map);
      }
    });
    setTimeout(() => map.invalidateSize(), 60);
  }
  
  private detruireMap(): void { 
    if (this.map) { 
      this.map.remove(); 
      this.map = undefined; 
      this.marker = undefined; 
      this.circle = undefined;
    } 
  }

  appliquerCoords(): void {
    if (this.form.latitude == null || this.form.longitude == null || !this.map) return;
    const pos: L.LatLngTuple = [this.form.latitude, this.form.longitude];
    if (this.marker) {
      this.marker.setLatLng(pos);
      if (this.circle) {
        this.circle.setLatLng(pos);
        this.circle.setRadius(this.form.rayon || 100);
      }
    } else {
      this.marker = L.marker(pos).addTo(this.map);
      this.circle = L.circle(pos, {
        radius: this.form.rayon || 100,
        color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.15, weight: 2
      }).addTo(this.map);
    }
    this.map.setView(pos, 15);
  }

  enregistrer(): void {
    if (!this.form.nom) { this.toastr.warning('Le nom du dépôt est obligatoire.'); return; }
    this.saving = true;
    const ok = () => { this.toastr.success('Dépôt enregistré.'); this.fermerModal(); this.saving = false; this.charger(); };
    const ko = () => { this.toastr.error('Échec de l’enregistrement.'); this.saving = false; };
    if (this.editId) this.svc.update(this.editId, this.form).subscribe({ next: ok, error: ko });
    else this.svc.create(this.form).subscribe({ next: ok, error: ko });
  }

  supprimer(d: Depot): void {
    if (!d.id || !confirm(`Supprimer le dépôt "${d.nom}" ?`)) return;
    this.svc.delete(d.id).subscribe({
      next: () => { this.toastr.success('Dépôt supprimé.'); this.charger(); },
      error: () => this.toastr.error('Échec de la suppression.')
    });
  }
}
