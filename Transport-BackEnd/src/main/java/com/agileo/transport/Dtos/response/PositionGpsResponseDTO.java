package com.agileo.transport.Dtos.response;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class PositionGpsResponseDTO {
    private Long id;
    private Long camionId;
    private String immatriculation;
    private String chauffeur;
    private Double latitude;
    private Double longitude;
    private LocalDateTime horodatage;
}
