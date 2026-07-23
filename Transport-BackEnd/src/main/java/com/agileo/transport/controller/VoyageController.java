package com.agileo.transport.controller;

import com.agileo.transport.Dtos.request.VoyageRequestDTO;
import com.agileo.transport.Dtos.response.ArticleResponseDTO;
import com.agileo.transport.Dtos.response.ArriveeResponseDTO;
import com.agileo.transport.service.ArticleService;
import com.agileo.transport.service.BonLivraisonService;
import com.agileo.transport.Dtos.response.GapVoyageArticleDTO;
import com.agileo.transport.Dtos.response.GapVoyageDTO;
import com.agileo.transport.Dtos.response.VoyageResponseDTO;
import com.agileo.transport.repository.CamionRepository;
import com.agileo.transport.service.GapReadService;
import com.agileo.transport.service.VoyageService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@RestController
@RequestMapping("/api/voyages")
@RequiredArgsConstructor
@Tag(name = "Voyages", description = "Gestion et suivi des voyages")
public class VoyageController {

    private final VoyageService voyageService;
    private final ArticleService articleService;
    private final GapReadService gapReadService;
    private final CamionRepository camionRepository;
    private final BonLivraisonService bonLivraisonService;

    /** Code de forçage d'arrivée fourni par l'administration. */
    @Value("${app.arrivee.force-code:AGILEO2026}")
    private String forceCodeAdmin;

    /** Répertoire de stockage des bons de livraison. */
    @Value("${app.upload.directory:uploads/}")
    private String uploadDir;

    @GetMapping("/gap")
    @Operation(summary = "Voyages (livraisons) GAP — optionnellement filtrés par chauffeur")
    public ResponseEntity<List<GapVoyageDTO>> getFromGap(
            @RequestParam(required = false) Long chauffeurId) {
        List<GapVoyageDTO> voyages = chauffeurId != null
                ? gapReadService.getVoyagesByChauffeur(chauffeurId)
                : gapReadService.getVoyages();
        voyages.forEach(this::enrichirCamion);
        return ResponseEntity.ok(voyages);
    }

    /** Renseigne le camion (depuis la Flotte locale) à partir du chauffeur du voyage. */
    private GapVoyageDTO enrichirCamion(GapVoyageDTO v) {
        if (v != null && v.getChauffeurId() != null) {
            camionRepository.findByChauffeurId(v.getChauffeurId()).ifPresent(cam -> {
                v.setCamionId(cam.getId());
                v.setCamionImmatriculation(cam.getImmatriculation());
            });
        }
        return v;
    }

    private static String genererForceCode() {
        // Code numérique à 6 chiffres (000000–999999), facile à saisir.
        return String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
    }

    @GetMapping("/en-cours")
    @Operation(summary = "Liste des voyages en cours (optionnellement filtrés par chauffeur)")
    public ResponseEntity<List<VoyageResponseDTO>> getEnCours(
            @RequestParam(required = false) Long chauffeurId) {
        return ResponseEntity.ok(voyageService.getAllEnCours(chauffeurId));
    }

    @GetMapping("/archives")
    @Operation(summary = "Voyages archivés sur une période")
    public ResponseEntity<List<VoyageResponseDTO>> getArchives(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime debut,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fin) {
        return ResponseEntity.ok(voyageService.getArchivesBetween(debut, fin));
    }

