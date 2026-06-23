import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { GpsService } from '../services/gps.service';
import { ChauffeurService } from '../services/chauffeur.service';
import { TrajetChauffeur, GapChauffeur } from '../core/models';

/** Palette de couleurs distinctes — une par chauffeur. */
const COULEURS = [
  '#17A2B8', '#2563eb', '#21BA45', '#dc2626', '#7c3aed', '#E8910C',
  '#0891b2', '#db2777', '#65a30d', '#9333ea', '#0d9488', '#b45309'
];

@Component({
  selector: 'app-suivi-trajets',
  template: `
    <div class="toolbar">
      <div class="filters">
        <button *ngFor="let p of presets" class="chip-toggle" [class.active]="periode===p.key"
                (click)="choisirPreset(p.key)">{{ p.label }}</button>
      </div>
      <div class="filters" style="margin-left:auto">
        <label class="muted" style="font-size:12px">Du
          <input type="date" [(ngModel)]="debut" (change)="periode='custom'; charger()"></label>
        <label class="muted" style="font-size:12px">au
          <input type="date" [(ngModel)]="fin" (change)="periode='custom'; charger()"></label>
        <select [(ngModel)]="chauffeurId" (change)="charger()" class="btn btn-outline">
          <option [ngValue]="undefined">Tous les chauffeurs</option>
          <option *ngFor="let c of chauffeurs" [ngValue]="c.id">{{ c.prenom }} {{ c.nom }}</option>
        </select>
        <button class="btn btn-outline" (click)="charger()"><i class="fa-solid fa-rotate"></i></button>
      </div>
    </div>

    <div class="card"><div class="card-body">
      <div *ngIf="loading" class="spinner" style="margin:8px auto"></div>
      <div class="map-legend" *ngIf="!loading">
        <span *ngIf="trajets.length===0" class="muted">Aucun trajet sur cette période.</span>
        <span *ngFor="let t of trajets; let i = index" class="leg" [class.active]="selectedIdx===i"
              (click)="selectionner(i)" title="Afficher seulement ce chauffeur">
          <i class="dot" [style.background]="couleur(i)"></i>
          {{ t.chauffeur || 'Non affecté' }} <span class="muted">({{ t.nbPoints }} pts)</span>
        </span>
        <span *ngIf="selectedIdx!==null" class="leg" (click)="selectionner(selectedIdx)"
              style="color:var(--primary);font-weight:700">✕ Tout afficher</span>
      </div>
      <div id="suivi-map" class="map"></div>
    </div></div>

    <div class="card"><div class="card-head"><h2>Chauffeurs suivis ({{ trajets.length }})</h2></div>
      <div class="card-body" style="padding:0">
        <div *ngIf="trajets.length===0 && !loading" class="empty">
          <i class="fa-solid fa-route"></i> Aucun trajet</div>
        <div class="table-wrap" *ngIf="trajets.length">
          <table>
            <thead><tr><th></th><th>Chauffeur</th><th>Points</th><th>Début</th><th>Fin</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let t of trajets; let i = index" class="row-link" [class.row-active]="selectedIdx===i"
                  (click)="selectionner(i)" title="Afficher seulement ce chauffeur sur la carte">
                <td><i class="dot" [style.background]="couleur(i)"
                       style="display:inline-block;width:12px;height:12px;border-radius:50%"></i></td>
                <td><strong>{{ t.chauffeur || 'Non affecté' }}</strong></td>
                <td>{{ t.nbPoints }}</td>
                <td>{{ debutDe(t) | date:'dd/MM HH:mm' }}</td>
                <td>{{ finDe(t) | date:'dd/MM HH:mm' }}</td>
                <td (click)="$event.stopPropagation()"><button class="btn btn-outline btn-sm" (click)="zoomer(i)"
                            [disabled]="t.nbPoints===0"><i class="fa-solid fa-magnifying-glass-location"></i></button></td>
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
    .map-legend .leg { cursor:pointer; padding:2px 6px; border-radius:6px; }
    .map-legend .leg.active { background:var(--primary-light); font-weight:700; color:var(--text); }
    .filters label input[type="date"] { margin-left:4px; }
    /* Carte plein écran */
    #suivi-map { height: calc(100dvh - 250px); min-height: 480px; }
    tbody tr.row-active { background:var(--primary-light) !important; }
  `]
})
export class SuiviTrajetsComponent implements AfterViewInit, OnDestroy {
  presets = [
    { key: 'jour',  label: "Aujourd'hui" },
    { key: 'hier',  label: 'Hier' },
    { key: '7j',    label: '7 jours' },
    { key: '30j',   label: '30 jours' }
  ];
  periode = 'jour';
  debut = '';
  fin = '';
  chauffeurId?: number;
  chauffeurs: GapChauffeur[] = [];
  trajets: TrajetChauffeur[] = [];
  loading = false;
  /** Index du chauffeur sélectionné (clic) : seul son trajet est affiché ; null = tous. */
  selectedIdx: number | null = null;

