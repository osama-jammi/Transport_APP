package com.agileo.transport.Dtos.request;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

@Data
public class VoyageRequestDTO {

    /** Auto-sélectionné si non fourni (premier transporteur actif) */
    private Long transporteurId;

    /**
     * Chauffeur sélectionné dans le formulaire web.
     * Si renseigné, le camion affecté à ce chauffeur est résolu automatiquement.
     */
    private Long chauffeurId;

    /** Camion : optionnel si chauffeurId est fourni (résolu via le chauffeur) */
    private Long camionId;

    /** Texte libre OU rempli depuis chantierId */
    private String client;

    /** Si renseigné, client = chantier.nom */
    private Long chantierId;

    /** IDs des articles à rattacher à ce voyage */
    private List<Long> articleIds;

    /** Quantité à livrer par article (clé = id article). Optionnel : défaut 1 si absent. */
    private Map<Long, Double> articleQuantites;

    /** Type de contenu : ARTICLE (défaut) ou MATIERE_PREMIERE. */
    private String typeLivraison;

    /** Lignes de matières premières (si typeLivraison = MATIERE_PREMIERE). */
    private List<MatiereLigneDTO> matieres;

    private LocalDate chargementJour;
    private LocalTime chargementHeure;
    private LocalDate dechargementJour;
    private LocalTime dechargementHeure;
}
