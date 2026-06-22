import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Barre de pagination réutilisable.
 * Usage : <app-paginator [total]="items.length" [page]="page" [pageSize]="pageSize"
 *                        (pageChange)="page = $event"></app-paginator>
 */
@Component({
  selector: 'app-paginator',
  template: `
    <div class="paginator" *ngIf="total > pageSize">
      <button class="btn btn-outline btn-sm" (click)="go(page - 1)" [disabled]="page <= 1">
        <i class="fa-solid fa-chevron-left"></i></button>
      <span class="paginator-info">
        Page {{ page }} / {{ pages }} <span class="muted">· {{ total }} élément(s)</span>
      </span>
      <button class="btn btn-outline btn-sm" (click)="go(page + 1)" [disabled]="page >= pages">
        <i class="fa-solid fa-chevron-right"></i></button>
    </div>
  `,
  styles: [`
    .paginator { display:flex; align-items:center; justify-content:flex-end; gap:12px; padding:10px 14px; }
    .paginator-info { font-size:13px; color:var(--text-soft); }
  `]
})
export class PaginatorComponent {
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = 10;
  @Output() pageChange = new EventEmitter<number>();

  get pages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }

  go(p: number): void {
    if (p >= 1 && p <= this.pages) this.pageChange.emit(p);
  }
}
