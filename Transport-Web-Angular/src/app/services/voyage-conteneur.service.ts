import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { VoyageConteneur, VoyageConteneurRequest, GapVoyage, TrajetVoyage, MatierePremiere } from '../core/models';

@Injectable({ providedIn: 'root' })
export class VoyageConteneurService {
  private base = `${environment.apiUrl}/voyages-conteneurs`;
  constructor(private http: HttpClient) {}

  getAll(vue: 'en-cours' | 'archives' | 'historique' = 'en-cours'): Observable<VoyageConteneur[]> {
    if (vue === 'historique') return this.http.get<VoyageConteneur[]>(`${this.base}?tout=true`);
    return this.http.get<VoyageConteneur[]>(`${this.base}?archives=${vue === 'archives'}`);
  }
  archiver(id: number): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/archiver`, {});
  }
  create(req: VoyageConteneurRequest): Observable<number> {
    return this.http.post<number>(this.base, req);
  }
  update(id: number, req: VoyageConteneurRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, req);
  }
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
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
  /** Détache une livraison du voyage (sans la supprimer de GAP). */
  detacherLivraison(livId: number): Observable<void> {
    return this.http.patch<void>(`${this.base}/livraisons/${livId}/detacher`, {});
  }
  /** Clôture / rouvre une ligne de matière première (statut local, sans impact ERP). */
  statutMatiere(mpId: number, statut: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/matieres/${mpId}/statut?statut=${statut}`, {});
  }
}
