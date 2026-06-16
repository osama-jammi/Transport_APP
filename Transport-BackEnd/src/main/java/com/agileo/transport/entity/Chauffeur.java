package com.agileo.transport.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "chauffeur")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Chauffeur {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String nom;

    @Column(nullable = false, length = 100)
    private String prenom;

    @Column(length = 20)
    private String telephone;

    @Column(unique = true, length = 50)
    private String matricule;

    /** QR code unique (valeur encodée) utilisé pour appairer le chauffeur dans l'app mobile */
    @Column(unique = true, length = 500)
    private String qrCode;

    /** Dernière date/heure de connexion de l'app mobile */
    private LocalDateTime derniereConnexion;

    /** Jeton de notification push Expo du téléphone du chauffeur */
    @Column(length = 255)
    private String pushToken;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
