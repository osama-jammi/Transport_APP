import { Component, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { VoyageService } from '../services/voyage.service';
import { ChauffeurService } from '../services/chauffeur.service';
import { ChantierService } from '../services/chantier.service';
import { CamionService } from '../services/camion.service';
import { ArticleService } from '../services/article.service';
import { VoyageConteneurService } from '../services/voyage-conteneur.service';
import { Voyage, Camion, Chantier, GapArticle, VoyageConteneur } from '../core/models';

interface BarItem { label: string; value: number; color: string; }

@Component({
  selector: 'app-dashboard',
  template: `
    <div class="command-center">
      <div class="header">
        <h1><i class="fa-solid fa-satellite-dish pulse-icon"></i> Centre de Contrôle Logistique</h1>
        <p class="subtitle">Supervision en temps réel du transport et de la flotte</p>
      </div>

      <!-- Stat tiles -->
      <div class="kpi-grid">
        <div class="glass-card kpi">
          <div class="ic-glow blue"><i class="fa-solid fa-truck-fast"></i></div>
          <div class="kpi-data"><div class="val">{{ nbVoyages }}</div><div class="lbl">Total Voyages</div></div>
        </div>
        <div class="glass-card kpi">
          <div class="ic-glow purple"><i class="fa-solid fa-route"></i></div>
          <div class="kpi-data"><div class="val">{{ nbLivraisons }}</div><div class="lbl">Livraisons</div></div>
        </div>
        <div class="glass-card kpi">
          <div class="ic-glow green"><i class="fa-solid fa-id-card"></i></div>
          <div class="kpi-data"><div class="val">{{ nbChauffeurs }}</div><div class="lbl">Chauffeurs Connectés</div></div>
        </div>
        <div class="glass-card kpi">
          <div class="ic-glow orange"><i class="fa-solid fa-truck"></i></div>
          <div class="kpi-data"><div class="val">{{ nbCamionsOccupes }}/{{ camions.length }}</div><div class="lbl">Camions en Mission</div></div>
        </div>
        <div class="glass-card kpi">
          <div class="ic-glow cyan"><i class="fa-solid fa-boxes-stacked"></i></div>
          <div class="kpi-data"><div class="val">{{ articles.length }}</div><div class="lbl">Total Articles</div></div>
        </div>
        <div class="glass-card kpi">
          <div class="ic-glow pink"><i class="fa-solid fa-helmet-safety"></i></div>
          <div class="kpi-data"><div class="val">{{ chantiers.length }}</div><div class="lbl">Chantiers Actifs</div></div>
        </div>
      </div>

      <!-- Charts -->
      <div class="chart-grid">
        
        <!-- Donut parc camions -->
        <div class="glass-card chart-card">
          <h3><i class="fa-solid fa-truck-fast"></i> État de la Flotte</h3>
          <div class="donut-wrap">
            <div [style.background]="donutBg()" class="donut-ring">
              <div class="donut-inner">
                <div class="donut-val">{{ camions.length }}</div>
                <div class="donut-lbl">Total</div>
              </div>
            </div>
            <div class="donut-legend">
              <div class="lg"><span class="dot dot-libre"></span>Disponibles <strong>{{ nbCamionsLibres }}</strong></div>
              <div class="lg"><span class="dot dot-occupe"></span>En Mission <strong>{{ nbCamionsOccupes }}</strong></div>
              <div class="fleet-extra"><i class="fa-solid fa-id-badge"></i> {{ nbCamionsAffectes }} camions avec chauffeur</div>
            </div>
          </div>
        </div>

        <!-- Chauffeurs Actifs (Nouveau) -->
        <div class="glass-card chart-card">
          <h3><i class="fa-solid fa-user-astronaut"></i> Top Chauffeurs (Voyages)</h3>
          <div *ngFor="let b of chauffeurBars" class="modern-bar-row">
            <span class="bar-label" [title]="b.label">{{ short(b.label) }}</span>
            <div class="bar-track-glass">
              <div class="bar-fill-glow" [style.width.%]="pct(b.value, maxChauffeur)" [style.background]="b.color"></div>
            </div>
            <span class="bar-val glow-text">{{ b.value }}</span>
          </div>
          <div *ngIf="!chauffeurBars.length" class="empty"><i class="fa-solid fa-user-xmark"></i> Pas de données</div>
        </div>

        <!-- Voyages par chantier -->
        <div class="glass-card chart-card">
          <h3><i class="fa-solid fa-clipboard-check"></i> Livraisons / Chantier</h3>
          <div *ngFor="let b of voyageBars" class="modern-bar-row">
            <span class="bar-label" [title]="b.label">{{ short(b.label) }}</span>
            <div class="bar-track-glass">
              <div class="bar-fill-glow" [style.width.%]="pct(b.value, maxVoyage)" [style.background]="b.color"></div>
            </div>
            <span class="bar-val glow-text">{{ b.value }}</span>
          </div>
          <div *ngIf="!voyageBars.length" class="empty"><i class="fa-solid fa-chart-simple"></i> Pas de données</div>
        </div>

        <!-- Articles par origine -->
        <div class="glass-card chart-card">
          <h3><i class="fa-solid fa-tag"></i> Articles / Origine</h3>
          <div *ngFor="let b of origineBars" class="modern-bar-row">
            <span class="bar-label">{{ b.label }}</span>
            <div class="bar-track-glass">
              <div class="bar-fill-glow" [style.width.%]="pct(b.value, maxOrigine)" [style.background]="b.color"></div>
            </div>
            <span class="bar-val glow-text">{{ b.value }}</span>
          </div>
          <div *ngIf="!origineBars.length" class="empty"><i class="fa-solid fa-chart-simple"></i> Pas de données</div>
        </div>

      </div>

      <!-- Tableau voyages -->
      <div class="glass-card table-card">
        <div class="card-head">
          <h2><i class="fa-solid fa-satellite"></i> Dernières Opérations</h2>
          <a class="btn-glow" routerLink="/voyages">Voir le Détail</a>
        </div>
        <div class="card-body">
          <div *ngIf="loading" class="radar-spinner"></div>
          <div *ngIf="!loading && voyages.length===0" class="empty">
            <i class="fa-solid fa-map"></i> Aucune opération détectée
          </div>
          <div class="modern-table-wrap" *ngIf="!loading && voyages.length">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Chantier</th>
                  <th>Chauffeur</th>
                  <th>Articles</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let v of voyages.slice(0, 10)">
                  <td><code class="neon-text">#{{ v.id }}</code></td>
                  <td><strong>{{ v.client || '—' }}</strong></td>
                  <td>{{ v.chauffeur || '—' }}</td>
                  <td><span class="badge-glass">{{ v.nbArticles ?? 0 }}</span></td>
                  <td><span class="status-indicator" [ngClass]="v.statut | statutBadge">{{ v.statut }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: radial-gradient(circle at 50% 0%, #f8fafc 0%, #e2e8f0 100%);
      color: #334155;
      font-family: 'Inter', 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      box-sizing: border-box;
    }

    .command-center {
      max-width: 1400px;
      margin: 0 auto;
    }

    .header {
      margin-bottom: 30px;
      animation: fadeInDown 0.6s ease-out;
    }

    .header h1 {
      margin: 0;
      font-size: 2.2rem;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .subtitle {
      color: #64748b;
      margin-top: 5px;
      font-size: 1.1rem;
    }

    .pulse-icon {
      color: #0284c7;
      animation: pulseGlow 2s infinite;
    }

    /* Glassmorphism Cards (Light Mode) */
    .glass-card {
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 1);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .glass-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .kpi {
      display: flex;
      align-items: center;
      padding: 20px;
      gap: 20px;
      animation: fadeInUp 0.5s ease-out backwards;
    }
    
    .kpi:nth-child(1) { animation-delay: 0.1s; }
    .kpi:nth-child(2) { animation-delay: 0.2s; }
    .kpi:nth-child(3) { animation-delay: 0.3s; }
    .kpi:nth-child(4) { animation-delay: 0.4s; }
    .kpi:nth-child(5) { animation-delay: 0.5s; }
    .kpi:nth-child(6) { animation-delay: 0.6s; }

    .ic-glow {
      width: 50px;
      height: 50px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      font-size: 1.5rem;
      background: #ffffff;
      box-shadow: 0 4px 10px rgba(0,0,0,0.05);
    }

    .blue { color: #0284c7; }
    .purple { color: #9333ea; }
    .green { color: #16a34a; }
    .orange { color: #ea580c; }
    .cyan { color: #0891b2; }
    .pink { color: #db2777; }

    .kpi-data .val {
      font-size: 1.8rem;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.1;
    }

    .kpi-data .lbl {
      color: #64748b;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 5px;
      font-weight: 600;
    }

    /* Charts Grid */
    .chart-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .chart-card {
      padding: 25px;
      display: flex;
      flex-direction: column;
      animation: fadeInUp 0.6s ease-out backwards;
    }
    
    .chart-card:nth-child(1) { animation-delay: 0.2s; }
    .chart-card:nth-child(2) { animation-delay: 0.3s; }
    .chart-card:nth-child(3) { animation-delay: 0.4s; }
    .chart-card:nth-child(4) { animation-delay: 0.5s; }

    .chart-card h3 {
      margin: 0 0 20px 0;
      color: #0f172a;
      font-size: 1.1rem;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .chart-card h3 i {
      color: #64748b;
    }

    /* Donut Chart */
    .donut-wrap {
      display: flex;
      align-items: center;
      gap: 30px;
      flex-grow: 1;
    }

    .donut-ring {
      width: 130px;
      height: 130px;
      border-radius: 50%;
      flex: none;
      position: relative;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }

    .donut-inner {
      position: absolute;
      inset: 15px;
      background: #ffffff;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 2px 5px rgba(0,0,0,0.05);
    }

    .donut-val { font-size: 24px; font-weight: 800; color: #0f172a; }
    .donut-lbl { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; }

    .donut-legend {
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex-grow: 1;
    }

    .lg {
      display: flex;
      align-items: center;
      font-size: 0.9rem;
      color: #334155;
      font-weight: 500;
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 10px;
    }
    
    .dot-libre { background: #3b82f6; }
    .dot-occupe { background: #e2e8f0; border: 1px solid #cbd5e1; }
    
    .fleet-extra {
      margin-top: 10px;
      font-size: 0.8rem;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 6px;
      background: #f8fafc;
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid #f1f5f9;
      font-weight: 500;
    }

    /* Modern Bar Rows */
    .modern-bar-row {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
      gap: 15px;
    }

    .bar-label {
      width: 90px;
      font-size: 0.85rem;
      color: #475569;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 500;
    }

    .bar-track-glass {
      flex-grow: 1;
      height: 8px;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 10px;
      overflow: hidden;
      box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
    }

    .bar-fill-glow {
      height: 100%;
      border-radius: 10px;
      transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .bar-val {
      width: 30px;
      text-align: right;
      font-weight: 700;
      font-size: 0.9rem;
      color: #0f172a;
    }

    /* Table Card */
    .table-card {
      padding: 25px;
      animation: fadeInUp 0.8s ease-out backwards;
      margin-bottom: 30px;
    }

    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .card-head h2 {
      margin: 0;
      color: #0f172a;
      font-size: 1.3rem;
    }

    .btn-glow {
      background: #f1f5f9;
      color: #0284c7;
      border: 1px solid #e2e8f0;
      padding: 8px 16px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 600;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .btn-glow:hover {
      background: #e0f2fe;
      border-color: #bae6fd;
    }

    .modern-table-wrap table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0 8px;
    }

    .modern-table-wrap th {
      text-align: left;
      padding: 10px 15px;
      color: #64748b;
      font-weight: 600;
      font-size: 0.85rem;
      text-transform: uppercase;
      border-bottom: 2px solid #f1f5f9;
    }

    .modern-table-wrap td {
      padding: 15px;
      background: #ffffff;
      color: #334155;
      font-weight: 500;
    }

    .modern-table-wrap tr td:first-child { border-top-left-radius: 8px; border-bottom-left-radius: 8px; border-left: 1px solid #f1f5f9; }
    .modern-table-wrap tr td:last-child { border-top-right-radius: 8px; border-bottom-right-radius: 8px; border-right: 1px solid #f1f5f9; }
    .modern-table-wrap tr td { border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; }

    .modern-table-wrap tr:hover td {
      background: #f8fafc;
    }

    .neon-text {
      color: #0284c7;
      font-weight: 700;
    }

    .badge-glass {
      background: #f1f5f9;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 700;
      color: #475569;
    }

    .status-indicator {
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .status-indicator.bg-green { background: #dcfce7; color: #16a34a; }
    .status-indicator.bg-blue { background: #e0f2fe; color: #0284c7; }
    .status-indicator.bg-orange { background: #ffedd5; color: #ea580c; }
    .status-indicator.bg-gray { background: #f1f5f9; color: #64748b; }

    .empty {
      padding: 30px;
      text-align: center;
      color: #94a3b8;
      font-style: italic;
    }

    /* Animations */
    @keyframes pulseGlow {
      0% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.1); opacity: 0.8; }
      100% { transform: scale(1); opacity: 1; }
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .radar-spinner {
      width: 40px;
      height: 40px;
      margin: 30px auto;
      border: 3px solid #e0f2fe;
      border-radius: 50%;
      border-top-color: #0284c7;
      animation: spin 1s ease-in-out infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class DashboardComponent implements OnInit {
  voyages: Voyage[] = [];
  articles: GapArticle[] = [];
  camions: Camion[] = [];
  chantiers: Chantier[] = [];
  nbVoyages = 0; nbLivraisons = 0; nbChauffeurs = 0;
  nbCamionsLibres = 0; nbCamionsOccupes = 0; nbCamionsAffectes = 0;
  loading = true;

  voyageBars: BarItem[] = []; maxVoyage = 1;
  origineBars: BarItem[] = []; maxOrigine = 1;
  chauffeurBars: BarItem[] = []; maxChauffeur = 1;

  constructor(
    private voyageSvc: VoyageService,
    private chauffeurSvc: ChauffeurService,
    private chantierSvc: ChantierService,
    private camionSvc: CamionService,
    private articleSvc: ArticleService,
    private conteneurSvc: VoyageConteneurService
  ) {}

  ngOnInit(): void {
    forkJoin({
      voyages:    this.voyageSvc.getFromGap().pipe(catchError(() => of([] as Voyage[]))),
      conteneurs: this.conteneurSvc.getAll().pipe(catchError(() => of([] as VoyageConteneur[]))),
      chauffeurs: this.chauffeurSvc.getFromGap().pipe(catchError(() => of([] as any[]))),
      chantiers:  this.chantierSvc.getFromGap().pipe(catchError(() => of([] as Chantier[]))),
      camions:    this.camionSvc.getAll().pipe(catchError(() => of([] as Camion[]))),
      articles:   this.articleSvc.getFromGap().pipe(catchError(() => of([] as GapArticle[])))
    }).subscribe(({ voyages, conteneurs, chauffeurs, chantiers, camions, articles }) => {
      this.voyages = voyages;
      this.camions = camions;
      this.chantiers = chantiers;
      this.articles = articles;
      this.nbVoyages = conteneurs.length;
      this.nbLivraisons = voyages.length;
      
      this.nbChauffeurs = chauffeurs.filter((c: any) => !!c.derniereConnexion).length;
      this.nbCamionsLibres = camions.filter(c => c.etat === 'LIBRE').length;
      this.nbCamionsOccupes = camions.filter(c => c.etat === 'OCCUPE').length;
      this.nbCamionsAffectes = camions.filter(c => !!c.chauffeurId).length;
      
      this.buildCharts();
      this.loading = false;
    });
  }

  buildCharts(): void {
    const vmap = new Map<string, number>();
    this.voyages.forEach(v => {
      const k = v.client || 'Inconnu';
      vmap.set(k, (vmap.get(k) || 0) + 1);
    });
    this.voyageBars = [...vmap.entries()]
      .map(([label, value]) => ({ label, value, color: '#3b82f6' }))
      .sort((a, b) => b.value - a.value).slice(0, 5);
    this.maxVoyage = Math.max(1, ...this.voyageBars.map(b => b.value));

    const omap = new Map<string, number>();
    this.articles.forEach(a => {
      const k = (a.origineArticle && a.origineArticle.trim()) ? a.origineArticle : 'Non défini';
      omap.set(k, (omap.get(k) || 0) + 1);
    });
    const palette = ['#1e3a8a', '#1e40af', '#2563eb', '#3b82f6', '#93c5fd'];
    this.origineBars = [...omap.entries()]
      .map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }))
      .sort((a, b) => b.value - a.value).slice(0, 5);
    this.maxOrigine = Math.max(1, ...this.origineBars.map(b => b.value));

    const chaufMap = new Map<string, number>();
    this.voyages.forEach(v => {
      if (v.chauffeur) {
        chaufMap.set(v.chauffeur, (chaufMap.get(v.chauffeur) || 0) + 1);
      }
    });
    this.chauffeurBars = [...chaufMap.entries()]
      .map(([label, value]) => ({ label, value, color: '#6366f1' }))
      .sort((a, b) => b.value - a.value).slice(0, 5);
    this.maxChauffeur = Math.max(1, ...this.chauffeurBars.map(b => b.value));
  }

  donutBg(): string {
    const total = this.camions.length || 1;
    const libre = (this.nbCamionsLibres / total) * 360;
    return `conic-gradient(#3b82f6 0deg ${libre}deg, #e2e8f0 ${libre}deg 360deg)`;
  }

  pct(v: number, max: number): number { return Math.round((v / (max || 1)) * 100); }
  short(s: string): string { return s.length > 12 ? s.slice(0, 11) + '…' : s; }
}
