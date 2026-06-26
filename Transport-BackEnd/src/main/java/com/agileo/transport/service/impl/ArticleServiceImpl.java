package com.agileo.transport.service.impl;

import com.agileo.transport.Dtos.request.ArticleRequestDTO;
import com.agileo.transport.Dtos.response.ArticleResponseDTO;
import com.agileo.transport.entity.Article;
import com.agileo.transport.entity.Chantier;
import com.agileo.transport.entity.Colis;
import com.agileo.transport.entity.Voyage;
import com.agileo.transport.repository.ArticleRepository;
import com.agileo.transport.repository.ChantierRepository;
import com.agileo.transport.repository.ColisRepository;
import com.agileo.transport.repository.VoyageRepository;
import com.agileo.transport.service.ArticleService;
import com.agileo.transport.service.GapReadService;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ArticleServiceImpl implements ArticleService {

    private final ArticleRepository articleRepository;
    private final ChantierRepository chantierRepository;
    private final ColisRepository colisRepository;
    private final VoyageRepository voyageRepository;
    private final GapReadService gapReadService;

    @Override
    @Transactional(readOnly = true)
    public List<ArticleResponseDTO> getAll() {
        return articleRepository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ArticleResponseDTO> getDisponibles() {
        // Article "actif" = pas encore rattaché à un colis/voyage → disponible pour un nouveau voyage
        return articleRepository.findByColisIsNull().stream()
                .map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ArticleResponseDTO> getByVoyage(Long voyageId) {
        return articleRepository.findByColis_VoyageId(voyageId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    public ArticleResponseDTO create(ArticleRequestDTO dto) {
        Voyage voyage = voyageRepository.findById(dto.getVoyageId())
                .orElseThrow(() -> new EntityNotFoundException("Voyage introuvable"));
        Chantier chantier = chantierRepository.findById(dto.getChantierDestinationId())
                .orElseThrow(() -> new EntityNotFoundException("Chantier introuvable"));

        Colis colis = colisRepository.findFirstByVoyageId(voyage.getId())
                .orElseGet(() -> colisRepository.save(
                        Colis.builder().voyage(voyage).build()));

        String qrContent = dto.getNom() + "|" + chantier.getNom() + "|" + UUID.randomUUID();

        Article article = Article.builder()
                .colis(colis)
                .nom(dto.getNom())
                .referenceGap(dto.getReferenceGap())
                .chantierDestination(chantier)
                .qrCode(qrContent)
                .build();

        return toDTO(articleRepository.save(article));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ArticleResponseDTO> importFromGap() {
        return articleRepository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    public byte[] generateQrCode(Long articleId) {
        Article article = articleRepository.findById(articleId)
                .orElseThrow(() -> new EntityNotFoundException("Article introuvable : " + articleId));
        String content = article.getQrCode() != null ? article.getQrCode() : article.getReferenceGap();
        return encodeQr(content);
    }

    @Override
    public byte[] generateQrCodeForDetail(Long detailId) {
        // QR de la ligne de livraison GAP : scanné par le chauffeur au chargement/à la livraison.
        return encodeQr("DETAIL:" + detailId);
    }

    @Override
    public byte[] generateQrCodeForMatiere(Long detailMpId) {
        // QR d'une ligne de matière première (detail_livraison_mp).
        return encodeQr("DETAIL_MP:" + detailMpId);
    }

    @Override
    public byte[] generateQrCodeForVoyage(Long voyageId) {
        // QR du voyage : scanné, il vaut le scan de toutes ses lignes.
        return encodeQr("VOYAGE:" + voyageId);
    }

    @Override
    public byte[] generateQrCodeForLivraison(Long livraisonId) {
        // QR d'une livraison : scanné, il vaut le scan de toutes les lignes de cette livraison.
        return encodeQr("LIVRAISON:" + livraisonId);
    }

    /** Scan d'une livraison entière (QR = "LIVRAISON:{id}") → marque toutes ses lignes. */
    private ArticleResponseDTO scanLivraisonGap(String qrCode, String phase) {
        Long livraisonId;
        try {
            livraisonId = Long.parseLong(qrCode.substring("LIVRAISON:".length()).trim());
        } catch (NumberFormatException e) {
            throw new EntityNotFoundException("QR livraison invalide : " + qrCode);
        }
        boolean chargement = "CHARGEMENT".equalsIgnoreCase(phase);
        int n = gapReadService.scanAllDetailsForLivraison(livraisonId, phase);
        ArticleResponseDTO dto = new ArticleResponseDTO();
        dto.setId(livraisonId);
        dto.setNom("Livraison #" + livraisonId + " — " + n + " ligne(s) scannée(s)");
        dto.setStatutScan(chargement
                ? Article.StatutScan.SCANNE_CHARGEMENT : Article.StatutScan.SCANNE_LIVRAISON);
        return dto;
    }

    /** Scan d'une ligne de livraison GAP (QR = "DETAIL:{id}") → met à jour son statut. */
    private ArticleResponseDTO scanDetailGap(String qrCode, String phase) {
        Long detailId;
        try {
            detailId = Long.parseLong(qrCode.substring("DETAIL:".length()).trim());
        } catch (NumberFormatException e) {
            throw new EntityNotFoundException("QR ligne invalide : " + qrCode);
        }
        boolean chargement = "CHARGEMENT".equalsIgnoreCase(phase);
        gapReadService.updateDetailStatut(detailId,
                chargement ? "SCANNE_CHARGEMENT" : "SCANNE_LIVRAISON");

        ArticleResponseDTO dto = new ArticleResponseDTO();
        dto.setId(detailId);
        dto.setStatutScan(chargement
                ? Article.StatutScan.SCANNE_CHARGEMENT : Article.StatutScan.SCANNE_LIVRAISON);
        return dto;
    }

    /** Scan d'un voyage entier (QR = "VOYAGE:{id}") → marque toutes ses lignes. */
    private ArticleResponseDTO scanVoyageGap(String qrCode, String phase) {
        Long voyageId;
        try {
            voyageId = Long.parseLong(qrCode.substring("VOYAGE:".length()).trim());
        } catch (NumberFormatException e) {
            throw new EntityNotFoundException("QR voyage invalide : " + qrCode);
        }
        boolean chargement = "CHARGEMENT".equalsIgnoreCase(phase);
        int n = gapReadService.scanAllDetailsForVoyage(voyageId, phase);
        ArticleResponseDTO dto = new ArticleResponseDTO();
        dto.setId(voyageId);
        dto.setNom("Voyage #" + voyageId + " — " + n + " ligne(s) scannée(s)");
        dto.setStatutScan(chargement
                ? Article.StatutScan.SCANNE_CHARGEMENT : Article.StatutScan.SCANNE_LIVRAISON);
        return dto;
    }

    @Override
    public ArticleResponseDTO scan(String qrCode, String phase) {
        // QR d'un voyage entier ("VOYAGE:{id}") → scanne toutes ses lignes d'un coup
        if (qrCode != null && qrCode.startsWith("VOYAGE:")) {
            return scanVoyageGap(qrCode, phase);
        }
        // QR d'une livraison entière ("LIVRAISON:{id}") → scanne toutes ses lignes
        if (qrCode != null && qrCode.startsWith("LIVRAISON:")) {
            return scanLivraisonGap(qrCode, phase);
        }
        // QR d'une matière première ("DETAIL_MP:{id}") → clôture la ligne de matière
        if (qrCode != null && qrCode.startsWith("DETAIL_MP:")) {
            Long mpId;
            try {
                mpId = Long.parseLong(qrCode.substring("DETAIL_MP:".length()).trim());
            } catch (NumberFormatException e) {
                throw new EntityNotFoundException("QR matière invalide : " + qrCode);
            }
            gapReadService.updateVoyageMatiereStatut(mpId, "LIVRE");
            ArticleResponseDTO dto = new ArticleResponseDTO();
            dto.setId(mpId);
            dto.setNom("Matière première #" + mpId + " — livrée");
            dto.setStatutScan(Article.StatutScan.SCANNE_LIVRAISON);
            return dto;
        }
        // Nouveau format : QR d'une ligne de livraison GAP ("DETAIL:{id}")
        if (qrCode != null && qrCode.startsWith("DETAIL:")) {
            return scanDetailGap(qrCode, phase);
        }
        Article article = articleRepository.findByQrCode(qrCode)
                .orElseThrow(() -> new EntityNotFoundException("Article QR introuvable : " + qrCode));
        boolean chargement = "CHARGEMENT".equalsIgnoreCase(phase);
        Article.StatutScan nouveau = chargement
                ? Article.StatutScan.SCANNE_CHARGEMENT
                : Article.StatutScan.SCANNE_LIVRAISON;
        article.setStatutScan(nouveau);
        Article saved = articleRepository.save(article);

        // Mettre à jour l'état du voyage : "Chargé" (TERMINE) dès que tous les
        // articles du voyage sont scannés pour cette phase.
        majEtatVoyage(saved, chargement);

        return toDTO(saved);
    }

    /** Recalcule l'état de chargement/déchargement du voyage selon les scans. */
    private void majEtatVoyage(Article article, boolean chargement) {
        if (article.getColis() == null || article.getColis().getVoyage() == null) return;
        Voyage voyage = article.getColis().getVoyage();
        List<Article> tous = articleRepository.findByColis_VoyageId(voyage.getId());
        if (tous.isEmpty()) return;

        Article.StatutScan attendu = chargement
                ? Article.StatutScan.SCANNE_CHARGEMENT
                : Article.StatutScan.SCANNE_LIVRAISON;
        boolean tousFaits = tous.stream().allMatch(a -> a.getStatutScan() == attendu
                || a.getStatutScan() == Article.StatutScan.SCANNE_LIVRAISON);
        boolean auMoinsUn = tous.stream().anyMatch(a -> a.getStatutScan() != Article.StatutScan.NON_SCANNE);

        Voyage.EtatChargement etat = tousFaits
                ? Voyage.EtatChargement.TERMINE
                : (auMoinsUn ? Voyage.EtatChargement.EN_COURS : Voyage.EtatChargement.EN_ATTENTE);

        if (chargement) voyage.setEtatChargement(etat);
        else voyage.setEtatDechargement(etat);
        voyageRepository.save(voyage);
    }

    private byte[] encodeQr(String content) {
        try {
            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix matrix = writer.encode(content, BarcodeFormat.QR_CODE, 300, 300);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Erreur génération QR code", e);
        }
    }

    private ArticleResponseDTO toDTO(Article a) {
        ArticleResponseDTO dto = new ArticleResponseDTO();
        dto.setId(a.getId());
        dto.setColisId(a.getColis() != null ? a.getColis().getId() : null);
        dto.setReferenceGap(a.getReferenceGap());
        dto.setNom(a.getNom());
        dto.setChantierDestination(
                a.getChantierDestination() != null ? a.getChantierDestination().getNom() : null);
        dto.setQrCode(a.getQrCode());
        dto.setStatutScan(a.getStatutScan());
        return dto;
    }
}
