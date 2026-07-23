package com.agileo.transport.Dtos.response;

import lombok.Data;

@Data
public class BonLivraisonFileDTO {
    private Long id;
    private String reference;
    private String fichier;
    private String contentType;
}
