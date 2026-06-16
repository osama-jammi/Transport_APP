package com.agileo.transport.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "colis")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Colis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "voyage_id", nullable = false)
    private Voyage voyage;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private EtatColis etat = EtatColis.PREPARE;

    /** Nombre total d'articles dans ce colis */
    private Integer nbArticles;

    public enum EtatColis {
        PREPARE, VALIDE, LIVRE
    }
}
