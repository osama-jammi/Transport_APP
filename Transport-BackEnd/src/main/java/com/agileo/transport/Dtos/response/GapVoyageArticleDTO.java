package com.agileo.transport.Dtos.response;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * Ligne d'article d'un voyage (livraison) lue depuis GAP : detail_livraison joint à article.
 * Lecture seule.
 */
@Data
public class GapVoyageArticleDTO {
    private Long id;              // id de la ligne detail_livraison
    private Long articleId;       // id de l'article GAP
    private String designation;
    private String numPrix;
    private Double quantite;
    private String statutReception;
    private String projet;
    private LocalDateTime heureScan;   // modifier_le : mis à jour au scan
}
