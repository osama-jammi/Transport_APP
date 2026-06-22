package com.agileo.transport.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Drapeau de fonctionnalité activable/désactivable par l'administrateur.
 * Stocké en base primaire (configuration applicative, hors ERP).
 */
@Entity
@Table(name = "feature_flag")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FeatureFlag {

    /** Clé technique (ex. "tracking", "suivi-trajets"). */
    @Id
    @Column(length = 60)
    private String cle;

    @Column(length = 150)
    private String libelle;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
