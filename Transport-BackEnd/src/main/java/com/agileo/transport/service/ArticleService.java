package com.agileo.transport.service;

import com.agileo.transport.Dtos.request.ArticleRequestDTO;
import com.agileo.transport.Dtos.response.ArticleResponseDTO;

import java.util.List;

public interface ArticleService {
    List<ArticleResponseDTO> getAll();
    /** Articles actifs / disponibles (non encore rattachés à un voyage) */
    List<ArticleResponseDTO> getDisponibles();
    List<ArticleResponseDTO> getByVoyage(Long voyageId);
    ArticleResponseDTO create(ArticleRequestDTO dto);
    /** Lecture des articles depuis la base GAP (lecture seule) */
    List<ArticleResponseDTO> importFromGap();
    /** Génère un QR code pour un article */
    byte[] generateQrCode(Long articleId);
    /** Génère un QR code pour une ligne d'article d'un voyage GAP (detail_livraison) */
    byte[] generateQrCodeForDetail(Long detailId);
    /** Génère un QR code pour une ligne de matière première (detail_livraison_mp) */
    byte[] generateQrCodeForMatiere(Long detailMpId);
    /** Scan d'un article au chargement ou à la livraison */
    ArticleResponseDTO scan(String qrCode, String phase);
}
