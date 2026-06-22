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
    public ResponseEntity<List<VoyageConteneurDTO>> getAll(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "false") boolean archives,
            @org.springframework.web.bind.annotation.RequestParam(required = false) Long chauffeurId,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "false") boolean tout) {
        return ResponseEntity.ok(gapReadService.getVoyagesConteneurs(archives, chauffeurId, tout));
    }

    @org.springframework.web.bind.annotation.PatchMapping("/{id}/archiver")
    @Operation(summary = "Archiver un voyage")
    public ResponseEntity<Void> archiver(@PathVariable Long id) {
        gapReadService.archiverVoyageConteneur(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    @Operation(summary = "Créer un voyage conteneur (chauffeur + heures) et y rattacher des livraisons")
    public ResponseEntity<Long> create(@RequestBody VoyageConteneurRequestDTO dto) {
        LocalDateTime chargement = combiner(dto.getChargementJour(), dto.getChargementHeure());
        LocalDateTime dechargement = combiner(dto.getDechargementJour(), dto.getDechargementHeure());
        Long id = gapReadService.createVoyageConteneur(dto.getChauffeurId(), chargement, dechargement, "transport-app");
        if (id != null && dto.getLivraisonIds() != null) {
            gapReadService.setLivraisonsDuVoyage(id, dto.getLivraisonIds(), dto.getChauffeurId());
        }
        if (id != null) {
            gapReadService.saveVoyageMatieres(id, dto.getMatieres(), "transport-app");
            gapReadService.applyLivraisonDates(dto.getLivraisonDates());
            gapReadService.updateVoyageLocal(id, dto.getLocalNom(), dto.getLocalLat(), dto.getLocalLng(), dto.getLocalRayon());
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
            gapReadService.setLivraisonsDuVoyage(id, dto.getLivraisonIds(), dto.getChauffeurId());
        }
        gapReadService.saveVoyageMatieres(id, dto.getMatieres(), "transport-app");
        gapReadService.applyLivraisonDates(dto.getLivraisonDates());
        gapReadService.updateVoyageLocal(id, dto.getLocalNom(), dto.getLocalLat(), dto.getLocalLng(), dto.getLocalRayon());
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
        // Inclut l'id du conteneur : l'app mobile remonte le trajet en le taggant
        // directement avec le voyage conteneur (en plus des ids de livraison).
        List<Long> ids = new java.util.ArrayList<>(gapReadService.getLivraisonIdsDuVoyage(id));
        ids.add(id);
        return ResponseEntity.ok(gpsService.getTrajetAgrege(id, ids));
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

    @GetMapping(value = "/livraisons/{livId}/qrcode", produces = MediaType.IMAGE_PNG_VALUE)
    @Operation(summary = "QR code d'une livraison (scanné = scan de toutes ses lignes)")
    public ResponseEntity<byte[]> qrCodeLivraison(@PathVariable Long livId) {
        return ResponseEntity.ok(articleService.generateQrCodeForLivraison(livId));
    }

    @org.springframework.web.bind.annotation.PatchMapping("/livraisons/{livId}/detacher")
    @Operation(summary = "Détacher une livraison du voyage (la livraison n'est pas supprimée)")
    public ResponseEntity<Void> detacher(@PathVariable Long livId) {
        if (gapReadService.isLivraisonScannee(livId)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT,
                    "Livraison déjà scannée : modification impossible.");
        }
        gapReadService.detacherLivraison(livId);
        return ResponseEntity.noContent().build();
    }

    @org.springframework.web.bind.annotation.PatchMapping("/matieres/{mpId}/statut")
    @Operation(summary = "Clôturer / rouvrir une ligne de matière première (statut local, sans impact ERP)")
    public ResponseEntity<Void> statutMatiere(@PathVariable Long mpId,
                                              @org.springframework.web.bind.annotation.RequestParam String statut) {
        gapReadService.updateVoyageMatiereStatut(mpId, statut);
        return ResponseEntity.noContent().build();
    }
}
