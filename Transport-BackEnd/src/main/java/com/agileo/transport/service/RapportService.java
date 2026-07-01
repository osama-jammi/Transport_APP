package com.agileo.transport.service;

import java.time.LocalDate;
import java.time.LocalDateTime;

public interface RapportService {
    byte[] exportSynthese(LocalDateTime debut, LocalDateTime fin);
    byte[] exportDetaille(LocalDateTime debut, LocalDateTime fin);
    byte[] exportReserves(LocalDateTime debut, LocalDateTime fin);
    byte[] exportNonLivres(LocalDateTime debut, LocalDateTime fin);

    /**
     * Rapport complet « toutes statistiques » (classeur Excel multi-feuilles) calculé
     * depuis GAP : synthèse / par chauffeur / par chantier / par jour / réserves.
     * Filtrable par chantier et chauffeur ; sans plage de dates → aujourd'hui.
     */
    byte[] exportComplet(LocalDate debut, LocalDate fin, Long chantierId, Long chauffeurId);

    /** Export Excel de la liste des voyages conteneurs (en cours / archivés / tous). */
    byte[] exportVoyagesConteneurs(boolean archives, boolean tout);
}
