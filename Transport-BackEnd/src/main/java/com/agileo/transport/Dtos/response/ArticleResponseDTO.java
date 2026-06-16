package com.agileo.transport.Dtos.response;

import com.agileo.transport.entity.Article;
import lombok.Data;

@Data
public class ArticleResponseDTO {
    private Long id;
    private Long colisId;
    private String referenceGap;
    private String nom;
    private String chantierDestination;
    private String qrCode;
    private Article.StatutScan statutScan;
}
