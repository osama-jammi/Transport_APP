package com.agileo.transport.Dtos.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CamionRequestDTO {

    @NotBlank
    private String immatriculation;

    private String device;

    /** Type d'outil de transport : VOITURE / CAMION / PICKUP */
    private String type;

    /** Marque du véhicule */
    private String marque;

    /** Id du chauffeur GAP affecté */
    private Long chauffeurId;

    /** Nom complet du chauffeur GAP (envoyé par le front pour affichage) */
    private String chauffeurNom;
}
