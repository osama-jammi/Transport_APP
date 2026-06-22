import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { FeatureFlag } from '../core/models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private base = `${environment.apiUrl}/admin`;
  constructor(private http: HttpClient) {}

  /** Liste des fonctionnalités et leur état. */
  getFeatures(): Observable<FeatureFlag[]> {
    return this.http.get<FeatureFlag[]>(`${this.base}/features`);
  }
  /** Active / désactive une fonctionnalité. */
  setFeature(cle: string, actif: boolean): Observable<FeatureFlag> {
    return this.http.patch<FeatureFlag>(`${this.base}/features/${cle}?actif=${actif}`, {});
  }
}
