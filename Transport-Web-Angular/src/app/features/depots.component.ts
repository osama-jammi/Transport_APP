import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { DepotService } from '../services/depot.service';
import { Depot } from '../core/models';
import { SortState } from '../shared/sort.pipe';
import { matchesSearch } from '../shared/column-filter';
import * as L from 'leaflet';

@Component({
  selector: 'app-depots',
  template: `
    <div class="toolbar">
      <span class="badge badge-blue"><i class="fa-solid fa-warehouse"></i> Dépôts (locaux de départ)</span>
      <div class="search"><i class="fa-solid fa-magnifying-glass"></i>
        <input [(ngModel)]="q" (ngModelChange)="page=1" placeholder="Rechercher un dépôt…"></div>
      <button class="btn btn-primary right" (click)="ouvrir()"><i class="fa-solid fa-plus"></i> Nouveau dépôt</button>
    </div>

    <div class="card"><div class="card-body" style="padding:0">
      <div *ngIf="loading" class="spinner"></div>
      <div *ngIf="!loading && depotsFiltres().length===0" class="empty"><i class="fa-solid fa-warehouse"></i> Aucun dépôt</div>
      <div class="table-wrap" *ngIf="!loading && depotsFiltres().length">
        <table>
          <thead><tr>
            <th appSortable="id" [(state)]="sortState">ID</th>
            <th appSortable="nom" [(state)]="sortState">Nom</th>
            <th appSortable="latitude" [(state)]="sortState">Latitude</th>
            <th appSortable="longitude" [(state)]="sortState">Longitude</th>
            <th appSortable="rayon" [(state)]="sortState">Rayon (m)</th>
            <th></th></tr></thead>
          <tbody>
            <tr *ngFor="let d of depotsFiltres() | sortBy:sortState | paginate:page:pageSize">
              <td><code>{{ d.id }}</code></td>
              <td><strong>{{ d.nom || '—' }}</strong></td>
              <td>{{ d.latitude ?? '—' }}</td>
              <td>{{ d.longitude ?? '—' }}</td>
              <td>{{ d.rayon ?? '—' }}</td>
              <td class="flex">
                <button class="btn btn-outline btn-sm" (click)="ouvrir(d)"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-danger btn-sm" (click)="supprimer(d)"><i class="fa-solid fa-trash"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <app-paginator [total]="depotsFiltres().length" [page]="page" [pageSize]="pageSize"
                     (pageChange)="page = $event" (pageSizeChange)="pageSize = $event; page = 1"></app-paginator>
    </div></div>

    <div class="modal-backdrop" *ngIf="modal" (click)="fermer($event)">
      <div class="modal" style="max-width:720px" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>{{ editId ? 'Modifier' : 'Nouveau' }} dépôt</h3>
          <button class="x" (click)="fermerModal()">&times;</button></div>
        <div class="m-body">
          <div class="form-grid">
            <div class="field"><label>Nom du dépôt *</label><input [(ngModel)]="form.nom" placeholder="Ex : Dépôt central"></div>
            <div class="field"><label>Rayon (m)</label><input type="number" [(ngModel)]="form.rayon" placeholder="100"></div>
            <div class="field"><label>Latitude</label>
              <input type="number" step="any" [(ngModel)]="form.latitude" (change)="appliquerCoords()" placeholder="33.5731"></div>
            <div class="field"><label>Longitude</label>
              <input type="number" step="any" [(ngModel)]="form.longitude" (change)="appliquerCoords()" placeholder="-7.5898"></div>
          </div>
          <p class="muted" style="font-size:12px;margin:6px 0">Cliquez sur la carte pour placer le dépôt, ou saisissez la latitude/longitude exacte.</p>
          <div id="depot-map" style="height:300px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb"></div>
          <div class="muted" style="font-size:12px;margin-top:6px" *ngIf="form.latitude != null">
            Position : {{ form.latitude | number:'1.5-5' }}, {{ form.longitude | number:'1.5-5' }}
          </div>
        </div>
        <div class="m-foot">
          <button class="btn btn-outline" (click)="fermerModal()">Annuler</button>
          <button class="btn btn-primary" (click)="enregistrer()" [disabled]="saving">
            <i class="fa-solid fa-floppy-disk"></i> Enregistrer</button>
        </div>
      </div>
    </div>
  `
})
export class DepotsComponent implements OnInit {
  depots: Depot[] = [];
  loading = true; saving = false; modal = false;
  editId: number | null = null;
  form: Depot = {};
  q = ''; page = 1; pageSize = 10;
  sortState: SortState = { key: '', dir: 'asc' };
  private map?: L.Map;
  private marker?: L.Marker;

  constructor(private svc: DepotService, private toastr: ToastrService) {}

  ngOnInit(): void { this.charger(); }

  /** Dépôts filtrés par la recherche (nom). */
  depotsFiltres(): Depot[] {
    return this.depots.filter(d => matchesSearch(d, this.q));
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
    if (this.form.latitude != null) this.marker = L.marker(start).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => {
      this.form.latitude = +e.latlng.lat.toFixed(6);
      this.form.longitude = +e.latlng.lng.toFixed(6);
      if (this.marker) this.marker.setLatLng(e.latlng); else this.marker = L.marker(e.latlng).addTo(map);
    });
    setTimeout(() => map.invalidateSize(), 60);
  }
  private detruireMap(): void { if (this.map) { this.map.remove(); this.map = undefined; this.marker = undefined; } }

  /** Saisie manuelle des coordonnées → place/centre le marqueur sur la carte. */
  appliquerCoords(): void {
    if (this.form.latitude == null || this.form.longitude == null || !this.map) return;
    const pos: L.LatLngTuple = [this.form.latitude, this.form.longitude];
    if (this.marker) this.marker.setLatLng(pos); else this.marker = L.marker(pos).addTo(this.map);
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
