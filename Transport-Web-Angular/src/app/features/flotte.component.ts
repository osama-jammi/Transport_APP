import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ToastrService } from 'ngx-toastr';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ChauffeurService } from '../services/chauffeur.service';
import { CamionService } from '../services/camion.service';
import { Chauffeur, ChauffeurRequest, Camion } from '../core/models';
import { imprimerQrChauffeur } from '../core/qr-print';

/**
 * Flotte = vue combinée Chauffeurs + Camions.
 * Chaque chauffeur est associé à un camion ; cette page réunit les deux référentiels.
 */
interface FleetUnit { chauffeur: Chauffeur; camion?: Camion; }

@Component({
  selector: 'app-flotte',
  template: `
    <div class="toolbar">
      <div class="search"><i class="fa-solid fa-magnifying-glass"></i>
        <input [(ngModel)]="q" placeholder="Rechercher (chauffeur, matricule, camion)…"></div>
      <button class="btn btn-primary right" (click)="ouvrirCamion()">
        <i class="fa-solid fa-truck"></i> Nouveau camion</button>
    </div>

    <!-- Cartes flotte : chauffeur + camion -->
    <div *ngIf="loading" class="spinner"></div>
    <div *ngIf="!loading && unites().length===0" class="card"><div class="empty">
      <i class="fa-solid fa-id-card"></i> Aucun chauffeur</div></div>

    <div class="fleet-grid" *ngIf="!loading">
      <div class="fleet-card" *ngFor="let u of unites()">
        <div class="fleet-top">
          <div class="avatar avatar-lg">{{ u.chauffeur.prenom?.charAt(0) }}{{ u.chauffeur.nom?.charAt(0) }}</div>
          <div class="fleet-id">
            <strong>{{ u.chauffeur.prenom }} {{ u.chauffeur.nom }}</strong>
            <span class="mono">{{ u.chauffeur.matricule }}</span>
          </div>
          <span class="badge" [ngClass]="u.chauffeur.actif !== false ? 'badge-green' : 'badge-gray'">
            {{ u.chauffeur.actif !== false ? 'Actif' : 'Inactif' }}</span>
        </div>

        <div class="fleet-row"><i class="fa-solid fa-phone"></i>{{ u.chauffeur.telephone || '—' }}</div>
        <div class="fleet-row"><i class="fa-solid fa-clock"></i>
          {{ u.chauffeur.derniereConnexion ? (u.chauffeur.derniereConnexion | date:'dd/MM/yy HH:mm') : 'Jamais connecté' }}</div>

        <div class="fleet-truck" [class.no-truck]="!u.camion">
          <i class="fa-solid fa-truck"></i>
          <ng-container *ngIf="u.camion; else noTruck">
            <div>
              <strong>{{ u.camion.immatriculation }}</strong>
              <span class="muted">{{ u.camion.type || '—' }}<span *ngIf="u.camion.marque"> · {{ u.camion.marque }}</span></span>
            </div>
            <span class="badge" [ngClass]="u.camion.etat==='OCCUPE' ? 'badge-orange' : 'badge-green'" style="margin-left:auto">
              {{ u.camion.etat }}</span>
          </ng-container>
          <ng-template #noTruck><span class="muted">Aucun camion affecté</span></ng-template>
        </div>

        <div class="fleet-actions">
          <button class="btn btn-outline btn-sm" (click)="voirQr(u.chauffeur)"><i class="fa-solid fa-qrcode"></i> QR</button>
          <button *ngIf="u.camion" class="btn btn-outline btn-sm" (click)="ouvrirCamion(u.camion)"><i class="fa-solid fa-truck"></i> Camion</button>
        </div>
      </div>
    </div>

    <!-- Camions non affectés -->
    <div class="card" *ngIf="!loading && camionsLibres().length">
      <div class="card-head"><h2>Camions sans chauffeur ({{ camionsLibres().length }})</h2></div>
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Immatriculation</th><th>Type</th><th>Marque</th><th>État</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let c of camionsLibres()">
            <td><code>{{ c.id }}</code></td>
            <td><strong>{{ c.immatriculation }}</strong></td>
            <td>{{ c.type || '—' }}</td>
            <td>{{ c.marque || '—' }}</td>
            <td><span class="badge" [ngClass]="c.etat==='OCCUPE' ? 'badge-orange' : 'badge-green'">{{ c.etat }}</span></td>
            <td class="flex">
              <button class="btn btn-outline btn-sm" (click)="ouvrirCamion(c)"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-danger btn-sm" (click)="supprimerCamion(c)"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        </tbody>
      </table></div>
    </div>

    <!-- Modal chauffeur -->
    <div class="modal-backdrop" *ngIf="modalChauffeur" (click)="closeBackdrop($event,'chauffeur')">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>{{ editChauffeurId ? 'Modifier' : 'Nouveau' }} chauffeur</h3>
          <button class="x" (click)="modalChauffeur=false">&times;</button></div>
        <div class="m-body"><div class="form-grid">
          <div class="field"><label>Nom *</label><input [(ngModel)]="formChauffeur.nom"></div>
          <div class="field"><label>Prénom *</label><input [(ngModel)]="formChauffeur.prenom"></div>
          <div class="field"><label>Matricule *</label><input [(ngModel)]="formChauffeur.matricule"></div>
          <div class="field"><label>Téléphone</label><input [(ngModel)]="formChauffeur.telephone"></div>
        </div></div>
        <div class="m-foot">
          <button class="btn btn-outline" (click)="modalChauffeur=false">Annuler</button>
          <button class="btn btn-primary" (click)="enregistrerChauffeur()" [disabled]="saving">
            <i class="fa-solid fa-floppy-disk"></i> Enregistrer</button>
        </div>
      </div>
    </div>

    <!-- Modal camion -->
    <div class="modal-backdrop" *ngIf="modalCamion" (click)="closeBackdrop($event,'camion')">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>{{ editCamionId ? 'Modifier' : 'Nouveau' }} camion</h3>
          <button class="x" (click)="modalCamion=false">&times;</button></div>
        <div class="m-body"><div class="form-grid">
          <div class="field"><label>Immatriculation (marocaine) *</label>
            <div style="display:flex;align-items:center;gap:6px">
              <input style="flex:1;text-align:center" placeholder="12345" [(ngModel)]="immatGauche" inputmode="numeric">
              <span style="font-weight:700">|</span>
              <input style="width:64px;text-align:center" placeholder="أ / a" [(ngModel)]="immatLettre">
              <span style="font-weight:700">|</span>
              <input style="width:80px;text-align:center" placeholder="12" [(ngModel)]="immatDroite" inputmode="numeric">
            </div>
            <small class="muted">Format : numéro | lettre | numéro</small></div>
          <div class="field"><label>Type d'outil *</label>
            <select [(ngModel)]="formCamion.type">
              <option [ngValue]="undefined" disabled>— Choisir —</option>
              <option value="VOITURE">Voiture</option>
              <option value="CAMION">Camion</option>
              <option value="PICKUP">Pickup</option>
            </select></div>
          <div class="field"><label>Marque</label><input [(ngModel)]="formCamion.marque" placeholder="Ex : Renault"></div>
          <div class="field"><label>État</label>
            <input disabled [value]="formCamion.chauffeurId ? 'OCCUPE (chauffeur affecté)' : 'LIBRE (aucun chauffeur)'">
            <small class="muted">L'état est automatique : Occupé si un chauffeur est affecté, sinon Libre.</small></div>
          <div class="field"><label>Chauffeur affecté</label>
            <select [(ngModel)]="formCamion.chauffeurId">
              <option [ngValue]="null">— Aucun —</option>
              <option *ngFor="let ch of chauffeurs" [ngValue]="ch.id">{{ ch.prenom }} {{ ch.nom }} ({{ ch.matricule }})</option>
            </select></div>
        </div></div>
        <div class="m-foot">
          <button class="btn btn-outline" (click)="modalCamion=false">Annuler</button>
          <button class="btn btn-primary" (click)="enregistrerCamion()" [disabled]="saving">
            <i class="fa-solid fa-floppy-disk"></i> Enregistrer</button>
        </div>
      </div>
    </div>

    <!-- Modal QR -->
    <div class="modal-backdrop" *ngIf="qrModal" (click)="qrModal=false">
      <div class="modal" style="max-width:360px;text-align:center" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>QR code chauffeur</h3><button class="x" (click)="qrModal=false">&times;</button></div>
        <div class="m-body">
          <img *ngIf="qrUrl" [src]="qrUrl" alt="QR" style="width:240px;height:240px">
          <div *ngIf="!qrUrl" class="spinner"></div>
          <div *ngIf="qrChauffeur" style="font-weight:700;font-size:16px;margin-top:8px">
            {{ qrChauffeur.prenom }} {{ qrChauffeur.nom }}</div>
          <p class="muted" style="font-size:12px;margin-top:8px">À scanner depuis l'application mobile chauffeur.</p>
        </div>
        <div class="m-foot">
          <button class="btn btn-outline" (click)="qrModal=false">Fermer</button>
          <button class="btn btn-primary" (click)="qrChauffeur && imprimerQr(qrChauffeur)" [disabled]="!qrUrl">
            <i class="fa-solid fa-print"></i> Imprimer</button>
        </div>
      </div>
    </div>
  `
})
export class FlotteComponent implements OnInit {
  chauffeurs: Chauffeur[] = [];
  camions: Camion[] = [];
  loading = true; saving = false;
  q = '';

