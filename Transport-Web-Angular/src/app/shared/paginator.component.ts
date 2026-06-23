import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Barre de pagination réutilisable (style PortailRH) : sélecteur « lignes par
 * page », nombre d'éléments, pages numérotées (avec ellipses) + précédent/suivant.
 * Usage : <app-paginator [total]="items.length" [page]="page" [pageSize]="pageSize"
 *           (pageChange)="page=$event" (pageSizeChange)="pageSize=$event; page=1">
 *         </app-paginator>
 */
@Component({
  selector: 'app-paginator',
  template: `
    <div class="paginator" *ngIf="total > 0">
      <div class="pagesize" *ngIf="showPageSize">
        <span class="muted">Lignes par page</span>
        <select [ngModel]="pageSize" (ngModelChange)="changeSize($event)">
          <option *ngFor="let s of pageSizeOptions" [ngValue]="s">{{ s }}</option>
        </select>
      </div>
      <span class="paginator-info muted">{{ total }} élément(s)</span>
      <div class="pages" *ngIf="pages > 1">
        <button class="btn btn-outline btn-sm" (click)="go(page - 1)" [disabled]="page <= 1" aria-label="Précédent">
          <i class="fa-solid fa-chevron-left"></i></button>
        <button *ngFor="let p of pageList"
                class="btn btn-sm" [class.btn-primary]="p === page" [class.btn-outline]="p !== page"
                [disabled]="p === -1" (click)="p !== -1 && go(p)">{{ p === -1 ? '…' : p }}</button>
        <button class="btn btn-outline btn-sm" (click)="go(page + 1)" [disabled]="page >= pages" aria-label="Suivant">
          <i class="fa-solid fa-chevron-right"></i></button>
      </div>
    </div>
  `,
  styles: [`
    .paginator { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:14px; padding:10px 14px; }
    .pagesize { display:flex; align-items:center; gap:8px; margin-right:auto; }
    .pagesize select { padding:4px 8px; border:1px solid var(--border, #d1d5db); border-radius:8px; background:#fff; font-size:13px; }
    .paginator-info { font-size:13px; }
    .pages { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .pages .btn { min-width:34px; }
  `]
})
export class PaginatorComponent {
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = 10;
  @Input() showPageSize = true;
  @Input() pageSizeOptions = [10, 25, 50, 100];
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  get pages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }

  /** Liste des numéros de page à afficher ; -1 = ellipsis. */
  get pageList(): number[] {
    const total = this.pages, cur = this.page;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const out: number[] = [1];
    const start = Math.max(2, cur - 1), end = Math.min(total - 1, cur + 1);
    if (start > 2) out.push(-1);
    for (let p = start; p <= end; p++) out.push(p);
    if (end < total - 1) out.push(-1);
    out.push(total);
    return out;
  }

  go(p: number): void {
    if (p >= 1 && p <= this.pages && p !== this.page) this.pageChange.emit(p);
  }

  changeSize(size: number): void {
    this.pageSizeChange.emit(size);
    this.pageChange.emit(1);
  }
}
