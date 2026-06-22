package com.agileo.transport.Dtos.response;

import lombok.Data;

/** Association voyage conteneur -> chauffeur (pour le suivi des trajets). */
@Data
public class VoyageChauffeurDTO {
    private Long voyageId;
    private Long chauffeurId;
    private String chauffeur;
}
