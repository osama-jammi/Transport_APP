import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Camion } from '../core/models';

/**
 * NB: le backend actuel n'expose PAS encore /api/camions (voir AUDIT.md).
 * Ce service est prêt — il fonctionnera dès l'ajout du CamionController.
 */
@Injectable({ providedIn: 'root' })
export class CamionService {
  private base = `${environment.apiUrl}/camions`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<Camion[]> { return this.http.get<Camion[]>(this.base); }
  getById(id: number): Observable<Camion> { return this.http.get<Camion>(`${this.base}/${id}`); }
  create(c: Partial<Camion>): Observable<Camion> { return this.http.post<Camion>(this.base, c); }
  update(id: number, c: Partial<Camion>): Observable<Camion> { return this.http.put<Camion>(`${this.base}/${id}`, c); }
  delete(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
}
