import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ArticleStock } from '../core/models';

/** Stock DivNet en lecture seule : dépôts (RB1..RB5) + articles disponibles par dépôt. */
@Injectable({ providedIn: 'root' })
export class StockService {
  private base = `${environment.apiUrl}/stock`;
  constructor(private http: HttpClient) {}

  /** Liste des dépôts ayant du stock (codes DEPO). */
  getDepots(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/depots`);
  }

  /** Articles disponibles (stock > 0) d'un dépôt, filtre optionnel par référence/désignation. */
  getArticles(depot: string, search?: string): Observable<ArticleStock[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<ArticleStock[]>(`${this.base}/depots/${encodeURIComponent(depot)}/articles`, { params });
  }
}
