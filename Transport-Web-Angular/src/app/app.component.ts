import { Component, OnInit } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';

interface NavItem { path: string; label: string; icon: string; }

@Component({
  selector: 'app-root',
  template: `
    <div class="app-shell">
      <aside class="sidebar" [class.open]="menuOpen">
        <div class="brand">
          <i class="fa-solid fa-truck-fast"></i>
          <div>Transport<small>DivNet · Livraison</small></div>
        </div>
        <nav class="nav">
          <div class="group-label">Pilotage</div>
          <a *ngFor="let it of navMain" [routerLink]="it.path" routerLinkActive="active"
             (click)="menuOpen=false">
            <i class="fa-solid {{it.icon}}"></i>{{ it.label }}
          </a>
          <div class="group-label">Référentiels</div>
          <a *ngFor="let it of navRef" [routerLink]="it.path" routerLinkActive="active"
             (click)="menuOpen=false">
            <i class="fa-solid {{it.icon}}"></i>{{ it.label }}
          </a>
        </nav>
        <div class="foot">v2.0 · Sécurisé par Keycloak</div>
      </aside>

      <div class="main">
        <header class="topbar">
          <div class="flex">
            <button class="btn btn-ghost" style="display:none" (click)="menuOpen=!menuOpen">
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
      </div>
    </div>
  `
})
export class AppComponent implements OnInit {
  menuOpen = false;
  username = '';
  initials = '?';
  roleLabel = 'Superviseur';

  navMain: NavItem[] = [
    { path: '/dashboard', label: 'Tableau de bord', icon: 'fa-gauge-high' },
    { path: '/voyages',   label: 'Livraison',       icon: 'fa-route' },
    { path: '/voyages-conteneurs', label: 'Voyage', icon: 'fa-truck-fast' },
    { path: '/gps',       label: 'Suivi GPS',       icon: 'fa-map-location-dot' },
    { path: '/rapports',  label: 'Rapports',        icon: 'fa-file-excel' }
  ];
  navRef: NavItem[] = [
    { path: '/flotte',     label: 'Flotte',     icon: 'fa-truck' },
    { path: '/chantiers',  label: 'Chantiers',  icon: 'fa-helmet-safety' },
    { path: '/articles',   label: 'Articles',   icon: 'fa-boxes-stacked' },
    { path: '/matieres-premieres', label: 'Matières premières', icon: 'fa-cubes' }
  ];

  constructor(private keycloak: KeycloakService) {}

  async ngOnInit(): Promise<void> {
    try {
      const profile = await this.keycloak.loadUserProfile();
      this.username = [profile.firstName, profile.lastName].filter(Boolean).join(' ')
        || profile.username || 'Utilisateur';
      this.initials = (this.username.match(/\b\w/g) || ['?']).slice(0, 2).join('');
      const roles = this.keycloak.getUserRoles().filter(r => !r.startsWith('default-roles') &&
        !['offline_access', 'uma_authorization'].includes(r));
      if (roles.length) { this.roleLabel = roles.join(', '); }
    } catch { /* profil indisponible */ }
  }

  logout(): void {
    this.keycloak.logout(window.location.origin);
  }
}
