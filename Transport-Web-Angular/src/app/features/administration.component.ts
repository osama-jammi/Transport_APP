import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { AdminService } from '../services/admin.service';
import { FeatureFlag } from '../core/models';
import { THEMES, themeActuel, appliquerTheme } from '../core/theme';

@Component({
  selector: 'app-administration',
  template: `
    <div class="card">
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

    <div class="card" style="margin-top:18px">
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
  `,
  styles: [`
    .feature-list { display:flex; flex-direction:column; gap:10px; }
    .feature-row { display:flex; align-items:center; gap:14px; padding:12px 14px;
      border:1px solid var(--border); border-radius:10px; }
    .feature-row > div:first-child { flex:1 1 auto; }
    .switch { position:relative; display:inline-block; width:46px; height:24px; flex:0 0 auto; cursor:pointer; }
    .switch input { opacity:0; width:0; height:0; }
    .switch .slider { position:absolute; inset:0; background:var(--gray-light); border-radius:24px; transition:.2s; }
    .switch .slider::before { content:''; position:absolute; height:18px; width:18px; left:3px; top:3px;
      background:#fff; border-radius:50%; transition:.2s; }
    .switch input:checked + .slider { background:var(--accent); }
    .switch input:checked + .slider::before { transform:translateX(22px); }
    .theme-choices { display:flex; gap:12px; flex-wrap:wrap; }
    .theme-choice { display:flex; align-items:center; gap:10px; padding:10px 16px; cursor:pointer;
      border:1.5px solid var(--border); border-radius:12px; background:#fff; font-weight:600; color:var(--text);
      font-size:13.5px; transition:border-color .15s, box-shadow .15s; }
    .theme-choice:hover { border-color:var(--primary); }
    .theme-choice.active { border-color:var(--primary); box-shadow:var(--ring); }
    .theme-choice .theme-dot { width:18px; height:18px; border-radius:50%; box-shadow:0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,.08); }
    .theme-choice .fa-check { color:var(--primary); }
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
