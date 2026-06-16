package com.agileo.transport.Dtos.response;

import lombok.Data;

/**
 * Article lu directement depuis la base GAP (ERP), table dbo.article.
 * Lecture seule : sert à alimenter l'app de livraison.
 */
@Data
public class GapArticleDTO {
    private Long id;
    private String designation;
    private String unite;
    private Double quantiteTot;
    private Double quantiteProd;
    private Double quantiteEnProd;
    private Double quantiteLivre;
    private Double quantitePose;
    /** Reste à livrer = quantite_tot - quantite_livre */
    private Double quantiteReste;
    private String numPrix;
    private String origineArticle;
    private Long projetId;
    private Long atelierId;
}
