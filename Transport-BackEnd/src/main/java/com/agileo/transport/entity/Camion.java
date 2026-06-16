package com.agileo.transport.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "camion")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Camion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String immatriculation;

    /** Identifiant du dispositif embarqué (device ID) — conservé, optionnel */
    @Column(length = 100)
    private String device;

    /** Type d'outil de transport : VOITURE / CAMION / PICKUP */
    @Column(length = 20)
    private String type;

    /** Marque du véhicule */
    @Column(length = 100)
    private String marque;

    /** LIBRE / OCCUPE */
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private EtatCamion etat = EtatCamion.LIBRE;

    /** Id du chauffeur affecté — id GAP (table chauffeur de GAP), sans clé étrangère locale. */
    @Column(name = "chauffeur_id")
    private Long chauffeurId;

    /** Nom complet du chauffeur (dénormalisé pour l'affichage). */
    @Column(name = "chauffeur_nom", length = 255)
    private String chauffeurNom;

    public enum EtatCamion {
        LIBRE, OCCUPE
    }
}
