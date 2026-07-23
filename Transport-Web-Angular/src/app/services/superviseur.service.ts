import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Superviseur, SuperviseurRequest } from '../core/models';

/**
 * Comptes superviseur de l'app mobile (table utilisateur_mobile côté backend).
 * Géré uniquement depuis le web (jeton Keycloak) ; l'auth mobile est indépendante.
 */
@Injectable({ providedIn: 'root' })
export class SuperviseurService {
  private base = `${environment.apiUrl}/mobile/superviseurs`;
  constructor(private http: HttpClient) {}

  lister(): Observable<Superviseur[]> { return this.http.get<Superviseur[]>(this.base); }
  creer(dto: SuperviseurRequest): Observable<Superviseur> { return this.http.post<Superviseur>(this.base, dto); }
  modifier(id: number, dto: SuperviseurRequest): Observable<Superviseur> {
    return this.http.put<Superviseur>(`${this.base}/${id}`, dto);
  }
  supprimer(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
}