  modalChauffeur = false; editChauffeurId: number | null = null;
  formChauffeur: ChauffeurRequest = { nom: '', prenom: '', matricule: '', telephone: '' };

  modalCamion = false; editCamionId: number | null = null;
  formCamion: Partial<Camion> = { immatriculation: '', etat: 'LIBRE' };
  // Immatriculation marocaine en 3 champs (numéro | lettre | numéro)
  immatGauche = ''; immatLettre = ''; immatDroite = '';

  qrModal = false; qrUrl: SafeUrl | null = null; qrChauffeur: Chauffeur | null = null;

  constructor(
    private chauffeurSvc: ChauffeurService,
    private camionSvc: CamionService,
    private toastr: ToastrService,
    private san: DomSanitizer
  ) {}

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading = true;
    forkJoin({
      // Chauffeurs lus depuis GAP (lecture seule) puis adaptés au modèle Chauffeur
      chauffeurs: this.chauffeurSvc.getFromGap().pipe(
        map(list => list.map(g => ({
          id: g.id,
          nom: g.nom ?? '',
          prenom: g.prenom ?? '',
          matricule: g.matricule != null ? String(g.matricule) : '',
          derniereConnexion: g.derniereConnexion
        } as Chauffeur))),
        catchError(() => of([] as Chauffeur[]))
      ),
      camions:    this.camionSvc.getAll().pipe(catchError(() => of([] as Camion[])))
    }).subscribe(({ chauffeurs, camions }) => {
      this.chauffeurs = chauffeurs;
      this.camions = camions;
      this.loading = false;
    });
  }

  camionDe(chauffeurId: number): Camion | undefined {
    return this.camions.find(c => c.chauffeurId === chauffeurId);
  }

  unites(): FleetUnit[] {
    const t = this.q.toLowerCase().trim();
    return this.chauffeurs
      .map(ch => ({ chauffeur: ch, camion: this.camionDe(ch.id) }))
      .filter(u => !t ||
        `${u.chauffeur.nom} ${u.chauffeur.prenom} ${u.chauffeur.matricule} ${u.camion?.immatriculation || ''}`
          .toLowerCase().includes(t));
  }

  camionsLibres(): Camion[] {
    const t = this.q.toLowerCase().trim();
    return this.camions
      .filter(c => !c.chauffeurId)
      .filter(c => !t || `${c.immatriculation} ${c.device}`.toLowerCase().includes(t));
  }

  closeBackdrop(e: Event, which: 'chauffeur' | 'camion'): void {
    if (e.target !== e.currentTarget) return;
    if (which === 'chauffeur') this.modalChauffeur = false; else this.modalCamion = false;
  }

  /* ───── Chauffeur CRUD ───── */
  ouvrirChauffeur(c?: Chauffeur): void {
    if (c) { this.editChauffeurId = c.id; this.formChauffeur = { nom: c.nom, prenom: c.prenom, matricule: c.matricule, telephone: c.telephone }; }
    else { this.editChauffeurId = null; this.formChauffeur = { nom: '', prenom: '', matricule: '', telephone: '' }; }
    this.modalChauffeur = true;
  }
  enregistrerChauffeur(): void {
    if (!this.formChauffeur.nom || !this.formChauffeur.prenom || !this.formChauffeur.matricule) {
      this.toastr.warning('Nom, prénom et matricule obligatoires.'); return;
    }
    this.saving = true;
    const obs = this.editChauffeurId
      ? this.chauffeurSvc.update(this.editChauffeurId, this.formChauffeur)
      : this.chauffeurSvc.create(this.formChauffeur);
    obs.subscribe({
      next: () => { this.toastr.success('Chauffeur enregistré.'); this.modalChauffeur = false; this.saving = false; this.charger(); },
      error: () => { this.toastr.error('Échec enregistrement.'); this.saving = false; }
    });
  }
  supprimerChauffeur(c: Chauffeur): void {
    if (!confirm(`Supprimer ${c.nom} ${c.prenom} ?`)) return;
    this.chauffeurSvc.delete(c.id).subscribe({
      next: () => { this.toastr.success('Chauffeur supprimé.'); this.charger(); },
      error: () => this.toastr.error('Échec suppression.')
    });
  }

  /* ───── Camion CRUD ───── */
  ouvrirCamion(c?: Camion): void {
    if (c) {
      this.editCamionId = c.id;
      this.formCamion = { immatriculation: c.immatriculation, type: c.type, marque: c.marque, etat: c.etat, chauffeurId: c.chauffeurId ?? null };
      const parts = (c.immatriculation || '').split('-');
      this.immatGauche = parts[0] || ''; this.immatLettre = parts[1] || ''; this.immatDroite = parts[2] || '';
    } else {
      this.editCamionId = null;
      this.formCamion = { immatriculation: '', etat: 'LIBRE', chauffeurId: null };
      this.immatGauche = ''; this.immatLettre = ''; this.immatDroite = '';
    }
    this.modalCamion = true;
  }
  enregistrerCamion(): void {
    // Recompose l'immatriculation marocaine (numéro-lettre-numéro)
    this.formCamion.immatriculation = [this.immatGauche, this.immatLettre, this.immatDroite]
      .map(s => (s || '').trim()).join('-');
    if (!this.immatGauche || !this.immatLettre || !this.immatDroite) {
      this.toastr.warning('Renseignez les 3 champs de l\'immatriculation.'); return;
    }
    if (!this.formCamion.type) { this.toastr.warning('Choisissez le type d\'outil.'); return; }
    // Renseigner le nom du chauffeur GAP affecté (dénormalisé pour l'affichage)
    const ch = this.chauffeurs.find(c => c.id === this.formCamion.chauffeurId);
    this.formCamion.chauffeurNom = ch ? `${ch.prenom} ${ch.nom}` : undefined;
    this.saving = true;
    const obs = this.editCamionId
      ? this.camionSvc.update(this.editCamionId, this.formCamion)
      : this.camionSvc.create(this.formCamion);
    obs.subscribe({
      next: () => { this.toastr.success('Camion enregistré.'); this.modalCamion = false; this.saving = false; this.charger(); },
      error: () => { this.toastr.error('Échec enregistrement.'); this.saving = false; }
    });
  }
  supprimerCamion(c: Camion): void {
    if (!confirm(`Supprimer ${c.immatriculation} ?`)) return;
    this.camionSvc.delete(c.id).subscribe({
      next: () => { this.toastr.success('Camion supprimé.'); this.charger(); },
      error: () => this.toastr.error('Échec suppression.')
    });
  }

  /* ───── QR ───── */
  voirQr(c: Chauffeur): void {
    this.qrUrl = null; this.qrModal = true; this.qrChauffeur = c;
    this.chauffeurSvc.qrCodeGap(c.id).subscribe({
      next: b => this.qrUrl = this.san.bypassSecurityTrustUrl(URL.createObjectURL(b)),
      error: () => { this.toastr.error('QR indisponible.'); this.qrModal = false; }
    });
  }

  /** Imprime le QR code du chauffeur avec son prénom et nom en dessous. */
  imprimerQr(c: Chauffeur): void {
    this.chauffeurSvc.qrCodeGap(c.id).subscribe({
      next: blob => imprimerQrChauffeur(blob, c.nom, c.prenom,
        () => this.toastr.warning('Autorisez les pop-ups pour imprimer.')),
      error: () => this.toastr.error('QR indisponible.')
    });
  }
}
