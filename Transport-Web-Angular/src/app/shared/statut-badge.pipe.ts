import { Pipe, PipeTransform } from '@angular/core';

/**
 * Renvoie la classe CSS de badge correspondant à un statut, pour colorer
 * uniformément tous les statuts de l'application (voyages, livraisons, MP…) :
 *   • Livré            → vert
 *   • Chargé / scanné  → bleu
 *   • Annulé           → rouge
 *   • En cours         → orange
 *   • Archivé / attente → gris
 *
 * Usage : <span [ngClass]="statut | statutBadge">{{ statut }}</span>
 */
@Pipe({ name: 'statutBadge' })
export class StatutBadgePipe implements PipeTransform {
  transform(statut: string | null | undefined): string {
    const s = (statut || '').toUpperCase().trim();
    switch (s) {
      case 'LIVRE':
      case 'LIVREE':
      case 'SCANNE_LIVRAISON':
        return 'badge badge-green';   // livré → vert
      case 'CHARGE':
      case 'CHARGEE':
      case 'SCANNE_CHARGEMENT':
        return 'badge badge-blue';    // chargé → bleu
      case 'ANNULE':
      case 'ANNULEE':
        return 'badge badge-red';     // annulé → rouge
      case 'EN_COURS':
        return 'badge badge-orange';  // en cours → orange
      case 'ARCHIVE':
      case 'ARCHIVEE':
      case 'EN_ATTENTE':
      case '':
        return 'badge badge-gray';    // archivé / en attente / inconnu → gris
      default:
        return 'badge badge-gray';
    }
  }
}
