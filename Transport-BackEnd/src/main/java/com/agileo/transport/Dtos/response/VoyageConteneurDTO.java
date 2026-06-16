package com.agileo.transport.Dtos.response;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * Voyage "conteneur" (table GAP voyage) qui regroupe 1..N livraisons.
 * Le chauffeur est affecté à ce niveau.
 */
@Data
public class VoyageConteneurDTO {
    private Long id;
    private LocalDateTime dateVoyage;
    private Long chauffeurId;
    private String chauffeur;       // prénom + nom
    private String statut;
    private String forceCode;
    private int nbLivraisons;       // nb de livraisons rattachées
    private int nbMatieres;         // nb de lignes de matières premières
    private LocalDateTime chargement;       // prévu (admin)
    private LocalDateTime dechargement;     // prévu (admin)
    private LocalDateTime realChargement;   // réel (chauffeur)
    private LocalDateTime realDechargement; // réel (chauffeur)
    private String localNom;
    private Double localLat;
    private Double localLng;
    private Integer localRayon;
}
