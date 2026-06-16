package com.agileo.transport.Dtos.response;

import lombok.Data;

@Data
public class ChantierResponseDTO {
    private Long id;
    private String nom;
    private String lieu;
    private String ville;
    private Double latitude;
    private Double longitude;
    private Integer rayonMetres;
    private Boolean actif;
}
