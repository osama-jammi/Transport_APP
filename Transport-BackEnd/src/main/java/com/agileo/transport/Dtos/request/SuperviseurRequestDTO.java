package com.agileo.transport.Dtos.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** Création / modification d'un compte superviseur (gestion côté web admin). */
@Data
public class SuperviseurRequestDTO {
    @NotBlank
    private String username;
    /** Requis à la création ; laisser vide en modification = mot de passe inchangé. */
    private String password;
    private String nom;
    private String prenom;
    private Boolean actif;
}
