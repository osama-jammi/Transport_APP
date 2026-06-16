package com.agileo.transport.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "transporteur")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transporteur {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String nom;

    @Column(length = 100)
    private String contact;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
