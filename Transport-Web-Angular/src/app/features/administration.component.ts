import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { AdminService } from '../services/admin.service';
import { FeatureFlag } from '../core/models';
import { THEMES, themeActuel, appliquerTheme } from '../core/theme';

@Component({
  selector: 'app-administration',
  template: `
    <div class="premium-admin">
      <div class="header">
        <h1><i class="fa-solid fa-sliders"></i> Administration</h1>
        <p class="subtitle">Gérez les fonctionnalités et l'apparence de l'application.</p>
      </div>
      
    <div class="glass-card m-t">
      <div class="card-head"><h2><i class="fa-solid fa-sliders"></i> Fonctionnalités de l'application</h2></div>
      <div class="card-body">
        <p class="muted" style="font-size:13px;margin-top:0">
          Activez ou désactivez les fonctionnalités. La désactivation masque la fonction côté application.
        </p>
        <div *ngIf="loading" class="spinner" style="margin:18px auto"></div>
        <div *ngIf="!loading && features.length===0" class="empty">
          <i class="fa-solid fa-sliders"></i> Aucune fonctionnalité</div>
        <div class="feature-list" *ngIf="!loading && features.length">
          <div class="feature-row" *ngFor="let f of features">
            <div>
              <strong>{{ f.libelle || f.cle }}</strong>
              <div class="muted" style="font-size:11px"><code>{{ f.cle }}</code></div>
            </div>
            <label class="switch" [title]="f.actif ? 'Désactiver' : 'Activer'">
              <input type="checkbox" [checked]="f.actif" (change)="basculer(f)" [disabled]="saving">
              <span class="slider"></span>
            </label>
            <span class="badge" [ngClass]="f.actif ? 'badge-green' : 'badge-gray'">
              {{ f.actif ? 'Activé' : 'Désactivé' }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="glass-card m-t" style="margin-top:18px">
      <div class="card-head"><h2><i class="fa-solid fa-palette"></i> Apparence — couleur de l'interface</h2></div>
      <div class="card-body">
        <p class="muted" style="font-size:13px;margin-top:0">
          Choisissez la couleur principale de l'application (appliquée immédiatement, mémorisée sur ce poste).</p>
        <div class="theme-choices">
          <button *ngFor="let t of themes" class="theme-choice" [class.active]="t.cle===themeChoisi"
                  (click)="choisirTheme(t.cle)">
            <span class="theme-dot" [style.background]="t.apercu"></span>
            <span>{{ t.nom }}</span>
            <i *ngIf="t.cle===themeChoisi" class="fa-solid fa-check"></i>
          </button>
        </div>
      </div>
    </div>
    </div>
  `,
  styles: [`
    .premium-admin { font-family: 'Inter', sans-serif; color: #334155; padding: 20px; max-width: 1200px; margin: 0 auto; }
    .header { margin-bottom: 25px; }
    .header h1 { margin: 0; font-size: 2rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 12px; }
    .header h1 i { color: #0ea5e9; }
    .subtitle { color: #64748b; margin-top: 4px; font-size: 1.05rem; }

    .glass-card {
      background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border: 1px solid #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
      padding: 25px; margin-bottom: 20px; transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .card-head h2 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 15px 0; display:flex; align-items:center; gap:8px; }
    .card-head h2 i { color: #0ea5e9; }
    
    .feature-list { display:flex; flex-direction:column; gap:12px; }
    .feature-row { display:flex; align-items:center; gap:14px; padding:16px 20px; background: #fff;
      border:1px solid #e2e8f0; border-radius:12px; transition: all .2s; }
    .feature-row:hover { border-color: #bae6fd; box-shadow: 0 4px 12px rgba(14,165,233,0.08); transform: translateY(-1px); }
    .feature-row > div:first-child { flex:1 1 auto; }
    .feature-row strong { font-size: 1.05rem; color: #1e293b; display:block; margin-bottom: 4px; }
    .feature-row code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; color: #64748b; }
    
    .switch { position:relative; display:inline-block; width:50px; height:26px; flex:0 0 auto; cursor:pointer; }
    .switch input { opacity:0; width:0; height:0; }
    .switch .slider { position:absolute; inset:0; background:#cbd5e1; border-radius:26px; transition:.3s; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); }
    .switch .slider::before { content:''; position:absolute; height:20px; width:20px; left:3px; bottom:3px;
      background:#fff; border-radius:50%; transition:.3s; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
    .switch input:checked + .slider { background: #10b981; }
    .switch input:checked + .slider::before { transform:translateX(24px); }
    
    .badge { padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
    .badge-green { background: #d1fae5; color: #059669; }
    .badge-gray { background: #f1f5f9; color: #64748b; }
    
    .theme-choices { display:flex; gap:16px; flex-wrap:wrap; margin-top: 15px; }
    .theme-choice { display:flex; align-items:center; gap:12px; padding:12px 20px; cursor:pointer;
      border:1.5px solid #e2e8f0; border-radius:12px; background:#fff; font-weight:600; color:#475569;
      font-size:14px; transition:all .2s; }
    .theme-choice:hover { border-color:#0ea5e9; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(14,165,233,0.1); }
    .theme-choice.active { border-color:#0ea5e9; background: #f0f9ff; color: #0284c7; }
    .theme-choice .theme-dot { width:22px; height:22px; border-radius:50%; box-shadow:0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,.1); }
    .theme-choice .fa-check { color:#0ea5e9; font-size: 16px; }
  `]
})
export class AdministrationComponent implements OnInit {
  features: FeatureFlag[] = [];
  loading = true;
  saving = false;
  themes = THEMES;
  themeChoisi = themeActuel();

  constructor(private svc: AdminService, private toastr: ToastrService) {}

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading = true;
    this.svc.getFeatures().subscribe({
      next: d => { this.features = d; this.loading = false; },
      error: () => { this.features = []; this.loading = false; this.toastr.error('Impossible de charger les fonctionnalités.'); }
    });
  }

  basculer(f: FeatureFlag): void {
    const actif = !f.actif;
    this.saving = true;
    this.svc.setFeature(f.cle, actif).subscribe({
      next: () => { f.actif = actif; this.saving = false;
        this.toastr.success((f.libelle || f.cle) + (actif ? ' activée.' : ' désactivée.')); },
      error: () => { this.saving = false; this.toastr.error('Échec de la mise à jour.'); }
    });
  }

  /** Applique et mémorise la couleur de l'interface. */
  choisirTheme(cle: string): void {
    this.themeChoisi = cle;
    appliquerTheme(cle);
    this.toastr.success('Couleur de l\'interface appliquée.');
  }
}
