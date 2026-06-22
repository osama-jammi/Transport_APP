package com.agileo.transport.Dtos.response;

import lombok.Data;

import java.util.List;

/** Trajet GPS d'un chauffeur sur une période (suivi multi-chauffeurs). */
@Data
public class TrajetChauffeurDTO {
    private Long chauffeurId;
    private String chauffeur;
    private int nbPoints;
    private List<TrajetVoyageResponseDTO.Point> points;
}
