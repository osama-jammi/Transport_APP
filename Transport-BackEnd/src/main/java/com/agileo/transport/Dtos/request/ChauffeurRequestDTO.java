package com.agileo.transport.Dtos.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ChauffeurRequestDTO {

    @NotBlank
    private String nom;

    @NotBlank
    private String prenom;

    private String telephone;

    @NotBlank
    private String matricule;
}
