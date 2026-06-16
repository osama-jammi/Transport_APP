package com.agileo.transport.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "article")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Article {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "colis_id", nullable = true)
    private Colis colis;

    /** Référence issue de la base GAP */
    @Column(length = 100)
    private String referenceGap;

    @Column(length = 300)
    private String nom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chantier_destination_id")
    private Chantier chantierDestination;

    /** Valeur encodée dans le QR code de l'article */
    @Column(length = 500)
    private String qrCode;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)   // 'SCANNE_CHARGEMENT' = 17 caractères
    private StatutScan statutScan = StatutScan.NON_SCANNE;

    public enum StatutScan {
        NON_SCANNE, SCANNE_CHARGEMENT, SCANNE_LIVRAISON
    }
}
