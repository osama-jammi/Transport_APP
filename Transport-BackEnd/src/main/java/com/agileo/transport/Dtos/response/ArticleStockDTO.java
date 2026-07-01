package com.agileo.transport.Dtos.response;

import lombok.Data;

/**
 * Article disponible en stock, lu depuis la vue {@code Article_en_stock} de DivNet.
 * Lecture seule : sert à proposer un article (et sa quantité disponible) à livrer
 * vers un chantier. La livraison ne modifie jamais le stock dans la base.
 */
@Data
public class ArticleStockDTO {
    /** REF — référence article (ex. A0000309) */
    private String reference;
    /** DES — désignation (ex. CIMENT CPJ 45) */
    private String designation;
    /** ACHUN — unité (ex. SAC) */
    private String unite;
    /** SumStQte — stock disponible dans le dépôt */
    private Double stockDisponible;
    /** DEPO — code du dépôt (ex. RB1) */
    private String depot;

    public ArticleStockDTO() {
    }

    public ArticleStockDTO(String reference, String designation, String unite,
                           Double stockDisponible, String depot) {
        this.reference = reference;
        this.designation = designation;
        this.unite = unite;
        this.stockDisponible = stockDisponible;
        this.depot = depot;
    }
}
