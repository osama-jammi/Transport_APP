import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PositionGps, TrajetChauffeur } from '../core/models';

@Injectable({ providedIn: 'root' })
export class GpsService {
  private base = `${environment.apiUrl}/gps`;
  constructor(private http: HttpClient) {}

  dernieresPositions(): Observable<PositionGps[]> {
    return this.http.get<PositionGps[]>(`${this.base}/positions`);
  }
  dernierePosition(camionId: number): Observable<PositionGps> {
    return this.http.get<PositionGps>(`${this.base}/positions/${camionId}`);
  }
  /** Trajets par chauffeur sur une période (dates ISO YYYY-MM-DD ; bornes incluses). */
  trajetsParChauffeur(debut?: string, fin?: string, chauffeurId?: number): Observable<TrajetChauffeur[]> {
    let params = new HttpParams();
    if (debut) params = params.set('debut', debut);
    if (fin) params = params.set('fin', fin);
    if (chauffeurId != null) params = params.set('chauffeurId', String(chauffeurId));
    return this.http.get<TrajetChauffeur[]>(`${this.base}/trajets`, { params });
  }
}
