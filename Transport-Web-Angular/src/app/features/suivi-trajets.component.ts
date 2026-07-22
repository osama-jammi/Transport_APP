import { Component, AfterViewInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
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
    <div class="premium-suivi-trajets">
      
    <div class="header">
        <h1><i class="fa-solid fa-map-location-dot"></i> Suivi des trajets</h1>
        <p class="subtitle">Suivi GPS des chauffeurs en temps réel.</p>
      </div>
      <div class="toolbar glass-panel">
      <div class="filters">
        <button *ngFor="let p of presets" class="chip-toggle" [class.active]="periode===p.key"
                (click)="choisirPreset(p.key)">{{ p.label }}</button>
      </div>
      <div class="filters" style="margin-left:auto">
        <label class="muted" style="font-size:12px">Du
          <input type="date" [(ngModel)]="debut" (change)="periode='custom'; charger()"></label>
        <label class="muted" style="font-size:12px">au
          <input type="date" [(ngModel)]="fin" (change)="periode='custom'; charger()"></label>
        <select [(ngModel)]="chauffeurId" (change)="charger()" class="p-btn p-btn-light">
          <option [ngValue]="undefined">Tous les chauffeurs</option>
          <option *ngFor="let c of chauffeurs" [ngValue]="c.id">{{ c.prenom }} {{ c.nom }}</option>
        </select>
        <button class="p-btn p-btn-light" (click)="charger()"><i class="fa-solid fa-rotate"></i></button>
      </div>
    </div>

    <div #mapCard class="glass-card map-card" [class.plein]="plein"><div class="card-body">
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
      <div class="map-holder">
        <button type="button" class="p-btn p-btn-light p-btn-sm map-fs" (click)="basculerPlein()"
                [title]="plein ? 'Quitter le plein écran (Échap)' : 'Carte en plein écran'">
          <i class="fa-solid" [ngClass]="plein ? 'fa-compress' : 'fa-expand'"></i>
          {{ plein ? 'Réduire' : 'Plein écran' }}
        </button>
        <div id="suivi-map" class="map"></div>
      </div>
    </div></div>

    <div class="glass-card m-t"><div class="card-head"><h2>Chauffeurs suivis ({{ trajets.length }})</h2></div>
      <div class="card-body" style="padding:0">
        <div *ngIf="trajets.length===0 && !loading" class="empty">
          <i class="fa-solid fa-route"></i> Aucun trajet</div>
        <div class="modern-table" *ngIf="trajets.length">
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
                <td (click)="$event.stopPropagation()"><button class="p-btn p-btn-light p-btn-sm" (click)="zoomer(i)"
                            [disabled]="t.nbPoints===0"><i class="fa-solid fa-magnifying-glass-location"></i></button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  
    `,
  styles: [`
    .premium-suivi-trajets {
      font-family: 'Inter', 'Segoe UI', Roboto, sans-serif;
      color: #334155;
      padding: 20px;
      max-width: 1500px;
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
    .toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 25px; padding: 15px 20px; }
    
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
    .p-btn-sm { padding: 5px 10px; font-size: 0.8rem; }
    .p-btn-primary { background: #0ea5e9; color: #fff; box-shadow: 0 2px 10px rgba(14,165,233,0.3); }
    .p-btn-primary:hover { background: #0284c7; box-shadow: 0 4px 15px rgba(14,165,233,0.4); }
    .p-btn-primary[disabled] { opacity: 0.5; pointer-events: none; }
    .p-btn-light { background: #f1f5f9; color: #475569; }
    .p-btn-light:hover { background: #e2e8f0; }
    .p-btn-light.active { background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; }

    .p-btn-icon { padding: 6px; border-radius: 6px; background: transparent; color: #64748b; font-size: 1rem; }
    .p-btn-icon:hover { background: #f1f5f9; color: #0f172a; }
    .p-btn-icon.danger { color: #ef4444; }
    .p-btn-icon.danger:hover { background: #fee2e2; }

    /* Tables */
    .m-t { margin-top: 25px; }
    .modern-table table { width: 100%; border-collapse: separate; border-spacing: 0; }
    .modern-table th {
      text-align: left; padding: 12px 15px; color: #64748b; font-weight: 600; font-size: 0.85rem;
      text-transform: uppercase; border-bottom: 2px solid #f1f5f9;
    }
    .modern-table td { padding: 15px; color: #334155; font-weight: 500; font-size: 0.9rem; border-bottom: 1px solid #f1f5f9; }
    .modern-table tr:hover td { background: #f8fafc; }
    .modern-table tr.row-link { cursor: pointer; }
    .modern-table tr.row-active td { background: #f0f9ff; }

    .p-badge {
      padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;
      background: #f1f5f9; color: #64748b; text-transform: uppercase; display: inline-flex; align-items: center; gap: 6px;
    }
    .p-badge.blue { background: #e0f2fe; color: #0284c7; }
    .p-badge.green { background: #dcfce7; color: #16a34a; }
    .p-badge.red { background: #fee2e2; color: #ef4444; }
    .p-badge.orange { background: #ffedd5; color: #ea580c; }
    .p-badge.light { background: #f8fafc; color: #94a3b8; border: 1px solid #e2e8f0; }

    .empty { padding: 40px; text-align: center; color: #94a3b8; font-size: 1.1rem; display:flex; flex-direction:column; align-items:center; gap: 15px; }
    .empty i { font-size: 3rem; color: #cbd5e1; }
    .muted { color: #94a3b8; }
    .mono { font-family: monospace; }
    .color-primary { color: #0ea5e9; }

    /* Modals */
    .p-modal { border: none; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.15); overflow: hidden; background: white; }
    .p-modal .m-head { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 20px; }
    .p-modal .m-head h3 { color: #0f172a; font-weight: 700; font-size: 1.2rem; margin:0; }
    .p-modal .m-body { padding: 25px; max-height: 70vh; overflow-y: auto; }
    .p-modal .m-foot { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; display: flex; justify-content: flex-end; gap: 10px; }
    
    .p-input, .filtre-input, input[type="date"], input[type="time"] {
      width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px;
      font-size: 0.95rem; color: #0f172a; transition: all 0.2s; background: #fff;
    }
    .p-input:focus, .filtre-input:focus, input[type="date"]:focus, input[type="time"]:focus { 
      outline: none; border-color: #0ea5e9; box-shadow: 0 0 0 3px #e0f2fe; 
    }
    
    .spinner-modern {
      width: 40px; height: 40px; margin: 40px auto; border: 3px solid #e0f2fe; border-radius: 50%;
      border-top-color: #0ea5e9; animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Specific to components */
    .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .detail-grid .dk { display: block; font-size: 0.85rem; color: #64748b; margin-bottom: 4px; text-transform: uppercase; font-weight: 600; }
    .detail-grid .dv { display: block; font-size: 1rem; color: #0f172a; font-weight: 500; }
    
    .ligne-section { background: #f1f5f9; padding: 12px; border-radius: 8px; margin: 10px 0; }
    
    .map-legend { display:flex; gap:18px; flex-wrap:wrap; margin-bottom:12px; font-size:12.5px; color:#64748b; }
    .map-legend .dot { display:inline-block; width:11px; height:11px; border-radius:50%; margin-right:6px; vertical-align:middle; }
    .map-legend .leg { cursor:pointer; padding:4px 8px; border-radius:6px; transition: all 0.2s; }
    .map-legend .leg:hover { background: #f1f5f9; }
    .map-legend .leg.active { background:#e0f2fe; font-weight:700; color:#0284c7; }
    
    .map-holder { position: relative; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    #suivi-map { height: calc(100dvh - 430px); min-height: 400px; }
    .map-fs { position: absolute; top: 12px; right: 12px; z-index: 1000; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
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
  /** Carte affichée en plein écran. */
  plein = false;

  private map!: L.Map;
  private layer?: L.LayerGroup;
  private bounds: L.LatLngBounds[] = [];

  @ViewChild('mapCard') mapCard!: ElementRef<HTMLElement>;

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

  /**
   * Bascule la carte en plein écran via l'API Fullscreen native (= F11) : la
   * carte passe dans le « top layer » du navigateur et recouvre TOUT, sidebar
   * comprise. Repli sur un plein écran CSS si l'API est indisponible/refusée.
   */
  basculerPlein(): void {
    const el = this.mapCard?.nativeElement as any;
    const doc = document as any;
    if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
      const demande: (() => Promise<void>) | undefined =
        el?.requestFullscreen?.bind(el) || el?.webkitRequestFullscreen?.bind(el);
      if (demande) {
        Promise.resolve(demande()).catch(() => { this.plein = true; this.resizeMap(); });
      } else {
        // Navigateur sans API plein écran : repli CSS.
        this.plein = true;
        this.resizeMap();
      }
    } else {
      const sortie: (() => Promise<void>) | undefined =
        doc.exitFullscreen?.bind(doc) || doc.webkitExitFullscreen?.bind(doc);
      if (sortie) Promise.resolve(sortie()).catch(() => {});
      this.plein = false;
      this.resizeMap();
    }
  }

  /** Synchronise l'état + redimensionne la carte quand le plein écran natif change. */
  @HostListener('document:fullscreenchange')
  @HostListener('document:webkitfullscreenchange')
  onFullscreenChange(): void {
    const doc = document as any;
    this.plein = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
    this.resizeMap();
  }

  /** Échap : quitte le repli CSS (le plein écran natif gère Échap tout seul). */
  @HostListener('document:keydown.escape')
  quitterPlein(): void {
    const doc = document as any;
    if (this.plein && !doc.fullscreenElement && !doc.webkitFullscreenElement) {
      this.plein = false;
      this.resizeMap();
    }
  }

  /** Recalcule la taille de la carte Leaflet après un changement de layout. */
  private resizeMap(): void {
    setTimeout(() => this.map?.invalidateSize(), 60);
    setTimeout(() => this.map?.invalidateSize(), 320);
  }

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
