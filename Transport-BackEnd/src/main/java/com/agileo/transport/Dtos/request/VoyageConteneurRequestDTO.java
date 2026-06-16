package com.agileo.transport.Dtos.request;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Data
public class VoyageConteneurRequestDTO {
    /** Chauffeur affecté au voyage conteneur. */
    private Long chauffeurId;
    /** Livraisons à rattacher au voyage (remplace la sélection actuelle). */
    private List<Long> livraisonIds;
    private LocalDate chargementJour;
    private LocalTime chargementHeure;
    private LocalDate dechargementJour;
    private LocalTime dechargementHeure;
}
