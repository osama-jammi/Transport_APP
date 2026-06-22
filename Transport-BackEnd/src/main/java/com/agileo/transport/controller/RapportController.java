package com.agileo.transport.controller;

import com.agileo.transport.service.RapportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/rapports")
@RequiredArgsConstructor
@Tag(name = "Rapports", description = "Exports Excel des voyages archivés")
public class RapportController {

    private final RapportService rapportService;

    private ResponseEntity<byte[]> excel(byte[] data, String filename) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }

    @GetMapping("/synthese")
    @Operation(summary = "Export Synthèse")
    public ResponseEntity<byte[]> synthese(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime debut,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fin) {
        return excel(rapportService.exportSynthese(debut, fin), "synthese.xlsx");
    }

    @GetMapping("/detaille")
    @Operation(summary = "Export Détaillé")
    public ResponseEntity<byte[]> detaille(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime debut,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fin) {
        return excel(rapportService.exportDetaille(debut, fin), "detaille.xlsx");
    }

    @GetMapping("/reserves")
    @Operation(summary = "Export des Réserves")
    public ResponseEntity<byte[]> reserves(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime debut,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fin) {
        return excel(rapportService.exportReserves(debut, fin), "reserves.xlsx");
    }

    @GetMapping("/non-livres")
    @Operation(summary = "Export voyages non livrés / supprimés")
    public ResponseEntity<byte[]> nonLivres(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime debut,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fin) {
        return excel(rapportService.exportNonLivres(debut, fin), "non-livres.xlsx");
    }

    @GetMapping("/complet")
    @Operation(summary = "Rapport complet « toutes statistiques » (multi-feuilles, depuis GAP)")
    public ResponseEntity<byte[]> complet(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate debut,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fin,
            @RequestParam(required = false) Long chantierId,
            @RequestParam(required = false) Long chauffeurId) {
        return excel(rapportService.exportComplet(debut, fin, chantierId, chauffeurId), "rapport-complet.xlsx");
    }
}
