package com.agileo.transport.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Compte d'authentification de l'app mobile (superviseur / admin), stocké
 * dans la base Transport — totalement indépendant de Keycloak (réservé au web).
 */
@Entity
@Table(name = "utilisateur_mobile")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UtilisateurMobile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String username;

    /** Mot de passe haché en BCrypt (jamais stocké en clair). */
    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(length = 100)
    private String nom;

    @Column(length = 100)
    private String prenom;

    /** Rôle applicatif (ex. SUPERVISEUR, ADMIN). */
    @Column(nullable = false, length = 30)
    private String role;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;

    private LocalDateTime derniereConnexion;
}
