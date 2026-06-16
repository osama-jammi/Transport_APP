import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import * as L from 'leaflet';
import { Subscription, interval, forkJoin, of } from 'rxjs';
import { startWith, switchMap, catchError } from 'rxjs/operators';
import { GpsService } from '../services/gps.service';
import { ChantierService } from '../services/chantier.service';
import { PositionGps, Chantier } from '../core/models';

@Component({
  selector: 'app-gps',
  template: `
    <div class="toolbar">
      <span class="badge badge-blue"><i class="fa-solid fa-satellite-dish"></i> Rafraîchissement auto · 15s</span>
      <span class="muted">
        <i class="fa-solid fa-truck" style="color:#6d4aff"></i> {{ positions.length }} camion(s) ·
        <i class="fa-solid fa-helmet-safety" style="color:#f0932b"></i> {{ chantiers.length }} chantier(s)
      </span>
      <button class="btn btn-outline right" (click)="refresh()"><i class="fa-solid fa-rotate"></i> Actualiser</button>
    </div>

    <div class="card"><div class="card-body">
      <div class="map-legend">
        <span><i class="dot" style="background:#6d4aff"></i> Chauffeur / camion (position actuelle)</span>
        <span><i class="dot" style="background:#f0932b"></i> Chantier &amp; zone</span>
      </div>
      <div id="map" class="map"></div>
    </div></div>

    <div class="card"><div class="card-head"><h2>Dernières positions des chauffeurs</h2></div>
      <div class="card-body" style="padding:0">
        <div *ngIf="positions.length===0" class="empty"><i class="fa-solid fa-map-location-dot"></i> Aucune position disponible</div>
        <div class="table-wrap" *ngIf="positions.length">
          <table>
            <thead><tr><th>Camion</th><th>Chauffeur</th><th>Latitude</th><th>Longitude</th><th>Horodatage</th></tr></thead>
            <tbody>
              <tr *ngFor="let p of positions" (click)="focus(p)" style="cursor:pointer">
                <td><strong>{{ p.immatriculation || ('#' + p.camionId) }}</strong></td>
                <td>{{ p.chauffeur || '—' }}</td>
                <td class="mono">{{ p.latitude | number:'1.5-5' }}</td>
                <td class="mono">{{ p.longitude | number:'1.5-5' }}</td>
                <td>{{ p.horodatage ? (p.horodatage | date:'dd/MM HH:mm:ss') : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .map-legend { display:flex; gap:18px; flex-wrap:wrap; margin-bottom:12px; font-size:12.5px; color:var(--text-soft); }
    .map-legend .dot { display:inline-block; width:11px; height:11px; border-radius:50%; margin-right:6px; vertical-align:middle; }
  `]
})
export class GpsComponent implements OnInit, AfterViewInit, OnDestroy {
  positions: PositionGps[] = [];
  chantiers: Chantier[] = [];
  private map!: L.Map;
  private markers: L.Marker[] = [];
  private chantierLayer?: L.LayerGroup;
  private sub?: Subscription;

  constructor(private svc: GpsService, private chantierSvc: ChantierService) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.map = L.map('map').setView([36.7372, 3.0865], 6); // Alger par défaut
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap'
    }).addTo(this.map);

    // Chantiers (projets) chargés une fois
    this.chantierSvc.getAll().pipe(catchError(() => of([] as Chantier[]))).subscribe(d => {
      this.chantiers = d; this.drawChantiers();
    });

    // Positions chauffeurs rafraîchies toutes les 15s
    this.sub = interval(15000).pipe(
      startWith(0),
      switchMap(() => this.svc.dernieresPositions().pipe(catchError(() => of([] as PositionGps[]))))
    ).subscribe(d => { this.positions = d; this.draw(); });
  }

  refresh(): void {
    forkJoin({
      pos: this.svc.dernieresPositions().pipe(catchError(() => of([] as PositionGps[]))),
      ch:  this.chantierSvc.getAll().pipe(catchError(() => of([] as Chantier[])))
    }).subscribe(({ pos, ch }) => {
      this.positions = pos; this.chantiers = ch;
      this.draw(); this.drawChantiers();
    });
  }

  private icon = L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });

  private drawChantiers(): void {
    if (!this.map) return;
    this.chantierLayer?.remove();
    this.chantierLayer = L.layerGroup().addTo(this.map);
    this.chantiers.forEach(c => {
      if (c.latitude == null || c.longitude == null) return;
      const rayon = c.rayonMetres || 100;
      L.circle([c.latitude, c.longitude], {
        radius: rayon, color: '#f0932b', fillColor: '#f0932b', fillOpacity: 0.12, weight: 2
      }).addTo(this.chantierLayer!);
      L.circleMarker([c.latitude, c.longitude], {
        radius: 7, color: '#fff', weight: 2, fillColor: '#f0932b', fillOpacity: 1
      }).bindPopup(`<b>${c.nom}</b><br>${c.ville || ''}<br>Zone : ${rayon} m`)
        .addTo(this.chantierLayer!);
    });
  }

  private draw(): void {
    if (!this.map) return;
    this.markers.forEach(m => this.map.removeLayer(m));
    this.markers = [];
    const pts: L.LatLngExpression[] = [];
    this.positions.forEach(p => {
      const m = L.marker([p.latitude, p.longitude], { icon: this.icon })
        .addTo(this.map)
        .bindPopup(`<b>${p.immatriculation || '#' + p.camionId}</b><br>${p.chauffeur || ''}`);
      this.markers.push(m);
      pts.push([p.latitude, p.longitude]);
    });
    this.chantiers.forEach(c => {
      if (c.latitude != null && c.longitude != null) pts.push([c.latitude, c.longitude]);
    });
    if (pts.length) this.map.fitBounds(L.latLngBounds(pts).pad(0.2));
  }

  focus(p: PositionGps): void {
    this.map.setView([p.latitude, p.longitude], 14);
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); this.map?.remove(); }
}
