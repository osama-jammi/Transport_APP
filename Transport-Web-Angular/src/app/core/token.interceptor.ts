import { Injectable } from '@angular/core';
import {
  HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse
} from '@angular/common/http';
import { from, Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { KeycloakService } from 'keycloak-angular';
import { ToastrService } from 'ngx-toastr';

/**
 * Ajoute le jeton Bearer Keycloak à chaque appel /api,
 * rafraîchit le token si nécessaire et gère 401/403.
 */
@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  constructor(private keycloak: KeycloakService, private toastr: ToastrService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Ne pas intercepter les ressources externes (CDN, tuiles de carte...)
    if (!req.url.startsWith('/') && !req.url.includes('/Transport')) {
      return next.handle(req);
    }

    return from(this.keycloak.updateToken(20)).pipe(
      // Si le rafraîchissement du token échoue (refresh token / session expirés),
      // c'est une erreur Keycloak SANS status HTTP : on force la reconnexion
      // plutôt que de laisser remonter une fausse erreur métier.
      catchError((refreshErr) => {
        this.toastr.warning('Session expirée, reconnexion…');
        this.keycloak.login({ redirectUri: window.location.href });
        return throwError(() => refreshErr);
      }),
      switchMap(() => from(this.keycloak.getToken())),
      switchMap((token) => {
        const authReq = token
          ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
          : req;
        return next.handle(authReq);
      }),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.toastr.warning('Session expirée, reconnexion…');
          this.keycloak.login({ redirectUri: window.location.href });
        } else if (err.status === 403) {
          this.toastr.error('Accès refusé (droits insuffisants).');
        } else if (err.status === 0) {
          this.toastr.error('Backend injoignable (port 8082).');
        }
        return throwError(() => err);
      })
    );
  }
}
