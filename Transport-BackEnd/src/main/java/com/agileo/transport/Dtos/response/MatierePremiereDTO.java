package com.agileo.transport.Dtos.response;

import lombok.Data;

/**
 * Matière première lue depuis Divalto (table MOUV).
 * On n'expose que les champs utiles au transport / à la livraison.
 */
@Data
public class MatierePremiereDTO {
    private Long id;            // MOUV_ID
    private String reference;   // REF
    private String designation; // DES
    private Double quantite;    // QTE1
    private String unite;       // REFUN (à défaut VENUN)
    private String projet;      // PROJET (affaire)
    private String marche;      // MARCHE
    private String tiers;       // TIERS (fournisseur)
    private String devise;      // DEV
    private String of;          // OFNO (ordre de fabrication)
    private Long cdno;          // commande (pour les MP rattachées à un voyage)
    private String pieceFournisseur; // n° pièce fournisseur (entête commande Divalto)
    private Double qteCommande;      // quantité commandée (ligne Divalto d'origine)
    private String statut;           // statut local de clôture : EN_ATTENTE / LIVRE (sans impact ERP)
    private java.time.LocalDateTime dateChargement;
    private java.time.LocalDateTime dateDechargement;
}
