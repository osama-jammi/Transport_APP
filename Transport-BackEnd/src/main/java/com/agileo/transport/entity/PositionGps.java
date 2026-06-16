package com.agileo.transport.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "position_gps")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PositionGps {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "camion_id")
    private Camion camion;

    /** Voyage (livraison GAP) auquel se rattache ce point de trajet. */
    @Column(name = "voyage_id")
    private Long voyageId;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    @Column(nullable = false)
    private LocalDateTime horodatage;
}
