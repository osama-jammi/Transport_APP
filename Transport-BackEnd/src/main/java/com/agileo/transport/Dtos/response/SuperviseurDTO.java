package com.agileo.transport.Dtos.response;

import lombok.Data;

import java.time.LocalDateTime;

/** Vue d'un compte superviseur pour la gestion web (sans le mot de passe). */
@Data
public class SuperviseurDTO {
    private Long id;
    private String username;
    private String nom;
    private String prenom;
    private String role;
    private Boolean actif;
    private LocalDateTime derniereConnexion;
}
