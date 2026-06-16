import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Depot } from '../core/models';

@Injectable({ providedIn: 'root' })
export class DepotService {
  private base = `${environment.apiUrl}/depots`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<Depot[]> { return this.http.get<Depot[]>(this.base); }
  create(d: Depot): Observable<number> { return this.http.post<number>(this.base, d); }
  update(id: number, d: Depot): Observable<void> { return this.http.put<void>(`${this.base}/${id}`, d); }
  delete(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
}
