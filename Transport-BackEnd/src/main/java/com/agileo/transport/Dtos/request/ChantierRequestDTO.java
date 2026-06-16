package com.agileo.transport.Dtos.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ChantierRequestDTO {

    @NotBlank
    private String nom;

    private String lieu;
    private String ville;
    private Double latitude;
    private Double longitude;
    /** Rayon de la zone (geofence) en mètres */
    private Integer rayonMetres;
}
