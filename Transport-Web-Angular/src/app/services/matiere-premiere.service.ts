import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CommandeMp, MatierePremiere } from '../core/models';

@Injectable({ providedIn: 'root' })
export class MatierePremiereService {
  private base = `${environment.apiUrl}/matieres-premieres`;
  constructor(private http: HttpClient) {}

  /** Étape 1 : commandes (ENT), filtre optionnel par chantier (code CHxxxx). */
  getCommandes(projet?: string): Observable<CommandeMp[]> {
    let params = new HttpParams();
    if (projet) params = params.set('projet', projet);
    return this.http.get<CommandeMp[]>(`${this.base}/commandes`, { params });
  }

  /** Étape 2 : lignes (MOUV) d'une commande, lecture seule. */
  getLignes(cdno: number): Observable<MatierePremiere[]> {
    return this.http.get<MatierePremiere[]>(`${this.base}/commandes/${cdno}/lignes`);
  }
}
