import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Article, GapArticle } from '../core/models';

@Injectable({ providedIn: 'root' })
export class ArticleService {
  private base = `${environment.apiUrl}/articles`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<Article[]> {
    return this.http.get<Article[]>(this.base);
  }
  /** Articles lus directement depuis la base GAP (ERP). */
  getFromGap(): Observable<GapArticle[]> {
    return this.http.get<GapArticle[]>(`${this.base}/gap`);
  }
  /** Articles actifs / disponibles (non rattachés à un voyage) */
  disponibles(): Observable<Article[]> {
    return this.http.get<Article[]>(`${this.base}/disponibles`);
  }
  importFromGap(): Observable<Article[]> {
    return this.http.post<Article[]>(`${this.base}/import-gap`, {});
  }
  scan(qrCode: string, phase: string): Observable<Article> {
    const params = new HttpParams().set('qrCode', qrCode).set('phase', phase);
    return this.http.post<Article>(`${this.base}/scan`, null, { params });
  }
  qrCode(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/qrcode`, { responseType: 'blob' });
  }
}
