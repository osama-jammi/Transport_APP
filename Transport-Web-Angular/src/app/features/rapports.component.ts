import { Component } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { RapportService, RapportType } from '../services/rapport.service';

interface RapportCard { type: RapportType; titre: string; desc: string; icon: string; couleur: string; }

@Component({
  selector: 'app-rapports',
  template: `
    <div class="premium-rapports">
      <div class="header">
        <h1><i class="fa-solid fa-file-excel"></i> Rapports et Exports</h1>
        <p class="subtitle">Générateur d'extractions statistiques multi-formats.</p>
      </div>
      
    <div class="glass-card m-t"><div class="card-head"><h2>Période d'export</h2></div>
      <div class="card-body">
        <div class="form-grid" style="max-width:520px">
          <div class="field"><label>Date début *</label><input type="date" [(ngModel)]="debut"></div>
          <div class="field"><label>Date fin *</label><input type="date" [(ngModel)]="fin"></div>
        </div>
      </div>
    </div>

    <!-- Rapport complet : toutes les statistiques en un seul classeur -->
    <div class="glass-card m-t" style="cursor:pointer;border:1px solid var(--accent)" (click)="exporterComplet()">
      <div class="card-body" style="display:flex;align-items:center;gap:16px">
        <div style="width:48px;height:48px;border-radius:12px;display:grid;place-items:center;
                    background:var(--accent);color:#fff;font-size:20px;flex:0 0 auto">
          <i class="fa-solid fa-file-excel"></i>
        </div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:1.05rem">Rapport complet — toutes statistiques</div>
          <div class="lbl">Classeur multi-feuilles : synthèse (KPI), par chauffeur, par chantier, par jour, réserves.</div>
        </div>
        <i class="fa-solid" [ngClass]="loadingComplet ? 'fa-spinner fa-spin' : 'fa-file-arrow-down'"
           style="color:var(--accent);font-size:18px"></i>
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
    </div>
  `,
  styles: [`
    .premium-rapports {
      font-family: 'Inter', 'Segoe UI', Roboto, sans-serif;
      color: #334155;
      padding: 20px;
      max-width: 1500px;
      margin: 0 auto;
    }

    .header { margin-bottom: 25px; }
    .header h1 { margin: 0; font-size: 2rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 12px; }
    .header h1 i { color: #0ea5e9; }
    .subtitle { color: #64748b; margin-top: 4px; font-size: 1.05rem; }

    .glass-panel, .glass-card {
      background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border: 1px solid #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
      padding: 25px; margin-bottom: 20px; transition: transform 0.2s, box-shadow 0.2s;
    }
    .glass-card:hover { box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08); transform: translateY(-2px); }

    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .field label { display: block; font-size: 0.9rem; font-weight: 600; color: #475569; margin-bottom: 6px; }
    input[type="date"] {
      width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px;
      font-size: 0.95rem; color: #0f172a; transition: all 0.2s; background: #fff;
    }
    input[type="date"]:focus { outline: none; border-color: #0ea5e9; box-shadow: 0 0 0 3px #e0f2fe; }

    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
    .stat {
      background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px);
      border: 1px solid #ffffff; border-radius: 16px; padding: 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04); display: flex; align-items: center; gap: 16px;
      transition: all 0.2s ease; position: relative; overflow: hidden;
    }
    .stat:hover { box-shadow: 0 10px 25px rgba(14, 165, 233, 0.15); transform: translateY(-3px); border-color: #bae6fd; }
    
    .stat .ic {
      width: 55px; height: 55px; border-radius: 14px; display: grid; place-items: center;
      font-size: 24px; color: #fff; flex: 0 0 55px; position: relative; z-index: 1;
    }
    .stat .ic.blue { background: linear-gradient(135deg, #38bdf8, #0284c7); box-shadow: 0 8px 18px rgba(2, 132, 199, 0.25); }
    .stat .ic.cyan { background: linear-gradient(135deg, #22d3ee, #0891b2); box-shadow: 0 8px 18px rgba(8, 145, 178, 0.25); }
    .stat .ic.orange { background: linear-gradient(135deg, #fb923c, #ea580c); box-shadow: 0 8px 18px rgba(234, 88, 12, 0.25); }
    .stat .ic.green { background: linear-gradient(135deg, #4ade80, #16a34a); box-shadow: 0 8px 18px rgba(22, 163, 74, 0.25); }
    
    .stat .lbl { color: #64748b; font-size: 0.9rem; margin-top: 4px; font-weight: 500; line-height: 1.3; }
  `]
})
export class RapportsComponent {
  debut = ''; fin = '';
  loading: RapportType | null = null;
  loadingComplet = false;

  cartes: RapportCard[] = [
    { type: 'synthese',   titre: 'Synthèse',        desc: 'Vue agrégée des performances.',  icon: 'fa-chart-pie',  couleur: 'blue' },
    { type: 'detaille',   titre: 'Détaillé',        desc: 'Détail ligne par ligne complet.',icon: 'fa-table-list', couleur: 'cyan' },
    { type: 'reserves',   titre: 'Réserves',        desc: 'Incidents et réclamations.',     icon: 'fa-triangle-exclamation', couleur: 'orange' },
    { type: 'non-livres', titre: 'Non livrés',      desc: 'Voyages annulés ou non livrés.', icon: 'fa-ban',        couleur: 'green' }
  ];

  constructor(private svc: RapportService, private toastr: ToastrService) {}

  exporter(r: RapportCard): void {
    if (!this.debut || !this.fin) { this.toastr.warning('Sélectionnez une période.'); return; }
    this.loading = r.type;
    this.svc.export(r.type, this.debut + 'T00:00:00', this.fin + 'T23:59:59').subscribe({
      next: blob => {
        this.telecharger(blob, `${r.type}.xlsx`);
        this.loading = null;
        this.toastr.success(`Export « ${r.titre} » téléchargé.`);
      },
      error: () => { this.loading = null; this.toastr.error("Échec de l'export."); }
    });
  }

  exporterComplet(): void {
    if (!this.debut || !this.fin) { this.toastr.warning('Sélectionnez une période.'); return; }
    this.loadingComplet = true;
    this.svc.exportComplet(this.debut, this.fin).subscribe({
      next: blob => {
        this.telecharger(blob, 'rapport-complet.xlsx');
        this.loadingComplet = false;
        this.toastr.success('Rapport complet téléchargé.');
      },
      error: () => { this.loadingComplet = false; this.toastr.error("Échec de l'export."); }
    });
  }

  private telecharger(blob: Blob, nom: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nom; a.click();
    URL.revokeObjectURL(url);
  }
}
