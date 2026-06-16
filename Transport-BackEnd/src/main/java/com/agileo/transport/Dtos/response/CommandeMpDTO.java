package com.agileo.transport.Dtos.response;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * Commande (entête ENT Divalto) servant à sélectionner les matières premières.
 * Filtre métier : PICOD = 2, DOS = 1, TICOD = 'F', CE4 = 1.
 * Le numéro de commande (PINO) est ensuite utilisé comme CDNO pour lire les lignes MOUV.
 */
@Data
public class CommandeMpDTO {
    private Long cdno;        // PINO (numéro de commande, = CDNO dans MOUV)
    private String prefixe;   // PREFPINO
    private String projet;    // PROJET (affaire)
    private String marche;    // MARCHE
    private String tiers;     // TIERS (fournisseur)
    private LocalDateTime date; // PIDT
}
