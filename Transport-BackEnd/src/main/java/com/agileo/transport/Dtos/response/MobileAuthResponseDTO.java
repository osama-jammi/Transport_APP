package com.agileo.transport.Dtos.response;

import lombok.Data;

/** Réponse de connexion superviseur : jeton backend + infos du compte. */
@Data
public class MobileAuthResponseDTO {
    private String token;
    private String role;
    private Long id;
    private String username;
    private String nom;
    private String prenom;
}
