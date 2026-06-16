package com.agileo.transport.Dtos.response;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Trajet GPS d'un voyage : la suite des points enregistrés (du premier scan
 * jusqu'à l'arrivée), avec la durée calculée.
 */
@Data
public class TrajetVoyageResponseDTO {

    private Long voyageId;
    private LocalDateTime debut;       // horodatage du premier point
    private LocalDateTime fin;         // horodatage du dernier point
    private Long dureeMinutes;         // fin - debut, en minutes
    private int nbPoints;
    private List<Point> points;

    @Data
    public static class Point {
        private Double latitude;
        private Double longitude;
        private LocalDateTime horodatage;
    }
}
