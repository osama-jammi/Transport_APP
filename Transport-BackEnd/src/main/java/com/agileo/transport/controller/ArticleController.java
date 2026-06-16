package com.agileo.transport.controller;

import com.agileo.transport.Dtos.request.ArticleRequestDTO;
import com.agileo.transport.Dtos.response.ArticleResponseDTO;
import com.agileo.transport.Dtos.response.GapArticleDTO;
import com.agileo.transport.service.ArticleService;
import com.agileo.transport.service.GapReadService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/articles")
@RequiredArgsConstructor
@Tag(name = "Articles", description = "Gestion des articles et scan")
public class ArticleController {

    private final ArticleService articleService;
    private final GapReadService gapReadService;

    @GetMapping
    @Operation(summary = "Liste tous les articles")
    public ResponseEntity<List<ArticleResponseDTO>> getAll() {
        return ResponseEntity.ok(articleService.getAll());
    }

    @GetMapping("/gap")
    @Operation(summary = "Liste les articles lus directement depuis la base GAP ")
    public ResponseEntity<List<GapArticleDTO>> getFromGap() {
        return ResponseEntity.ok(gapReadService.getArticles());
    }

    @GetMapping("/disponibles")
    @Operation(summary = "Articles actifs / disponibles (non rattachés à un voyage)")
    public ResponseEntity<List<ArticleResponseDTO>> getDisponibles() {
        return ResponseEntity.ok(articleService.getDisponibles());
    }

    @PostMapping
    @Operation(summary = "Créer un article pour un voyage")
    public ResponseEntity<ArticleResponseDTO> create(@Valid @RequestBody ArticleRequestDTO dto) {
        return ResponseEntity.ok(articleService.create(dto));
    }

    @PostMapping("/import-gap")
    @Operation(summary = "Importer les articles depuis la base GAP")
    public ResponseEntity<List<ArticleResponseDTO>> importFromGap() {
        return ResponseEntity.ok(articleService.importFromGap());
    }

    @GetMapping(value = "/{id}/qrcode", produces = MediaType.IMAGE_PNG_VALUE)
    @Operation(summary = "Générer le QR code d'un article (PNG)")
    public ResponseEntity<byte[]> generateQrCode(@PathVariable Long id) {
        return ResponseEntity.ok(articleService.generateQrCode(id));
    }

    @GetMapping(value = "/detail/{id}/qrcode", produces = MediaType.IMAGE_PNG_VALUE)
    @Operation(summary = "QR code d'une ligne d'article d'un voyage GAP (detail_livraison)")
    public ResponseEntity<byte[]> generateQrCodeForDetail(@PathVariable Long id) {
        return ResponseEntity.ok(articleService.generateQrCodeForDetail(id));
    }

    @GetMapping(value = "/matiere/{id}/qrcode", produces = MediaType.IMAGE_PNG_VALUE)
    @Operation(summary = "QR code d'une ligne de matière première (detail_livraison_mp)")
    public ResponseEntity<byte[]> generateQrCodeForMatiere(@PathVariable Long id) {
        return ResponseEntity.ok(articleService.generateQrCodeForMatiere(id));
    }

    @PostMapping("/scan")
    @Operation(summary = "Scanner un article (chargement ou livraison)")
    public ResponseEntity<ArticleResponseDTO> scan(@RequestParam String qrCode,
                                                    @RequestParam String phase) {
        return ResponseEntity.ok(articleService.scan(qrCode, phase));
    }
}