    @GetMapping("/{id}")
    public ResponseEntity<VoyageResponseDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(voyageService.getById(id));
    }

    @PostMapping
    @Operation(summary = "Créer un voyage (livraison) directement dans GAP")
    public ResponseEntity<GapVoyageDTO> create(@Valid @RequestBody VoyageRequestDTO dto) {
        LocalDateTime chargement = combiner(dto.getChargementJour(), dto.getChargementHeure());
        LocalDateTime dechargement = combiner(dto.getDechargementJour(), dto.getDechargementHeure());
        // chantierId = id du projet GAP (les chantiers proviennent de la table projet)
        Long livraisonId = gapReadService.createLivraison(
                chargement, dechargement, dto.getChauffeurId(), dto.getChantierId(), null, "transport-app");
        boolean mp = "MATIERE_PREMIERE".equalsIgnoreCase(dto.getTypeLivraison());
        gapReadService.updateTypeLivraison(livraisonId, mp ? "MATIERE_PREMIERE" : "ARTICLE");
        if (mp) {
            gapReadService.addMatiereLines(livraisonId, dto.getMatieres(), "transport-app");
        } else {
            gapReadService.addDetailLines(livraisonId, dto.getArticleIds(), dto.getArticleQuantites(), "transport-app");
        }
        return ResponseEntity.ok(enrichirCamion(gapReadService.getVoyageById(livraisonId)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Modifier un voyage (livraison) dans GAP")
    public ResponseEntity<GapVoyageDTO> update(@PathVariable Long id,
                                               @Valid @RequestBody VoyageRequestDTO dto) {
        if (gapReadService.isLivraisonScannee(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Livraison déjà scannée : modification impossible.");
        }
        if (gapReadService.isLivraisonAnnulee(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Livraison annulée : modification impossible.");
        }
        LocalDateTime chargement = combiner(dto.getChargementJour(), dto.getChargementHeure());
        LocalDateTime dechargement = combiner(dto.getDechargementJour(), dto.getDechargementHeure());
        gapReadService.updateLivraison(id, chargement, dechargement,
                dto.getChauffeurId(), dto.getChantierId(), "transport-app");
        boolean mp = "MATIERE_PREMIERE".equalsIgnoreCase(dto.getTypeLivraison());
        if (dto.getTypeLivraison() != null) {
            gapReadService.updateTypeLivraison(id, mp ? "MATIERE_PREMIERE" : "ARTICLE");
        }
        if (mp) {
            gapReadService.replaceMatiereLines(id, dto.getMatieres(), "transport-app");
        } else if (dto.getArticleIds() != null) {
            gapReadService.replaceDetailLines(id, dto.getArticleIds(), dto.getArticleQuantites(), "transport-app");
        }
        return ResponseEntity.ok(enrichirCamion(gapReadService.getVoyageById(id)));
    }

    @GetMapping("/{id}/matieres")
    @Operation(summary = "Lignes de matières premières d'une livraison")
    public ResponseEntity<List<com.agileo.transport.Dtos.response.MatierePremiereDTO>> matieres(@PathVariable Long id) {
        return ResponseEntity.ok(gapReadService.getMatiereLines(id));
    }

    /** Combine un jour et une heure (heure facultative → minuit) en date-heure. */
    private static LocalDateTime combiner(LocalDate jour, LocalTime heure) {
        if (jour == null) return null;
        return jour.atTime(heure != null ? heure : LocalTime.MIDNIGHT);
    }

    @PatchMapping("/{id}/arrivee")
    @Operation(summary = "Confirmer l'arrivée sur le chantier GAP (geofence + code de forçage)")
    public ResponseEntity<ArriveeResponseDTO> confirmerArrivee(
            @PathVariable Long id,
            @RequestParam(required = false) Double latitude,
            @RequestParam(required = false) Double longitude,
            @RequestParam(required = false, defaultValue = "false") boolean force,
            @RequestParam(required = false) String forceCode) {

        GapVoyageDTO v = gapReadService.getVoyageById(id);
        if (v == null) {
            // Voyage conteneur SANS livraison (matières premières seules) : pas de chantier
            // géolocalisé rattaché à une livraison → on confirme l'arrivée au niveau du
            // conteneur, validée par son code de forçage (ou le code admin global).
            if (gapReadService.isVoyageConteneur(id)) {
                String saisiMp = forceCode != null ? forceCode.trim() : "";
                boolean codeOkMp = force && !saisiMp.isEmpty()
                        && (saisiMp.equalsIgnoreCase(forceCodeAdmin)
                            || gapReadService.isForceCodeConteneur(id, saisiMp));
                if (codeOkMp) {
                    return ResponseEntity.ok(new ArriveeResponseDTO(true, null, null, false,
                            "Arrivée validée par code."));
                }
                return ResponseEntity.ok(new ArriveeResponseDTO(false, null, null, true,
                        "Voyage de matières premières : saisissez le code de forçage de l'administration."));
            }
            return ResponseEntity.ok(new ArriveeResponseDTO(false, null, null, true, "Voyage introuvable."));
        }

        String saisi = forceCode != null ? forceCode.trim() : "";
        // Le code de forçage est commun à TOUT le voyage conteneur : on accepte le code
        // admin global OU le code de n'importe quelle livraison du même voyage. Sinon le
        // code affiché (celui de la 1re ligne) ne validerait que cette ligne-là.
        boolean codeOk = force && !saisi.isEmpty()
                && (saisi.equalsIgnoreCase(forceCodeAdmin)
                    || gapReadService.isForceCodeValidPourVoyage(id, saisi));

        boolean geolocalise = v.getDestinationLat() != null && v.getDestinationLng() != null;
        int rayon = v.getDestinationRayon() != null ? v.getDestinationRayon() : 100;

        Integer distance = null;
        boolean dansZone = false;
        if (geolocalise && latitude != null && longitude != null) {
            double d = distanceMetres(latitude, longitude, v.getDestinationLat(), v.getDestinationLng());
            distance = (int) Math.round(d);
            dansZone = d <= rayon;
        }

        if (dansZone || codeOk) {
            gapReadService.updateArrivee(id, LocalDateTime.now());
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

    @PostMapping(value = "/{id}/bl", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Enregistrer le bon de livraison d'un voyage GAP (photo/scan) → livré")
    public ResponseEntity<GapVoyageDTO> enregistrerBL(
            @PathVariable Long id,
            @RequestParam(value = "fichier", required = false) org.springframework.web.multipart.MultipartFile fichier,
            @RequestParam(value = "reference", required = false) String reference) {
        String fichierNom = null;
        String contentType = null;
        if (fichier != null && !fichier.isEmpty()) {
            try {
                java.nio.file.Path dir = java.nio.file.Paths.get(uploadDir, "bl");
                java.nio.file.Files.createDirectories(dir);
                String ct = fichier.getContentType();
                String ext = ct != null && ct.contains("pdf") ? ".pdf"
                        : ct != null && ct.contains("png") ? ".png" : ".jpg";
                fichierNom = "bl-voyage-" + id + "-" + System.currentTimeMillis() + ext;
                java.nio.file.Files.write(dir.resolve(fichierNom), fichier.getBytes());
                contentType = ct != null ? ct : "image/jpeg";
            } catch (java.io.IOException e) {
                throw new RuntimeException("Échec de l'enregistrement du bon de livraison", e);
            }
        }
        String ref = (reference != null && !reference.isBlank()) ? reference.trim() : null;
        gapReadService.saveBl(id, ref, fichierNom, contentType);
        return ResponseEntity.ok(enrichirCamion(gapReadService.getVoyageById(id)));
    }

    @PostMapping(value = "/{id}/bls", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Ajouter un bon de livraison (plusieurs BL possibles par livraison)")
    public ResponseEntity<Long> ajouterBl(
            @PathVariable Long id,
            @RequestParam(value = "fichier", required = false) org.springframework.web.multipart.MultipartFile fichier,
            @RequestParam(value = "reference", required = false) String reference) {
        String fichierNom = null;
        String contentType = null;
        if (fichier != null && !fichier.isEmpty()) {
            try {
                java.nio.file.Path dir = java.nio.file.Paths.get(uploadDir, "bl");
                java.nio.file.Files.createDirectories(dir);
                String ct = fichier.getContentType();
                String ext = ct != null && ct.contains("pdf") ? ".pdf"
                        : ct != null && ct.contains("png") ? ".png" : ".jpg";
                fichierNom = "bl-voyage-" + id + "-" + System.currentTimeMillis() + ext;
                java.nio.file.Files.write(dir.resolve(fichierNom), fichier.getBytes());
                contentType = ct != null ? ct : "image/jpeg";
            } catch (java.io.IOException e) {
                throw new RuntimeException("Échec de l'enregistrement du bon de livraison", e);
            }
        }
        String ref = (reference != null && !reference.isBlank()) ? reference.trim() : null;
        Long blId = gapReadService.addBlFile(id, ref, fichierNom, contentType);
        return ResponseEntity.ok(blId);
    }

    @GetMapping("/{id}/bls")
    @Operation(summary = "Lister tous les bons de livraison d'une livraison")
    public ResponseEntity<List<com.agileo.transport.Dtos.response.BonLivraisonFileDTO>> listerBls(@PathVariable Long id) {
        return ResponseEntity.ok(gapReadService.listBlFiles(id));
    }

    @GetMapping("/{id}/bls/{blId}")
    @Operation(summary = "Télécharger / afficher un bon de livraison spécifique")
    public ResponseEntity<byte[]> telechargerBlById(@PathVariable Long id, @PathVariable Long blId,
            @RequestParam(value = "dl", defaultValue = "false") boolean dl) {
        com.agileo.transport.Dtos.response.BonLivraisonFileDTO bl = gapReadService.getBlFileById(blId);
        if (bl == null || bl.getFichier() == null) {
            throw new jakarta.persistence.EntityNotFoundException("Bon de livraison introuvable : " + blId);
        }
        try {
            byte[] data = java.nio.file.Files.readAllBytes(
                    java.nio.file.Paths.get(uploadDir, "bl", bl.getFichier()));
            // Extension réelle (le fichier stocké garde .jpg/.png/.pdf) → type MIME fiable.
            String fichier = bl.getFichier();
            String ext = fichier.contains(".") ? fichier.substring(fichier.lastIndexOf('.')) : "";
            String ct = deduireContentTypeBl(bl.getContentType(), ext);
            String disposition = dl ? "attachment" : "inline";
            return ResponseEntity.ok()
                    .header("Content-Disposition", disposition + "; filename=\"bl-" + blId + ext + "\"")
                    .contentType(org.springframework.http.MediaType.parseMediaType(ct))
                    .body(data);
        } catch (java.io.IOException e) {
            throw new RuntimeException("Fichier BL introuvable", e);
        }
    }

    /** Type MIME du BL : valeur stockée si fiable, sinon déduite de l'extension du fichier. */
    private static String deduireContentTypeBl(String stored, String ext) {
        if (stored != null && !stored.isBlank() && !stored.equalsIgnoreCase("application/octet-stream")) {
            return stored;
        }
        String e = ext.toLowerCase();
        if (e.equals(".pdf")) return "application/pdf";
        if (e.equals(".png")) return "image/png";
        if (e.equals(".jpg") || e.equals(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }

    @GetMapping("/{id}/bl")
    @Operation(summary = "Télécharger le bon de livraison du voyage")
    public ResponseEntity<byte[]> telechargerBL(@PathVariable Long id) {
        GapVoyageDTO v = gapReadService.getVoyageById(id);
        if (v == null || v.getBlFichier() == null) {
            throw new jakarta.persistence.EntityNotFoundException("Aucun bon de livraison pour le voyage " + id);
        }
        try {
            byte[] data = java.nio.file.Files.readAllBytes(
                    java.nio.file.Paths.get(uploadDir, "bl", v.getBlFichier()));
            String ct = v.getBlContentType() != null ? v.getBlContentType() : "application/octet-stream";
            return ResponseEntity.ok()
                    .header("Content-Disposition", "attachment; filename=\"bon-livraison-voyage-" + id + "\"")
                    .contentType(org.springframework.http.MediaType.parseMediaType(ct))
                    .body(data);
        } catch (java.io.IOException e) {
            throw new RuntimeException("Fichier BL introuvable", e);
        }
    }

    @GetMapping("/{id}/bl/imprimer")
    @Operation(summary = "Imprimer le bon de livraison (PDF JasperReports) du voyage GAP")
    public ResponseEntity<byte[]> imprimerBL(@PathVariable Long id) {
        byte[] pdf = bonLivraisonService.genererBL(id);
        return ResponseEntity.ok()
                .header("Content-Disposition", "inline; filename=\"bon-livraison-" + id + ".pdf\"")
                .contentType(org.springframework.http.MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @PatchMapping("/{id}/force-code")
    @Operation(summary = "Générer le code de forçage d'arrivée du voyage (GAP)")
    public ResponseEntity<GapVoyageDTO> regenererForceCode(@PathVariable Long id) {
        gapReadService.updateForceCode(id, genererForceCode());
        return ResponseEntity.ok(enrichirCamion(gapReadService.getVoyageById(id)));
    }

    @PostMapping("/{voyageId}/bl-manuel")
    @Operation(summary = "Enregistrer une livraison sans scan (BL saisi manuellement) → livré")
    public ResponseEntity<GapVoyageDTO> blManuel(
            @PathVariable Long voyageId,
            @RequestParam(value = "reference", required = false) String reference) {
        String ref = (reference != null && !reference.isBlank()) ? reference.trim() : null;
        gapReadService.saveBl(voyageId, ref, null, null);
        return ResponseEntity.ok(enrichirCamion(gapReadService.getVoyageById(voyageId)));
    }

    @PatchMapping("/{id}/archiver")
    @Operation(summary = "Archiver un voyage terminé")
    public ResponseEntity<Void> archiver(@PathVariable Long id) {
        voyageService.archiver(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> supprimer(@PathVariable Long id) {
        if (gapReadService.isLivraisonScannee(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Livraison déjà scannée : suppression impossible.");
        }
        voyageService.supprimer(id);
        return ResponseEntity.noContent().build();
    }
    @GetMapping("/{id}/articles")
    @Operation(summary = "Articles d'un voyage, lus depuis GAP (detail_livraison)")
    public ResponseEntity<List<GapVoyageArticleDTO>> getArticles(@PathVariable Long id) {
        return ResponseEntity.ok(gapReadService.getVoyageArticles(id));
    }

    @GetMapping("/stats")
    @Operation(summary = "Indicateurs du tableau de bord administrateur (filtrables chantier / chauffeur / dates)")
    public ResponseEntity<com.agileo.transport.Dtos.response.DashboardStatsDTO> stats(
            @RequestParam(required = false) Long chantierId,
            @RequestParam(required = false) Long chauffeurId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate debut,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fin) {
        return ResponseEntity.ok(gapReadService.getDashboardStats(chantierId, chauffeurId, debut, fin));
    }

}
