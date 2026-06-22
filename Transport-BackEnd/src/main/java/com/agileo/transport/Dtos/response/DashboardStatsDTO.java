package com.agileo.transport.Dtos.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Indicateurs du tableau de bord administrateur (app mobile).
 * Calculés en lecture seule depuis la base GAP (livraisons / projet / voyage).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DashboardStatsDTO {

    // ── Aujourd'hui ──────────────────────────────────────────────
    private int voyagesAujourdhui;
    private int livresAujourdhui;
    private int enCoursAujourdhui;
    private int enAttenteAujourdhui;
    private int articlesAujourdhui;

    // ── Global ───────────────────────────────────────────────────
    private int voyagesTotal;        // hors archivés
    private int chauffeursActifs;    // chauffeurs avec voyage en cours
    private int chantiersActifs;     // chantiers desservis aujourd'hui
    private Integer dureeMoyenneMinutes; // durée moyenne chargement→livraison (réelle)

    // ── Répartitions ─────────────────────────────────────────────
    private List<ChantierStat> parChantier;  // voyages par chantier (en cours)
    private List<JourStat> parJour;          // voyages par jour (7 derniers jours)

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChantierStat {
        private String chantier;
        private int total;
        private int livres;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class JourStat {
        private String jour;   // yyyy-MM-dd
        private int total;
        private int livres;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChauffeurStat {
        private String chauffeur;     // "Prénom Nom"
        private String matricule;
        private int total;            // livraisons sur la période
        private int livres;
        private int enAttente;
        private int articles;         // lignes detail_livraison sur la période
    }
}
