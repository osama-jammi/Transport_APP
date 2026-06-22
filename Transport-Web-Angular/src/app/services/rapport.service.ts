import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type RapportType = 'synthese' | 'detaille' | 'reserves' | 'non-livres';

@Injectable({ providedIn: 'root' })
export class RapportService {
  private base = `${environment.apiUrl}/rapports`;
  constructor(private http: HttpClient) {}

  /** Télécharge l'export Excel (.xlsx) en blob. */
  export(type: RapportType, debut: string, fin: string): Observable<Blob> {
    const params = new HttpParams().set('debut', debut).set('fin', fin);
    return this.http.get(`${this.base}/${type}`, { params, responseType: 'blob' });
  }

  /**
   * Rapport complet « toutes statistiques » (classeur multi-feuilles).
   * Dates au format yyyy-MM-dd ; filtres chantier/chauffeur optionnels.
   */
  exportComplet(debut: string, fin: string, chantierId?: number | null, chauffeurId?: number | null): Observable<Blob> {
    let params = new HttpParams().set('debut', debut).set('fin', fin);
    if (chantierId)  params = params.set('chantierId', chantierId);
    if (chauffeurId) params = params.set('chauffeurId', chauffeurId);
    return this.http.get(`${this.base}/complet`, { params, responseType: 'blob' });
  }
}
