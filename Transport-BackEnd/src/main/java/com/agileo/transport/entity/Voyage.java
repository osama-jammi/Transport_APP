package com.agileo.transport.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "voyage")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Voyage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime dateCreation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transporteur_id")
    private Transporteur transporteur;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "camion_id")
    private Camion camion;

    /** Chantier de destination (pour la navigation et le geofence d'arrivée) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chantier_id")
    private Chantier chantier;

    /** Client / destinataire */
    @Column(length = 200)
    private String client;

    // ── Chargement ──────────────────────────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private EtatChargement etatChargement;

    private LocalDate chargementJour;
    private LocalTime chargementHeure;
    private LocalDateTime arriveeEffectiveChargement;

    // ── Déchargement ────────────────────────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private EtatChargement etatDechargement;

    private LocalDate dechargementJour;
    private LocalTime dechargementHeure;
    private LocalDateTime arriveeEffectiveDechargement;

    /** Référence du bon de livraison */
    @Column(length = 100)
    private String bl;

    /** Nom de fichier du bon de livraison scanné/photographié (stocké sur disque) */
    @Column(length = 255)
    private String blFichier;

    /** Type MIME du fichier BL (image/jpeg, application/pdf…) */
    @Column(length = 100)
    private String blContentType;

    /** Code de forçage d'arrivée (généré par l'administration, communiqué au chauffeur) */
    @Column(length = 20)
    private String forceCode;

    private LocalDateTime derniereConnexion;

    /** EN_COURS / ARCHIVE / SUPPRIME */
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private StatutVoyage statut = StatutVoyage.EN_COURS;

    // ── Enums ────────────────────────────────────────────────────────────────
    public enum EtatChargement {
        EN_ATTENTE, EN_COURS, TERMINE, INCIDENT
    }

    public enum StatutVoyage {
        EN_COURS, ARCHIVE, SUPPRIME
    }
}
