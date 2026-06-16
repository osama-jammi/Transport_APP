import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Chauffeur, ChauffeurRequest, GapChauffeur } from '../core/models';

@Injectable({ providedIn: 'root' })
export class ChauffeurService {
  private base = `${environment.apiUrl}/chauffeurs`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<Chauffeur[]> { return this.http.get<Chauffeur[]>(this.base); }
  /** Chauffeurs lus directement depuis la base GAP (ERP). */
  getFromGap(): Observable<GapChauffeur[]> { return this.http.get<GapChauffeur[]>(`${this.base}/gap`); }
  getById(id: number): Observable<Chauffeur> { return this.http.get<Chauffeur>(`${this.base}/${id}`); }
  create(dto: ChauffeurRequest): Observable<Chauffeur> { return this.http.post<Chauffeur>(this.base, dto); }
  update(id: number, dto: ChauffeurRequest): Observable<Chauffeur> { return this.http.put<Chauffeur>(`${this.base}/${id}`, dto); }
  delete(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }

  /** Récupère le QR code (PNG) en blob pour affichage/téléchargement. */
  qrCode(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/qrcode`, { responseType: 'blob' });
  }
  /** QR code (PNG) d'un chauffeur GAP. */
  qrCodeGap(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/gap/${id}/qrcode`, { responseType: 'blob' });
  }
}
