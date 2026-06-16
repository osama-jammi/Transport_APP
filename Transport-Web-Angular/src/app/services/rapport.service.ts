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
}
