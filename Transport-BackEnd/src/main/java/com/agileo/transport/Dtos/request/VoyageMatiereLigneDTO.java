package com.agileo.transport.Dtos.request;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Une ligne de matière première rattachée directement à un voyage (copiée depuis Divalto). */
@Data
public class VoyageMatiereLigneDTO {
    private String projet;        // chantier (code CHxxxx)
    private Long cdno;            // commande Divalto
    private String ref;
    private String designation;
    private String of;            // ordre de fabrication
    private Double quantite;
    private String unite;
    private LocalDate dateLivraison;
    private LocalDateTime dateChargement;
    private LocalDateTime dateDechargement;
}
