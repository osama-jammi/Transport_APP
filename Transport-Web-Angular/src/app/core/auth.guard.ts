import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { KeycloakAuthGuard, KeycloakService } from 'keycloak-angular';

@Injectable({ providedIn: 'root' })
export class AuthGuard extends KeycloakAuthGuard {
  constructor(protected override readonly router: Router,
              protected readonly keycloak: KeycloakService) {
    super(router, keycloak);
  }

  public async isAccessAllowed(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean> {
    if (!this.authenticated) {
      await this.keycloak.login({ redirectUri: window.location.origin + state.url });
      return false;
    }
    const requiredRoles: string[] = route.data?.['roles'] ?? [];
    if (requiredRoles.length === 0) {
      return true;
    }
    return requiredRoles.some((r) => this.roles.includes(r));
  }
}
