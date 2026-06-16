package com.agileo.transport.Dtos.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ArticleRequestDTO {
    @NotBlank
    private String nom;
    private String referenceGap;
    @NotNull
    private Long chantierDestinationId;
    @NotNull
    private Long voyageId;   // l'article sera ajouté dans un colis de ce voyage
}
