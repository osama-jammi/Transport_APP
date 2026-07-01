package com.agileo.transport.Dtos.response;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * Voyage lu directement depuis la base GAP (table livraisons), joint à
 * chauffeur / projet / atelier. Lecture seule.
 */
@Data
public class GapVoyageDTO {
    private Long id;
    private LocalDateTime dateLivraison;
    private LocalDateTime chargement;     // date + heure de chargement
    private LocalDateTime dechargement;   // date + heure de déchargement
    private Long chauffeurId;
    private String chauffeur;          // prénom + nom
    private Long projetId;
    private String projetCode;
    private String projetDesignation;
    private Long atelierId;
    private String atelierDesignation;
    private String statutReception;
    private Boolean imprime;
    private int nbArticles;            // nb de lignes detail_livraison
    private String forceCode;          // code de forçage d'arrivée
    private String bl;                 // référence du bon de livraison
    private String blFichier;          // nom du fichier BL stocké
    private String blContentType;
    private boolean hasBl;             // un BL est enregistré
    // Destination (chantier/projet) pour la navigation / geofence
    private Double destinationLat;
    private Double destinationLng;
    private Integer destinationRayon;
    // Camion résolu depuis la Flotte locale (via le chauffeur)
    private Long camionId;
    private String camionImmatriculation;
    // Voyage conteneur auquel cette livraison est rattachée (null si aucune)
    private Long voyageId;
    // Heure d'arrivée confirmée au chantier (geofence « Je suis sur place » ou code de forçage).
    // Non nulle = l'arrivée a été validée → le scan de livraison est autorisé.
    private LocalDateTime arriveeDechargement;
}
