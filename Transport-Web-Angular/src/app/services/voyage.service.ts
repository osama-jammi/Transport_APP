import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { map } from 'rxjs/operators';
import { Voyage, VoyageRequest, GapVoyage, GapVoyageArticle, TrajetVoyage, MatierePremiere } from '../core/models';

@Injectable({ providedIn: 'root' })
export class VoyageService {
  private base = `${environment.apiUrl}/voyages`;
  constructor(private http: HttpClient) {}

  /** Voyages lus directement depuis la base GAP (livraisons), adaptés au modèle Voyage. */
  getFromGap(): Observable<Voyage[]> {
    return this.http.get<GapVoyage[]>(`${this.base}/gap`).pipe(
      map(list => list.map(g => ({
        id: g.id,
        dateCreation: g.dateLivraison,
        chauffeurId: g.chauffeurId,
        chauffeur: g.chauffeur,
        chantierId: g.projetId,
        client: g.projetDesignation || g.projetCode,
        destinationNom: g.projetDesignation,
        camionId: g.camionId,
        camionImmatriculation: g.camionImmatriculation,
        forceCode: g.forceCode,
        bl: g.bl,
        hasBl: g.hasBl,
        destinationLat: g.destinationLat,
        destinationLng: g.destinationLng,
        destinationRayon: g.destinationRayon,
        chargementJour: g.chargement ? g.chargement.substring(0, 10) : undefined,
        chargementHeure: g.chargement ? g.chargement.substring(11, 16) : undefined,
        dechargementJour: g.dechargement ? g.dechargement.substring(0, 10) : undefined,
        dechargementHeure: g.dechargement ? g.dechargement.substring(11, 16) : undefined,
        nbColis: 0,
        nbArticles: g.nbArticles ?? 0,
        etatChargement: (g.statutReception === 'CHARGE' || g.statutReception === 'LIVRE') ? 'TERMINE' : undefined,
        etatDechargement: g.statutReception === 'LIVRE' ? 'TERMINE' : undefined,
        statut: g.statutReception === 'ARCHIVE' ? 'ARCHIVE' : 'EN_COURS'
      } as Voyage)))
    );
  }

  /** Articles d'un voyage, lus depuis GAP (detail_livraison) */
  articles(id: number): Observable<GapVoyageArticle[]> {
    return this.http.get<GapVoyageArticle[]>(`${this.base}/${id}/articles`);
  }

  /** Matières premières d'une livraison (detail_livraison_mp) */
  matieres(id: number): Observable<MatierePremiere[]> {
    return this.http.get<MatierePremiere[]>(`${this.base}/${id}/matieres`);
  }

  /** Trajet GPS du voyage (du 1er scan à l'arrivée) + durée */
  trajet(id: number): Observable<TrajetVoyage> {
    return this.http.get<TrajetVoyage>(`${environment.apiUrl}/gps/voyage/${id}/trajet`);
  }

  enCours(): Observable<Voyage[]> {
    return this.http.get<Voyage[]>(`${this.base}/en-cours`);
  }
  archives(debut: string, fin: string): Observable<Voyage[]> {
    const params = new HttpParams().set('debut', debut).set('fin', fin);
    return this.http.get<Voyage[]>(`${this.base}/archives`, { params });
  }
  getById(id: number): Observable<Voyage> {
    return this.http.get<Voyage>(`${this.base}/${id}`);
  }
  create(dto: VoyageRequest): Observable<Voyage> {
    return this.http.post<Voyage>(this.base, dto);
  }
  update(id: number, dto: VoyageRequest): Observable<Voyage> {
    return this.http.put<Voyage>(`${this.base}/${id}`, dto);
  }
  regenererForceCode(id: number): Observable<Voyage> {
    return this.http.patch<Voyage>(`${this.base}/${id}/force-code`, {});
  }
  /** Télécharge le bon de livraison (image/pdf) d'un voyage */
  telechargerBL(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/bl`, { responseType: 'blob' });
  }
  archiver(id: number): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/archiver`, {});
  }
  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
