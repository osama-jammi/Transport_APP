package com.agileo.transport.Dtos.response;

import com.agileo.transport.entity.Voyage;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
public class VoyageResponseDTO {
    private Long id;
    private LocalDateTime dateCreation;
    private Long transporteurId;
    private String transporteur;
    private Long camionId;
    private String camionImmatriculation;
    private Long chauffeurId;
    /** Nom complet du chauffeur affecté au camion (prénom + nom) */
    private String chauffeur;
    private String client;
    private int nbColis;
    private int nbArticles;
    // Destination (chantier) pour la navigation / geofence d'arrivée
    private Long chantierId;
    private String destinationNom;
    private Double destinationLat;
    private Double destinationLng;
    private Integer destinationRayon;
    private Voyage.EtatChargement etatChargement;
    private LocalDate chargementJour;
    private LocalTime chargementHeure;
    private LocalDateTime arriveeEffectiveChargement;
    private Voyage.EtatChargement etatDechargement;
    private LocalDate dechargementJour;
    private LocalTime dechargementHeure;
    private LocalDateTime arriveeEffectiveDechargement;
    private String bl;
    private boolean hasBl;
    private String forceCode;
    private LocalDateTime derniereConnexion;
    private Voyage.StatutVoyage statut;
}
