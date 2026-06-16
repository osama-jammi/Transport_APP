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
    private LocalDateTime chargement;
    private LocalDateTime dechargement;
}
