package com.agileo.transport.Dtos.request;

import lombok.Data;

import java.time.LocalDateTime;

/** Dates de chargement/déchargement prévues pour une livraison rattachée à un voyage. */
@Data
public class LivraisonDateDTO {
    private Long id;
    private LocalDateTime chargement;
    private LocalDateTime dechargement;
}
