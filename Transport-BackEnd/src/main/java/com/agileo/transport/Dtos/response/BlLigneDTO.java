package com.agileo.transport.Dtos.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Une ligne du bon de livraison (table du modèle RICHE BOIS).
 * Champs en String : alimentent directement les champs JasperReports.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BlLigneDTO {
    private String idOf;          // ID OF (origine_article)
    private String numPrix;       // N° de Prix
    private String designation;   // Désignation
    private String repere;        // Repère / Emplacement
    private String quantite;      // Quantité (formatée)
    private String observation;   // Observation
}
