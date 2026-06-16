package com.agileo.transport.Dtos.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PositionGpsRequestDTO {

    /** Camion (optionnel : selon le mode de remontée du mobile). */
    private Long camionId;

    /** Voyage (livraison GAP) en cours — pour rattacher le point au trajet. */
    private Long voyageId;

    @NotNull
    private Double latitude;

    @NotNull
    private Double longitude;
}
