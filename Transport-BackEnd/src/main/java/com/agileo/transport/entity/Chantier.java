package com.agileo.transport.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "chantier")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Chantier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String nom;

    /** Adresse textuelle / lieu */
    @Column(length = 300)
    private String lieu;

    @Column(length = 100)
    private String ville;

    /** Latitude GPS */
    private Double latitude;

    /** Longitude GPS */
    private Double longitude;

    /** Rayon de la zone du chantier (geofence), en mètres. Défaut 100 m.
     *  Colonne nullable pour permettre l'ajout sur une table existante (ddl-auto=update). */
    @Builder.Default
    private Integer rayonMetres = 100;

    /** Actif / Archivé */
    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
