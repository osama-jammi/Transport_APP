import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Chantier, ChantierRequest, GapChantier } from '../core/models';

@Injectable({ providedIn: 'root' })
export class ChantierService {
  private base = `${environment.apiUrl}/chantiers`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<Chantier[]> { return this.http.get<Chantier[]>(this.base); }
  /** Chantiers lus directement depuis la base GAP (table projet), adaptés au modèle Chantier. */
  getFromGap(): Observable<Chantier[]> {
    return this.http.get<GapChantier[]>(`${this.base}/gap`).pipe(
      map(list => list.map(g => ({
        id: g.id,
        nom: g.designation || g.code || `Projet ${g.id}`,
        ville: g.code,
        code: g.code,
        latitude: g.latitude,
        longitude: g.longitude,
        rayonMetres: g.rayonMetres,
        actif: g.actif !== false
      } as Chantier)))
    );
  }
  getById(id: number): Observable<Chantier> { return this.http.get<Chantier>(`${this.base}/${id}`); }
  create(dto: ChantierRequest): Observable<Chantier> { return this.http.post<Chantier>(this.base, dto); }
  update(id: number, dto: ChantierRequest): Observable<Chantier> { return this.http.put<Chantier>(`${this.base}/${id}`, dto); }
}
