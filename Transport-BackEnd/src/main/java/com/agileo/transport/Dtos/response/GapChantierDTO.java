package com.agileo.transport.Dtos.response;

import lombok.Data;

/**
 * Chantier (projet) lu directement depuis la base GAP (ERP), table dbo.projet.
 * Lecture seule.
 */
@Data
public class GapChantierDTO {
    private Long id;
    private String code;
    private String designation;
    private Integer status;
    private Double latitude;
    private Double longitude;
    private Integer rayonMetres;
}
