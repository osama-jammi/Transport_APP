import { Component } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { RapportService, RapportType } from '../services/rapport.service';

interface RapportCard { type: RapportType; titre: string; desc: string; icon: string; couleur: string; }

@Component({
  selector: 'app-rapports',
  template: `
    <div class="card"><div class="card-head"><h2>Période d'export</h2></div>
      <div class="card-body">
        <div class="form-grid" style="max-width:520px">
          <div class="field"><label>Date début *</label><input type="date" [(ngModel)]="debut"></div>
          <div class="field"><label>Date fin *</label><input type="date" [(ngModel)]="fin"></div>
        </div>
      </div>
    </div>

    <div class="stats">
      <div class="stat" *ngFor="let r of cartes" style="cursor:pointer" (click)="exporter(r)">
        <div class="ic {{r.couleur}}"><i class="fa-solid {{r.icon}}"></i></div>
        <div style="flex:1">
          <div style="font-weight:600">{{ r.titre }}</div>
          <div class="lbl">{{ r.desc }}</div>
        </div>
        <i class="fa-solid" [ngClass]="loading===r.type ? 'fa-spinner fa-spin' : 'fa-file-arrow-down'"
           style="color:var(--gray-light)"></i>
      </div>
    </div>

    <p class="muted"><i class="fa-solid fa-circle-info"></i>
      Les rapports sont générés au format Excel (.xlsx) sur la période sélectionnée.</p>
  `
})
export class RapportsComponent {
  debut = ''; fin = '';
  loading: RapportType | null = null;

  cartes: RapportCard[] = [
    { type: 'synthese',   titre: 'Synthèse',        desc: 'Vue agrégée des voyages',        icon: 'fa-chart-pie',  couleur: 'blue' },
    { type: 'detaille',   titre: 'Détaillé',        desc: 'Détail ligne par ligne',         icon: 'fa-table-list', couleur: 'cyan' },
    { type: 'reserves',   titre: 'Réserves',        desc: 'Incidents et réserves',          icon: 'fa-triangle-exclamation', couleur: 'orange' },
    { type: 'non-livres', titre: 'Non livrés',      desc: 'Voyages non livrés / supprimés', icon: 'fa-ban',        couleur: 'green' }
  ];

  constructor(private svc: RapportService, private toastr: ToastrService) {}

  exporter(r: RapportCard): void {
    if (!this.debut || !this.fin) { this.toastr.warning('Sélectionnez une période.'); return; }
    this.loading = r.type;
    this.svc.export(r.type, this.debut + 'T00:00:00', this.fin + 'T23:59:59').subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${r.type}.xlsx`; a.click();
        URL.revokeObjectURL(url);
        this.loading = null;
        this.toastr.success(`Export « ${r.titre} » téléchargé.`);
      },
      error: () => { this.loading = null; this.toastr.error("Échec de l'export."); }
    });
  }
}
