package com.agileo.transport.controller;

import com.agileo.transport.Dtos.request.VoyageConteneurRequestDTO;
import com.agileo.transport.Dtos.response.ArriveeResponseDTO;
import com.agileo.transport.Dtos.response.GapChantierDTO;
import com.agileo.transport.Dtos.response.GapVoyageDTO;
import com.agileo.transport.Dtos.response.VoyageConteneurDTO;
import com.agileo.transport.Dtos.response.TrajetVoyageResponseDTO;
import com.agileo.transport.service.ArticleService;
import com.agileo.transport.service.GapReadService;
import com.agileo.transport.service.GpsService;
import com.agileo.transport.service.RapportService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.MediaType;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
    private final RapportService rapportService;

    /** Code de forçage d'arrivée fourni par l'administration (identique à /api/voyages). */
    @Value("${app.arrivee.force-code:AGILEO2026}")
    private String forceCodeAdmin;

    public VoyageConteneurController(GapReadService gapReadService, GpsService gpsService,
                                     ArticleService articleService, RapportService rapportService) {
        this.gapReadService = gapReadService;
        this.gpsService = gpsService;
        this.articleService = articleService;
        this.rapportService = rapportService;
    }

    @GetMapping
    public ResponseEntity<List<VoyageConteneurDTO>> getAll(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "false") boolean archives,
            @org.springframework.web.bind.annotation.RequestParam(required = false) Long chauffeurId,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "false") boolean tout) {
        return ResponseEntity.ok(gapReadService.getVoyagesConteneurs(archives, chauffeurId, tout));
    }

    @GetMapping("/export")
    @Operation(summary = "Exporter la liste des voyages au format Excel (.xlsx)")
    public ResponseEntity<byte[]> exportExcel(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "false") boolean archives,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "false") boolean tout) {
        byte[] data = rapportService.exportVoyagesConteneurs(archives, tout);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"voyages.xlsx\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
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
        if (gapReadService.isVoyageConteneurAnnule(id)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "Voyage annulé : modification impossible.");
        }
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

    @GetMapping("/livraisons-libres")
    @Operation(summary = "Livraisons libres (non assignées à un voyage)")
    public ResponseEntity<List<GapVoyageDTO>> livraisonsLibres() {
        return ResponseEntity.ok(gapReadService.getLivraisonsLibres());
    }

    @GetMapping("/{id}/livraisons")
    @Operation(summary = "Livraisons rattachées à ce voyage")
    public ResponseEntity<List<GapVoyageDTO>> livraisons(@PathVariable Long id) {
        return ResponseEntity.ok(gapReadService.getLivraisonsDuVoyage(id));
    }

    @PatchMapping("/{id}/force-code")
    @Operation(summary = "Générer le code de forçage du voyage conteneur (commun à toutes ses lignes, MP incluses)")
    public ResponseEntity<java.util.Map<String, String>> regenererForceCode(@PathVariable Long id) {
        if (gapReadService.isVoyageConteneurAnnule(id)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "Voyage annulé : opération impossible.");
        }
        String code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
        gapReadService.updateForceCodeConteneur(id, code);
        return ResponseEntity.ok(java.util.Map.of("forceCode", code));
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

    @GetMapping("/{id}/arrivee")
    @Operation(summary = "Etat d'arrivée sur un chantier sans OF (matières premières / stock seuls)")
    public ResponseEntity<Map<String, Object>> getArriveeChantier(
            @PathVariable Long id,
            @RequestParam String projet) {
        Map<String, Object> body = new HashMap<>();
        body.put("arrivee", gapReadService.getArriveeChantier(id, projet));
        return ResponseEntity.ok(body);
    }

    @PatchMapping("/{id}/arrivee")
    @Operation(summary = "Confirmer l'arrivée sur un chantier sans OF (géofence chantier + code de forçage)")
    public ResponseEntity<ArriveeResponseDTO> confirmerArriveeChantier(
            @PathVariable Long id,
            @RequestParam String projet,
            @RequestParam(required = false) Double latitude,
            @RequestParam(required = false) Double longitude,
            @RequestParam(required = false, defaultValue = "false") boolean force,
            @RequestParam(required = false) String forceCode) {

        if (gapReadService.getArriveeChantier(id, projet) != null) {
            return ResponseEntity.ok(new ArriveeResponseDTO(true, null, null, false, "Arrivée déjà confirmée."));
        }

        GapChantierDTO chantier = gapReadService.getChantierByCode(projet);
        boolean geolocalise = chantier != null && chantier.getLatitude() != null && chantier.getLongitude() != null;
        int rayon = (chantier != null && chantier.getRayonMetres() != null) ? chantier.getRayonMetres() : 100;

        String saisi = forceCode != null ? forceCode.trim() : "";
        boolean codeOk = force && !saisi.isEmpty()
                && (saisi.equalsIgnoreCase(forceCodeAdmin) || gapReadService.isForceCodeConteneur(id, saisi));

        Integer distance = null;
        boolean dansZone = false;
        if (geolocalise && latitude != null && longitude != null) {
            double d = distanceMetres(latitude, longitude, chantier.getLatitude(), chantier.getLongitude());
            distance = (int) Math.round(d);
            dansZone = d <= rayon;
        }

        if (dansZone || codeOk) {
            gapReadService.setArriveeChantier(id, projet, LocalDateTime.now());
            return ResponseEntity.ok(new ArriveeResponseDTO(true, distance, rayon, false,
                    codeOk && !dansZone ? "Arrivée forcée validée par code." : "Arrivée confirmée sur le chantier."));
        }

        String msg = !geolocalise
                ? "Chantier non géolocalisé : saisissez le code de forçage."
                : "Hors zone (" + distance + " m > " + rayon + " m). Saisissez le code de forçage si nécessaire.";
        return ResponseEntity.ok(new ArriveeResponseDTO(false, distance, rayon, true, msg));
    }

    /** Distance Haversine en mètres entre deux points GPS. */
    private static double distanceMetres(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6371000;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
        if (gapReadService.isLivraisonAnnulee(livId)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT,
                    "Livraison annulée : modification impossible.");
        }
        gapReadService.detacherLivraison(livId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/dates")
    @Operation(summary = "Mettre à jour les dates prévu/réel du voyage conteneur")
    public ResponseEntity<Void> mettreAJourDates(
            @PathVariable Long id,
            @RequestParam(required = false) String chargementJour,
            @RequestParam(required = false) String chargementHeure,
            @RequestParam(required = false) String dechargementJour,
            @RequestParam(required = false) String dechargementHeure,
            @RequestParam(required = false) String realChargementJour,
            @RequestParam(required = false) String realChargementHeure,
            @RequestParam(required = false) String realDechargementJour,
            @RequestParam(required = false) String realDechargementHeure) {
        if (gapReadService.isVoyageConteneurAnnule(id)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "Voyage annulé : modification impossible.");
        }
        java.time.LocalDateTime chargement = combinerStr(chargementJour, chargementHeure);
        java.time.LocalDateTime dechargement = combinerStr(dechargementJour, dechargementHeure);
        java.time.LocalDateTime realChargement = combinerStr(realChargementJour, realChargementHeure);
        java.time.LocalDateTime realDechargement = combinerStr(realDechargementJour, realDechargementHeure);
        gapReadService.updateVoyageDatesPrevues(id, chargement, dechargement);
        gapReadService.updateVoyageDatesReelles(id, realChargement, realDechargement);
        return ResponseEntity.noContent().build();
    }

    private static java.time.LocalDateTime combinerStr(String jour, String heure) {
        if (jour == null || jour.isBlank()) return null;
        java.time.LocalDate d = java.time.LocalDate.parse(jour);
        java.time.LocalTime h = (heure != null && !heure.isBlank()) ? java.time.LocalTime.parse(heure) : java.time.LocalTime.MIDNIGHT;
        return d.atTime(h);
    }

    @org.springframework.web.bind.annotation.PatchMapping("/matieres/{mpId}/statut")
    @Operation(summary = "Clôturer / rouvrir une ligne de matière première (statut local, sans impact ERP)")
    public ResponseEntity<Void> statutMatiere(@PathVariable Long mpId,
                                              @org.springframework.web.bind.annotation.RequestParam String statut) {
        gapReadService.updateVoyageMatiereStatut(mpId, statut);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/annuler")
    @Operation(summary = "Annuler un voyage conteneur (impossible si déjà archivé ou annulé)")
    public ResponseEntity<Void> annulerVoyage(@PathVariable Long id) {
        try {
            gapReadService.annulerVoyageConteneur(id);
        } catch (IllegalStateException | IllegalArgumentException e) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, e.getMessage());
        }
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/livraisons/{livraisonId}/annuler")
    @Operation(summary = "Annuler une livraison GAP (impossible si déjà scannée)")
    public ResponseEntity<Void> annulerLivraison(@PathVariable Long livraisonId) {
        try {
            gapReadService.annulerLivraison(livraisonId);
        } catch (IllegalStateException e) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, e.getMessage());
        }
        return ResponseEntity.noContent().build();
    }
}
