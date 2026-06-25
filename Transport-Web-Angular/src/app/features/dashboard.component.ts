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
    <!-- Stat tiles -->
    <div class="stats">
      <div class="stat">
        <div class="ic blue"><i class="fa-solid fa-truck-fast"></i></div>
        <div><div class="val">{{ nbVoyages }}</div><div class="lbl">Voyages</div></div>
      </div>
      <div class="stat">
        <div class="ic blue"><i class="fa-solid fa-route"></i></div>
        <div><div class="val">{{ nbLivraisons }}</div><div class="lbl">Livraisons (GAP)</div></div>
      </div>
      <div class="stat">
        <div class="ic green"><i class="fa-solid fa-id-card"></i></div>
        <div><div class="val">{{ nbChauffeurs }}</div><div class="lbl">Chauffeurs connectés</div></div>
      </div>
      <div class="stat">
        <div class="ic orange"><i class="fa-solid fa-truck"></i></div>
        <div><div class="val">{{ nbCamionsOccupes }}/{{ camions.length }}</div><div class="lbl">Camions occupés</div></div>
      </div>
      <div class="stat">
        <div class="ic cyan"><i class="fa-solid fa-boxes-stacked"></i></div>
        <div><div class="val">{{ articles.length }}</div><div class="lbl">Articles (GAP)</div></div>
      </div>
      <div class="stat">
        <div class="ic blue"><i class="fa-solid fa-helmet-safety"></i></div>
        <div><div class="val">{{ chantiers.length }}</div><div class="lbl">Chantiers</div></div>
      </div>
    </div>

    <!-- Charts -->
    <div class="chart-grid">
      <!-- Donut parc camions -->
      <div class="chart-card">
        <h3><i class="fa-solid fa-truck-fast"></i> Parc camions</h3>
        <div class="donut-wrap">
          <div [style.background]="donutBg()" style="width:140px;height:140px;border-radius:50%;flex:none"
               class="donut">
            <div style="position:absolute;inset:28px;background:#fff;border-radius:50%;
                        display:grid;place-items:center;text-align:center">
              <div>
                <div style="font-size:22px;font-weight:800">{{ camions.length }}</div>
                <div style="font-size:11px;color:#9FB3B7">camions</div>
              </div>
            </div>
          </div>
          <div class="donut-legend">
            <div class="lg"><span class="dot" style="background:#21BA45"></span>
              Libres <strong style="margin-left:auto">{{ nbCamionsLibres }}</strong></div>
            <div class="lg"><span class="dot" style="background:#E8910C"></span>
              Occupés <strong style="margin-left:auto">{{ nbCamionsOccupes }}</strong></div>
            <div class="lg"><span class="dot" style="background:#17A2B8"></span>
              Avec chauffeur <strong style="margin-left:auto">{{ nbCamionsAffectes }}</strong></div>
          </div>
        </div>
      </div>

      <!-- Voyages par chantier -->
      <div class="chart-card">
        <h3><i class="fa-solid fa-clipboard-check"></i> Livraisons par chantier</h3>
        <div *ngFor="let b of voyageBars" class="bar-row">
          <span class="bar-label" [title]="b.label">{{ short(b.label) }}</span>
          <span class="bar-track"><span class="bar-fill"
            [style.width.%]="pct(b.value, maxVoyage)" [style.background]="b.color"></span></span>
          <span class="bar-val">{{ b.value }}</span>
        </div>
        <div *ngIf="!voyageBars.length" class="empty" style="padding:20px"><i class="fa-solid fa-chart-simple"></i> Pas de données</div>
      </div>

      <!-- Articles par origine -->
      <div class="chart-card">
        <h3><i class="fa-solid fa-tag"></i> Articles par origine</h3>
        <div *ngFor="let b of origineBars" class="bar-row">
          <span class="bar-label">{{ b.label }}</span>
          <span class="bar-track"><span class="bar-fill"
            [style.width.%]="pct(b.value, maxOrigine)" [style.background]="b.color"></span></span>
          <span class="bar-val">{{ b.value }}</span>
        </div>
        <div *ngIf="!origineBars.length" class="empty" style="padding:20px"><i class="fa-solid fa-chart-simple"></i> Pas de données</div>
      </div>

      <!-- Articles par chantier -->
      <div class="chart-card">
        <h3><i class="fa-solid fa-helmet-safety"></i> Articles par chantier</h3>
        <div class="spark" *ngIf="chantierBars.length">
          <div class="col" *ngFor="let b of chantierBars">
            <span class="cv">{{ b.value }}</span>
            <div class="b" [style.height.%]="pct(b.value, maxChantier)"></div>
            <span class="cl" [title]="b.label">{{ short(b.label) }}</span>
          </div>
        </div>
        <div *ngIf="!chantierBars.length" class="empty" style="padding:20px"><i class="fa-solid fa-chart-column"></i> Pas de données</div>
      </div>
    </div>

    <!-- Tableau voyages -->
    <div class="card">
      <div class="card-head"><h2>Livraisons (GAP)</h2>
        <a class="btn btn-outline btn-sm" routerLink="/voyages">Tout voir</a></div>
      <div class="card-body" style="padding:0">
        <div *ngIf="loading" class="spinner"></div>
        <div *ngIf="!loading && voyages.length===0" class="empty">
          <i class="fa-solid fa-map"></i> Aucun voyage
        </div>
        <div class="table-wrap" *ngIf="!loading && voyages.length">
          <table>
            <thead><tr><th>ID</th><th>Chantier</th><th>Chauffeur</th>
              <th>Articles</th><th>Statut</th></tr></thead>
            <tbody>
              <tr *ngFor="let v of voyages.slice(0, 10)">
                <td><code>#{{ v.id }}</code></td>
                <td><strong>{{ v.client || '—' }}</strong></td>
                <td>{{ v.chauffeur || '—' }}</td>
                <td><span class="badge badge-gray">{{ v.nbArticles ?? 0 }}</span></td>
                <td><span class="badge badge-blue">{{ v.statut }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`.donut{position:relative}`]
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
  chantierBars: BarItem[] = []; maxChantier = 1;

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
      // Chauffeurs « connectés » = ceux qui se sont déjà connectés via l'app mobile
      this.nbChauffeurs = chauffeurs.filter((c: any) => !!c.derniereConnexion).length;
      this.nbCamionsLibres = camions.filter(c => c.etat === 'LIBRE').length;
      this.nbCamionsOccupes = camions.filter(c => c.etat === 'OCCUPE').length;
      this.nbCamionsAffectes = camions.filter(c => !!c.chauffeurId).length;
      this.buildCharts();
      this.loading = false;
    });
  }

  buildCharts(): void {
    // Voyages par chantier (client = désignation projet), top 6
    const vmap = new Map<string, number>();
    this.voyages.forEach(v => {
      const k = v.client || 'Inconnu';
      vmap.set(k, (vmap.get(k) || 0) + 1);
    });
    this.voyageBars = [...vmap.entries()]
      .map(([label, value]) => ({ label, value, color: '#17A2B8' }))
      .sort((a, b) => b.value - a.value).slice(0, 6);
    this.maxVoyage = Math.max(1, ...this.voyageBars.map(b => b.value));

    // Articles par origine (MARCHE / DEVIS / AVENANT / …)
    const omap = new Map<string, number>();
    this.articles.forEach(a => {
      const k = (a.origineArticle && a.origineArticle.trim()) ? a.origineArticle : 'Non défini';
      omap.set(k, (omap.get(k) || 0) + 1);
    });
    const palette = ['#17A2B8', '#00B5AD', '#0F7A8B', '#75D5CD', '#21BA45', '#E8910C'];
    this.origineBars = [...omap.entries()]
      .map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }))
      .sort((a, b) => b.value - a.value);
    this.maxOrigine = Math.max(1, ...this.origineBars.map(b => b.value));

    // Articles par chantier : projetId -> nom du chantier (depuis GAP), top 6
    const nameById = new Map<number, string>();
    this.chantiers.forEach(c => nameById.set(c.id, c.nom));
    const cmap = new Map<string, number>();
    this.articles.forEach(a => {
      const k = (a.projetId != null ? nameById.get(a.projetId) : null) || 'Inconnu';
      cmap.set(k, (cmap.get(k) || 0) + 1);
    });
    this.chantierBars = [...cmap.entries()]
      .map(([label, value]) => ({ label, value, color: '#00B5AD' }))
      .sort((a, b) => b.value - a.value).slice(0, 6);
    this.maxChantier = Math.max(1, ...this.chantierBars.map(b => b.value));
  }

  donutBg(): string {
    const total = this.camions.length || 1;
    const libre = (this.nbCamionsLibres / total) * 360;
    return `conic-gradient(#21BA45 0deg ${libre}deg, #E8910C ${libre}deg 360deg)`;
  }

  pct(v: number, max: number): number { return Math.round((v / (max || 1)) * 100); }
  short(s: string): string { return s.length > 10 ? s.slice(0, 9) + '…' : s; }
}
