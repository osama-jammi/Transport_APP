package com.agileo.transport.Dtos.response;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * Chauffeur lu directement depuis la base GAP (ERP), table dbo.chauffeur.
 * Lecture seule.
 */
@Data
public class GapChauffeurDTO {
    private Long id;
    private String nom;
    private String prenom;
    private Integer matricule;
    /** Dernière connexion de l'app mobile (renseignée lors du scan QR chauffeur). */
    private LocalDateTime derniereConnexion;
    /** Compte actif : si false, le chauffeur ne peut pas se connecter à l'app mobile. */
    private Boolean actif;
}
