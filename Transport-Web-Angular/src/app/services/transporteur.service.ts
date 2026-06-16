import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Transporteur } from '../core/models';

@Injectable({ providedIn: 'root' })
export class TransporteurService {
  private base = `${environment.apiUrl}/transporteurs`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<Transporteur[]> {
    return this.http.get<Transporteur[]>(this.base);
  }
}
