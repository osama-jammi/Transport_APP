package com.agileo.transport.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "reserve")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Reserve {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "voyage_id", nullable = false)
    private Voyage voyage;

    @Column(length = 1000)
    private String description;

    private LocalDateTime date;
}
