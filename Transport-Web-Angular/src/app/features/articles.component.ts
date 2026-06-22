import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { ArticleService } from '../services/article.service';
import { GapArticle } from '../core/models';

@Component({
  selector: 'app-articles',
  template: `
    <div class="toolbar">
      <span class="badge badge-blue"><i class="fa-solid fa-database"></i> Articles lus depuis la base GAP</span>
      <div class="search"><i class="fa-solid fa-magnifying-glass"></i>
        <input [(ngModel)]="q" (ngModelChange)="page=1" placeholder="Rechercher (désignation, n° prix, origine)…"></div>
      <button class="btn btn-outline right" (click)="charger()" [disabled]="loading">
        <i class="fa-solid fa-rotate"></i> Actualiser depuis GAP</button>
    </div>

    <div class="card"><div class="card-body" style="padding:0">
      <div *ngIf="loading" class="spinner"></div>
      <div *ngIf="!loading && filtres().length===0" class="empty">
        <i class="fa-solid fa-boxes-stacked"></i> Aucun article dans la base GAP</div>
      <div class="table-wrap" *ngIf="!loading && filtres().length">
        <table>
          <thead><tr>
            <th>ID</th><th>Désignation</th><th>Unité</th>
            <th>Qté totale</th><th>Qté livrée</th><th>Reste</th>
            <th>N° prix</th><th>Origine</th>
          </tr></thead>
          <tbody>
            <tr *ngFor="let a of filtres() | paginate:page:pageSize">
              <td><code>{{ a.id }}</code></td>
              <td><strong>{{ a.designation || '—' }}</strong></td>
              <td>{{ a.unite || '—' }}</td>
              <td>{{ a.quantiteTot ?? '—' }}</td>
              <td>{{ a.quantiteLivre ?? '—' }}</td>
              <td><span class="badge" [ngClass]="(a.quantiteReste ?? 0) > 0 ? 'badge-orange' : 'badge-green'">{{ a.quantiteReste ?? '—' }}</span></td>
              <td><code>{{ a.numPrix || '—' }}</code></td>
              <td>{{ a.origineArticle || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <app-paginator [total]="filtres().length" [page]="page" [pageSize]="pageSize"
                     (pageChange)="page = $event"></app-paginator>
    </div></div>
  `
})
export class ArticlesComponent implements OnInit {
  articles: GapArticle[] = [];
  loading = false;
  page = 1; pageSize = 10;
  q = '';

  constructor(private svc: ArticleService, private toastr: ToastrService) {}

  ngOnInit(): void { this.charger(); }

  /** Charge les articles depuis la base GAP. */
  charger(): void {
    this.loading = true;
    this.svc.getFromGap().subscribe({
      next: d => { this.articles = d; this.loading = false; },
      error: () => { this.loading = false; this.toastr.error('Impossible de lire la base GAP.'); }
    });
  }

  filtres(): GapArticle[] {
    const t = this.q.toLowerCase().trim();
    if (!t) return this.articles;
    return this.articles.filter(a =>
      `${a.designation} ${a.numPrix} ${a.origineArticle}`.toLowerCase().includes(t));
  }
}
