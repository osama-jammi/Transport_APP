import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { AdminService } from '../services/admin.service';
import { FeatureFlag } from '../core/models';

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
  `]
})
export class AdministrationComponent implements OnInit {
  features: FeatureFlag[] = [];
  loading = true;
  saving = false;

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
}
