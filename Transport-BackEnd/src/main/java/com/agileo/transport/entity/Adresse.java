package com.agileo.transport.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "adresse")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Adresse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 300)
    private String libelle;

    @Column(length = 100)
    private String ville;

    private Double latitude;
    private Double longitude;
}
