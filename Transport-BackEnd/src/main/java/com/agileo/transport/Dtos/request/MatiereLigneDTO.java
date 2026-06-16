package com.agileo.transport.Dtos.request;

import lombok.Data;

/** Une ligne de matière première (issue de Divalto) à livrer. */
@Data
public class MatiereLigneDTO {
    private String ref;
    private String designation;
    private Double quantite;
    private String unite;
}
