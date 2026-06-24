import { Component, OnInit } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { AdminService } from './services/admin.service';
import { appliquerTheme, themeActuel } from './core/theme';

interface NavItem { path: string; label: string; icon: string; feature?: string; }

@Component({
  selector: 'app-root',
  template: `
    <div class="app-shell">
      <div class="sidebar-scrim" [class.show]="menuOpen" (click)="menuOpen=false"></div>
      <aside class="sidebar" [class.open]="menuOpen">
        <div class="brand">
          <i class="fa-solid fa-truck-fast"></i>
          <div>Transport<small>DivNet · Livraison</small></div>
        </div>
        <nav class="nav">
          <div class="group-label">Pilotage</div>
          <a *ngFor="let it of visibles(navMain)" [routerLink]="it.path" routerLinkActive="active"
             (click)="menuOpen=false">
            <i class="fa-solid {{it.icon}}"></i>{{ it.label }}
          </a>
          <div class="group-label">Référentiels</div>
          <a *ngFor="let it of visibles(navRef)" [routerLink]="it.path" routerLinkActive="active"
             (click)="menuOpen=false">
            <i class="fa-solid {{it.icon}}"></i>{{ it.label }}
          </a>
        </nav>
        <div class="foot">v2.0 · Sécurisé par Keycloak</div>
      </aside>

      <div class="main">
        <header class="topbar">
          <div class="flex">
            <button class="burger" (click)="menuOpen=!menuOpen" aria-label="Menu">
              <i class="fa-solid fa-bars"></i>
            </button>
            <span class="page-title">Administration Transport-Livraison</span>
          </div>
          <div class="user">
            <div class="avatar">{{ initials }}</div>
            <div style="line-height:1.2">
              <div style="font-weight:600">{{ username }}</div>
              <div class="muted" style="font-size:12px">{{ roleLabel }}</div>
            </div>
            <button class="btn btn-outline btn-sm" (click)="logout()">
              <i class="fa-solid fa-arrow-right-from-bracket"></i> Déconnexion
            </button>
          </div>
        </header>
        <main class="content">
          <router-outlet></router-outlet>
        </main>
        <footer class="app-foot">
          <span>© {{ annee }} RICHE BOIS — Transport &amp; Livraison</span>
          <span class="muted">Propulsé par DivNet · v2.0 · Sécurisé par Keycloak</span>
        </footer>
      </div>
    </div>
  `
})
export class AppComponent implements OnInit {
  menuOpen = false;
  username = '';
  initials = '?';
  roleLabel = 'Superviseur';
  annee = new Date().getFullYear();

  navMain: NavItem[] = [
    { path: '/dashboard', label: 'Tableau de bord', icon: 'fa-gauge-high' },
    { path: '/voyages',   label: 'Livraison',       icon: 'fa-route' },
    { path: '/voyages-conteneurs', label: 'Voyage', icon: 'fa-truck-fast' },
    { path: '/suivi-trajets', label: 'Suivi trajets', icon: 'fa-route', feature: 'suivi-trajets' },
    { path: '/rapports',  label: 'Rapports',        icon: 'fa-file-excel' }
  ];
  navRef: NavItem[] = [
    { path: '/flotte',     label: 'Flotte',     icon: 'fa-truck' },
    { path: '/chantiers',  label: 'Chantiers',  icon: 'fa-helmet-safety' },
    { path: '/articles',   label: 'Ordre de fabrication', icon: 'fa-boxes-stacked' },
    { path: '/matieres-premieres', label: 'Matières premières', icon: 'fa-cubes' },
    { path: '/depots',     label: 'Dépôt',      icon: 'fa-warehouse' },
    { path: '/administration', label: 'Administration', icon: 'fa-sliders' }
  ];

  /** Clés des fonctionnalités désactivées (masquent les entrées de menu correspondantes). */
  private featuresOff = new Set<string>();

  constructor(private keycloak: KeycloakService, private adminSvc: AdminService) {}

  async ngOnInit(): Promise<void> {
    appliquerTheme(themeActuel());   // applique le thème de couleur choisi
    try {
      // Infos utilisateur lues DANS le token (pas d'appel réseau /account → pas de CORS).
      const kc = this.keycloak.getKeycloakInstance();
      const claims: any = { ...(kc?.idTokenParsed || {}), ...(kc?.tokenParsed || {}) };
      const prenom = claims.given_name || '';
      const nom = claims.family_name || '';
      this.username = [prenom, nom].filter(Boolean).join(' ')
        || claims.preferred_username || claims.name || 'Utilisateur';
      this.initials = (this.username.match(/\b\w/g) || ['?']).slice(0, 2).join('');
      this.roleLabel = this.roleLePlusImportant(this.keycloak.getUserRoles());
    } catch { /* claims indisponibles */ }
    // Charge les fonctionnalités désactivées pour masquer les entrées de menu
    this.adminSvc.getFeatures().subscribe({
      next: features => this.featuresOff = new Set(features.filter(f => !f.actif).map(f => f.cle)),
      error: () => { /* défaut : tout visible */ }
    });
  }

  /** Renvoie le SEUL rôle le plus important (ignore les rôles techniques Keycloak). */
  private roleLePlusImportant(roles: string[]): string {
    const bruit = new Set(['offline_access', 'uma_authorization',
      'manage-account', 'manage-account-links', 'view-profile']);
    const pertinents = roles.filter(r => !r.startsWith('default-roles') && !bruit.has(r));
    if (!pertinents.length) return 'Utilisateur';
    const priorite = ['ADMIN', 'ADMINISTRATEUR', 'CHEF DE PROJET', 'SUPERVISEUR', 'RESPONSABLE', 'MAGASINIER', 'CHAUFFEUR'];
    const upper = pertinents.map(r => r.toUpperCase());
    const best = priorite.find(p => upper.includes(p));
    return best || pertinents[0];
  }

  /** Entrées de menu visibles (filtre celles dont la fonctionnalité est désactivée). */
  visibles(items: NavItem[]): NavItem[] {
    return items.filter(it => !it.feature || !this.featuresOff.has(it.feature));
  }

  logout(): void {
    this.keycloak.logout(window.location.origin);
  }
}
