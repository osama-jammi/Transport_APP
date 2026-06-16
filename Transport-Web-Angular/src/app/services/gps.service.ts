import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PositionGps } from '../core/models';

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
}
