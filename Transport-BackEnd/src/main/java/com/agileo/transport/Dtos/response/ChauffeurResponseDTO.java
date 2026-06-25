package com.agileo.transport.Dtos.response;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ChauffeurResponseDTO {
    private Long id;
    private String nom;
    private String prenom;
    private String telephone;
    private String matricule;
    private String qrCode;
    private LocalDateTime derniereConnexion;
    private Boolean actif;
    /** Compte administrateur/superviseur (accès tableau de bord mobile). */
    private Boolean admin;
    /** Camion affecté au chauffeur (pour la remontée GPS mobile) */
    private Long camionId;
    private String camionImmatriculation;
    /** Jeton d'authentification backend renvoyé après le scan QR (connexion). */
    private String token;
}
