import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { VoyageConteneur, VoyageConteneurRequest, GapVoyage, TrajetVoyage, MatierePremiere } from '../core/models';

@Injectable({ providedIn: 'root' })
export class VoyageConteneurService {
  private base = `${environment.apiUrl}/voyages-conteneurs`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<VoyageConteneur[]> {
    return this.http.get<VoyageConteneur[]>(this.base);
  }
  create(req: VoyageConteneurRequest): Observable<number> {
    return this.http.post<number>(this.base, req);
  }
  update(id: number, req: VoyageConteneurRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, req);
  }
  /** Livraisons libres ou déjà rattachées à ce voyage. */
  livraisonsAssignables(id: number): Observable<GapVoyage[]> {
    return this.http.get<GapVoyage[]>(`${this.base}/${id}/livraisons-assignables`);
  }
  /** Livraisons rattachées à ce voyage. */
  livraisons(id: number): Observable<GapVoyage[]> {
    return this.http.get<GapVoyage[]>(`${this.base}/${id}/livraisons`);
  }
  /** Trajet GPS agrégé du voyage. */
  trajet(id: number): Observable<TrajetVoyage> {
    return this.http.get<TrajetVoyage>(`${this.base}/${id}/trajet`);
  }
  /** Matières premières rattachées directement au voyage. */
  matieres(id: number): Observable<MatierePremiere[]> {
    return this.http.get<MatierePremiere[]>(`${this.base}/${id}/matieres`);
  }
}
