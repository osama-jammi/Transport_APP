package com.agileo.transport.Dtos.response;

import lombok.Data;

/** Dépôt (local de départ) : nom + géolocalisation + zone. */
@Data
public class DepotDTO {
    private Long id;
    private String nom;
    private Double latitude;
    private Double longitude;
    private Integer rayon;
}
