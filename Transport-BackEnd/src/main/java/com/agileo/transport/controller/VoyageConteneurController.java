package com.agileo.transport.controller;

import com.agileo.transport.Dtos.request.VoyageConteneurRequestDTO;
import com.agileo.transport.Dtos.response.GapVoyageDTO;
import com.agileo.transport.Dtos.response.VoyageConteneurDTO;
import com.agileo.transport.Dtos.response.TrajetVoyageResponseDTO;
import com.agileo.transport.service.ArticleService;
import com.agileo.transport.service.GapReadService;
import com.agileo.transport.service.GpsService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.MediaType;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * Voyage "conteneur" : regroupe 1..N livraisons. Le chauffeur est affecté ici.
 * (Distinct de /api/voyages qui expose les livraisons GAP elles-mêmes.)
 */
@RestController
@RequestMapping("/api/voyages-conteneurs")
@Tag(name = "Voyages (conteneurs)", description = "Voyage regroupant plusieurs livraisons")
public class VoyageConteneurController {

    private final GapReadService gapReadService;
    private final GpsService gpsService;
    private final ArticleService articleService;

    public VoyageConteneurController(GapReadService gapReadService, GpsService gpsService,
                                     ArticleService articleService) {
        this.gapReadService = gapReadService;
        this.gpsService = gpsService;
        this.articleService = articleService;
    }

    @GetMapping
    public ResponseEntity<List<VoyageConteneurDTO>> getAll() {
        return ResponseEntity.ok(gapReadService.getVoyagesConteneurs());
    }

    @PostMapping
    @Operation(summary = "Créer un voyage conteneur (chauffeur + heures) et y rattacher des livraisons")
    public ResponseEntity<Long> create(@RequestBody VoyageConteneurRequestDTO dto) {
        LocalDateTime chargement = combiner(dto.getChargementJour(), dto.getChargementHeure());
        LocalDateTime dechargement = combiner(dto.getDechargementJour(), dto.getDechargementHeure());
        Long id = gapReadService.createVoyageConteneur(dto.getChauffeurId(), chargement, dechargement, "transport-app");
        if (id != null && dto.getLivraisonIds() != null) {
            gapReadService.setLivraisonsDuVoyage(id, dto.getLivraisonIds());
        }
        if (id != null) {
            gapReadService.saveVoyageMatieres(id, dto.getMatieres(), "transport-app");
        }
        return ResponseEntity.ok(id);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Modifier un voyage conteneur (chauffeur + heures + livraisons rattachées)")
    public ResponseEntity<Void> update(@PathVariable Long id,
                                       @RequestBody VoyageConteneurRequestDTO dto) {
        LocalDateTime chargement = combiner(dto.getChargementJour(), dto.getChargementHeure());
        LocalDateTime dechargement = combiner(dto.getDechargementJour(), dto.getDechargementHeure());
        gapReadService.updateVoyageConteneur(id, dto.getChauffeurId(), chargement, dechargement, "transport-app");
        if (dto.getLivraisonIds() != null) {
            gapReadService.setLivraisonsDuVoyage(id, dto.getLivraisonIds());
        }
        gapReadService.saveVoyageMatieres(id, dto.getMatieres(), "transport-app");
        return ResponseEntity.noContent().build();
    }

    private static LocalDateTime combiner(LocalDate jour, LocalTime heure) {
        if (jour == null) return null;
        return jour.atTime(heure != null ? heure : LocalTime.MIDNIGHT);
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/{id}")
    @Operation(summary = "Supprimer un voyage conteneur")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        gapReadService.deleteVoyageConteneur(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/livraisons-assignables")
    @Operation(summary = "Livraisons libres ou déjà rattachées à ce voyage (pour la sélection)")
    public ResponseEntity<List<GapVoyageDTO>> assignables(@PathVariable Long id) {
        return ResponseEntity.ok(gapReadService.getLivraisonsAssignables(id));
    }

    @GetMapping("/{id}/livraisons")
    @Operation(summary = "Livraisons rattachées à ce voyage")
    public ResponseEntity<List<GapVoyageDTO>> livraisons(@PathVariable Long id) {
        return ResponseEntity.ok(gapReadService.getLivraisonsDuVoyage(id));
    }

    @GetMapping("/{id}/trajet")
    @Operation(summary = "Trajet GPS agrégé du voyage (toutes ses livraisons)")
    public ResponseEntity<TrajetVoyageResponseDTO> trajet(@PathVariable Long id) {
        return ResponseEntity.ok(gpsService.getTrajetAgrege(id, gapReadService.getLivraisonIdsDuVoyage(id)));
    }

    @GetMapping("/{id}/matieres")
    @Operation(summary = "Lignes de matières premières rattachées au voyage")
    public ResponseEntity<List<com.agileo.transport.Dtos.response.MatierePremiereDTO>> matieres(@PathVariable Long id) {
        return ResponseEntity.ok(gapReadService.getVoyageMatieres(id));
    }

    @GetMapping(value = "/{id}/qrcode", produces = MediaType.IMAGE_PNG_VALUE)
    @Operation(summary = "QR code du voyage (scanné = scan de toutes ses lignes)")
    public ResponseEntity<byte[]> qrCode(@PathVariable Long id) {
        return ResponseEntity.ok(articleService.generateQrCodeForVoyage(id));
    }
}
