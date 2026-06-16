package com.agileo.transport.Dtos.response;

import com.agileo.transport.entity.Camion;
import lombok.Data;

@Data
public class CamionResponseDTO {
    private Long id;
    private String immatriculation;
    private String device;
    private String type;
    private String marque;
    private Camion.EtatCamion etat;
    private Long chauffeurId;
    private String chauffeurNom;
}
