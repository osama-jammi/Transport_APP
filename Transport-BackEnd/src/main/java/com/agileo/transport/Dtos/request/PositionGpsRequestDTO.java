package com.agileo.transport.Dtos.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PositionGpsRequestDTO {

    /** Camion (optionnel : selon le mode de remontée du mobile). */
    private Long camionId;

    /** Voyage (livraison GAP) en cours — pour rattacher le point au trajet. */
    private Long voyageId;

    /** Chauffeur (id GAP) — permet de suivre un chauffeur même sans voyage en cours. */
    private Long chauffeurId;

    @NotNull
    private Double latitude;

    @NotNull
    private Double longitude;
}