  private map!: L.Map;
  private layer?: L.LayerGroup;
  private bounds: L.LatLngBounds[] = [];

  constructor(private svc: GpsService, private chauffeurSvc: ChauffeurService) {}

  ngAfterViewInit(): void {
    this.map = L.map('suivi-map').setView([36.7372, 3.0865], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap'
    }).addTo(this.map);
    this.chauffeurSvc.getFromGap().pipe(catchError(() => of([] as GapChauffeur[])))
      .subscribe(d => this.chauffeurs = d);
    this.choisirPreset('jour');
  }

  couleur(i: number): string { return COULEURS[i % COULEURS.length]; }

  /** Calcule debut/fin (ISO date) à partir du preset choisi. */
  choisirPreset(key: string): void {
    this.periode = key;
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    if (key === 'jour') { this.debut = iso(today); this.fin = iso(today); }
    else if (key === 'hier') { const y = new Date(today); y.setDate(y.getDate() - 1); this.debut = iso(y); this.fin = iso(y); }
    else if (key === '7j') { const d = new Date(today); d.setDate(d.getDate() - 6); this.debut = iso(d); this.fin = iso(today); }
    else if (key === '30j') { const d = new Date(today); d.setDate(d.getDate() - 29); this.debut = iso(d); this.fin = iso(today); }
    this.charger();
  }

  charger(): void {
    this.loading = true;
    this.selectedIdx = null;   // évite un index périmé après rechargement
    this.svc.trajetsParChauffeur(this.debut || undefined, this.fin || undefined, this.chauffeurId)
      .pipe(catchError(() => of([] as TrajetChauffeur[])))
      .subscribe(d => { this.trajets = d; this.loading = false; setTimeout(() => this.dessiner(), 80); });
  }

  private dessiner(): void {
    if (!this.map) return;
    this.layer?.remove();
    this.layer = L.layerGroup().addTo(this.map);
    this.bounds = [];
    const tous: L.LatLngExpression[] = [];

    this.trajets.forEach((t, i) => {
      const pts = (t.points || [])
        .filter(p => p.latitude != null && p.longitude != null)
        .map(p => [p.latitude as number, p.longitude as number] as L.LatLngTuple);
      if (pts.length === 0) { this.bounds.push(L.latLngBounds([])); return; }
      this.bounds.push(L.latLngBounds(pts));
      // Si un chauffeur est sélectionné, on n'affiche que son trajet.
      if (this.selectedIdx !== null && this.selectedIdx !== i) return;
      const col = this.couleur(i);
      L.polyline(pts, { color: col, weight: 4, opacity: 0.85 }).addTo(this.layer!);
      const dot = (fill: string) => L.divIcon({ className: '',
        html: `<div style="width:13px;height:13px;border-radius:50%;background:${fill};border:2px solid #fff;box-shadow:0 0 0 1px ${col}"></div>`,
        iconSize: [13, 13], iconAnchor: [7, 7] });
      L.marker(pts[0], { icon: dot('#16a34a') }).addTo(this.layer!).bindPopup(`${t.chauffeur || 'Non affecté'} — départ`);
      L.marker(pts[pts.length - 1], { icon: dot(col) }).addTo(this.layer!).bindPopup(`${t.chauffeur || 'Non affecté'} — dernière position`);
      pts.forEach(p => tous.push(p));
    });

    if (tous.length) this.map.fitBounds(L.latLngBounds(tous).pad(0.2));
    setTimeout(() => this.map.invalidateSize(), 50);
  }

  zoomer(i: number): void {
    const b = this.bounds[i];
    if (b && b.isValid()) this.map.fitBounds(b.pad(0.25));
  }

  /** Clic sur un chauffeur : n'affiche que son trajet sur la carte (re-clic = tous). */
  selectionner(i: number): void {
    this.selectedIdx = this.selectedIdx === i ? null : i;
    this.dessiner();
  }

  debutDe(t: TrajetChauffeur): string | undefined { return t.points?.[0]?.horodatage; }
  finDe(t: TrajetChauffeur): string | undefined { return t.points?.[t.points.length - 1]?.horodatage; }

  ngOnDestroy(): void { this.map?.remove(); }
}
