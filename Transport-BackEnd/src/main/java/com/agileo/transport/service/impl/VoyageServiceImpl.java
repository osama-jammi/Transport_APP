package com.agileo.transport.service.impl;

import com.agileo.transport.Dtos.request.VoyageRequestDTO;
import com.agileo.transport.Dtos.response.ArriveeResponseDTO;
import com.agileo.transport.Dtos.response.VoyageResponseDTO;
import com.agileo.transport.entity.*;
import com.agileo.transport.repository.*;
import com.agileo.transport.service.VoyageService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class VoyageServiceImpl implements VoyageService {

    private final VoyageRepository voyageRepository;
    private final CamionRepository camionRepository;
    private final TransporteurRepository transporteurRepository;
    private final ColisRepository colisRepository;
    private final ChantierRepository chantierRepository;
    private final ArticleRepository articleRepository;
    private final com.agileo.transport.service.PushNotificationService pushService;

    /** Code de forçage d'arrivée fourni par l'administration. */
    @Value("${app.arrivee.force-code:AGILEO2026}")
    private String forceCodeAdmin;

    /** Répertoire de stockage des bons de livraison. */
    @Value("${app.upload.directory:uploads/}")
    private String uploadDir;

    @Override
    @Transactional(readOnly = true)
    public List<VoyageResponseDTO> getAllEnCours(Long chauffeurId) {
        return voyageRepository.findByStatut(Voyage.StatutVoyage.EN_COURS)
                .stream()
                .filter(v -> chauffeurId == null
                        || (v.getCamion() != null
                            && chauffeurId.equals(v.getCamion().getChauffeurId())))
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<VoyageResponseDTO> getArchivesBetween(LocalDateTime debut, LocalDateTime fin) {
        return voyageRepository.findArchivesBetween(debut, fin)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public VoyageResponseDTO getById(Long id) {
        return toDTO(findById(id));
    }

    @Override
    public VoyageResponseDTO create(VoyageRequestDTO dto) {
        // Résoudre le camion : soit directement par camionId, soit via le chauffeur sélectionné.
        // Chaque chauffeur est associé à un camion, donc choisir le chauffeur suffit.
        Camion camion;
        if (dto.getCamionId() != null) {
            camion = camionRepository.findById(dto.getCamionId())
                    .orElseThrow(() -> new EntityNotFoundException("Camion introuvable : " + dto.getCamionId()));
        } else if (dto.getChauffeurId() != null) {
            camion = camionRepository.findByChauffeurId(dto.getChauffeurId())
                    .orElseThrow(() -> new EntityNotFoundException(
                            "Aucun camion n'est affecté au chauffeur " + dto.getChauffeurId()));
        } else {
            throw new EntityNotFoundException("Veuillez sélectionner un chauffeur (ou un camion).");
        }

        // Transporteur : auto-sélection si non fourni
        Transporteur transporteur;
        if (dto.getTransporteurId() != null) {
            transporteur = transporteurRepository.findById(dto.getTransporteurId())
                    .orElseThrow(() -> new EntityNotFoundException("Transporteur introuvable : " + dto.getTransporteurId()));
        } else {
            transporteur = transporteurRepository.findAll().stream().findFirst()
                    .orElseThrow(() -> new EntityNotFoundException("Aucun transporteur disponible"));
        }

        // Client : depuis chantierId ou texte libre
        String clientNom = dto.getClient();
        Chantier chantier = null;
        if (dto.getChantierId() != null) {
            chantier = chantierRepository.findById(dto.getChantierId())
                    .orElseThrow(() -> new EntityNotFoundException("Chantier introuvable : " + dto.getChantierId()));
            clientNom = chantier.getNom();
        }

        Voyage voyage = Voyage.builder()
                .dateCreation(LocalDateTime.now())
                .camion(camion)
                .transporteur(transporteur)
                .chantier(chantier)
                .forceCode(genererForceCode())
                .client(clientNom)
                .chargementJour(dto.getChargementJour())
                .chargementHeure(dto.getChargementHeure())
                .dechargementJour(dto.getDechargementJour())
                .dechargementHeure(dto.getDechargementHeure())
                .statut(Voyage.StatutVoyage.EN_COURS)
                .build();

        camion.setEtat(Camion.EtatCamion.OCCUPE);
        camionRepository.save(camion);

        Voyage saved = voyageRepository.save(voyage);

        // Rattacher les articles sélectionnés à un nouveau colis
        if (dto.getArticleIds() != null && !dto.getArticleIds().isEmpty()) {
            Colis colis = Colis.builder()
                    .voyage(saved)
                    .etat(Colis.EtatColis.PREPARE)
                    .nbArticles(dto.getArticleIds().size())
                    .build();
            colis = colisRepository.save(colis);

            final Colis finalColis = colis;
            for (Long artId : dto.getArticleIds()) {
                articleRepository.findById(artId).ifPresent(art -> {
                    art.setColis(finalColis);
                    art.setStatutScan(Article.StatutScan.NON_SCANNE);
                    articleRepository.save(art);
                });
            }
        }

        return toDTO(saved);
    }

    @Override
    public VoyageResponseDTO update(Long id, VoyageRequestDTO dto) {
        Voyage voyage = findById(id);
        voyage.setClient(dto.getClient());
        voyage.setChargementJour(dto.getChargementJour());
        voyage.setChargementHeure(dto.getChargementHeure());
        voyage.setDechargementJour(dto.getDechargementJour());
        voyage.setDechargementHeure(dto.getDechargementHeure());
        return toDTO(voyageRepository.save(voyage));
    }

    @Override
    public void archiver(Long id) {
        Voyage voyage = findById(id);
        voyage.setStatut(Voyage.StatutVoyage.ARCHIVE);
        if (voyage.getCamion() != null) {
            voyage.getCamion().setEtat(Camion.EtatCamion.LIBRE);
            camionRepository.save(voyage.getCamion());
        }
        voyageRepository.save(voyage);
    }

    @Override
    public void supprimer(Long id) {
        Voyage voyage = findById(id);
        voyage.setStatut(Voyage.StatutVoyage.SUPPRIME);
        voyageRepository.save(voyage);
    }

    @Override
    public ArriveeResponseDTO confirmerArrivee(Long voyageId, Double latitude, Double longitude,
                                               boolean force, String forceCode) {
        Voyage voyage = findById(voyageId);
        Chantier chantier = destinationDe(voyage);

        String saisi = forceCode != null ? forceCode.trim() : "";
        boolean codeOk = force && !saisi.isEmpty()
                && (saisi.equalsIgnoreCase(forceCodeAdmin)
                    || (voyage.getForceCode() != null && saisi.equalsIgnoreCase(voyage.getForceCode())));

        // Pas de destination géolocalisée → seul le code de forçage permet de valider
        boolean destinationGeolocalisee = chantier != null
                && chantier.getLatitude() != null && chantier.getLongitude() != null;

        Integer rayon = chantier != null && chantier.getRayonMetres() != null
                ? chantier.getRayonMetres() : 100;

        Integer distance = null;
        boolean dansZone = false;
        if (destinationGeolocalisee && latitude != null && longitude != null) {
            double d = distanceMetres(latitude, longitude, chantier.getLatitude(), chantier.getLongitude());
            distance = (int) Math.round(d);
            dansZone = d <= rayon;
        }

        if (dansZone || codeOk) {
            voyage.setArriveeEffectiveDechargement(LocalDateTime.now());
            voyageRepository.save(voyage);
            return new ArriveeResponseDTO(true, distance, rayon, false,
                    codeOk && !dansZone ? "Arrivée forcée validée par code." : "Arrivée confirmée sur le chantier.");
        }

        String msg = !destinationGeolocalisee
                ? "Chantier non géolocalisé : saisissez le code de forçage de l'administration."
                : "Vous êtes hors de la zone du chantier (" + distance + " m > " + rayon
                  + " m). Saisissez le code de forçage si nécessaire.";
        return new ArriveeResponseDTO(false, distance, rayon, true, msg);
    }

    @Override
    public VoyageResponseDTO enregistrerBL(Long voyageId,
                                           org.springframework.web.multipart.MultipartFile fichier,
                                           String reference) {
        Voyage voyage = findById(voyageId);
        if (reference != null && !reference.isBlank()) {
            voyage.setBl(reference.trim());
        }
        if (fichier != null && !fichier.isEmpty()) {
            try {
                java.nio.file.Path dir = java.nio.file.Paths.get(uploadDir, "bl");
                java.nio.file.Files.createDirectories(dir);
                String ct = fichier.getContentType();
                String ext = ct != null && ct.contains("pdf") ? ".pdf"
                        : ct != null && ct.contains("png") ? ".png" : ".jpg";
                String nom = "bl-voyage-" + voyageId + "-" + System.currentTimeMillis() + ext;
                java.nio.file.Files.write(dir.resolve(nom), fichier.getBytes());
                voyage.setBlFichier(nom);
                voyage.setBlContentType(ct != null ? ct : "image/jpeg");
            } catch (java.io.IOException e) {
                throw new RuntimeException("Échec de l'enregistrement du bon de livraison", e);
            }
        }
        // Voyage livré
        voyage.setEtatDechargement(Voyage.EtatChargement.TERMINE);
        voyage.setArriveeEffectiveDechargement(
                voyage.getArriveeEffectiveDechargement() != null
                        ? voyage.getArriveeEffectiveDechargement() : LocalDateTime.now());
        return toDTO(voyageRepository.save(voyage));
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] getBLBytes(Long voyageId) {
        Voyage voyage = findById(voyageId);
        if (voyage.getBlFichier() == null) {
            throw new EntityNotFoundException("Aucun bon de livraison pour le voyage " + voyageId);
        }
        try {
            return java.nio.file.Files.readAllBytes(
                    java.nio.file.Paths.get(uploadDir, "bl", voyage.getBlFichier()));
        } catch (java.io.IOException e) {
            throw new RuntimeException("Fichier BL introuvable", e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public String getBLContentType(Long voyageId) {
        Voyage voyage = findById(voyageId);
        return voyage.getBlContentType() != null ? voyage.getBlContentType() : "application/octet-stream";
    }

    @Override
    public VoyageResponseDTO regenererForceCode(Long voyageId) {
        Voyage voyage = findById(voyageId);
        voyage.setForceCode(genererForceCode());
        return toDTO(voyageRepository.save(voyage));
    }

    /** Génère un code de forçage court (6 caractères) facile à communiquer. */
    private String genererForceCode() {
        return java.util.UUID.randomUUID().toString().replace("-", "")
                .substring(0, 6).toUpperCase();
    }

    /** Distance Haversine en mètres entre deux points GPS. */
    private double distanceMetres(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6371000;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /**
     * Destination du voyage : le chantier rattaché si géolocalisé, sinon
     * (fallback) le chantier de destination du premier article géolocalisé.
     */
    private Chantier destinationDe(Voyage v) {
        Chantier ch = v.getChantier();
        if (ch != null && ch.getLatitude() != null && ch.getLongitude() != null) return ch;
        Chantier fromArticles = articleRepository.findByColis_VoyageId(v.getId()).stream()
                .map(Article::getChantierDestination)
                .filter(c -> c != null && c.getLatitude() != null && c.getLongitude() != null)
                .findFirst().orElse(null);
        return fromArticles != null ? fromArticles : ch;
    }

    private Voyage findById(Long id) {
        return voyageRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Voyage introuvable : " + id));
    }

    private VoyageResponseDTO toDTO(Voyage v) {
        VoyageResponseDTO dto = new VoyageResponseDTO();
        dto.setId(v.getId());
        dto.setDateCreation(v.getDateCreation());
        if (v.getTransporteur() != null) {
            dto.setTransporteurId(v.getTransporteur().getId());
            dto.setTransporteur(v.getTransporteur().getNom());
        }
        if (v.getCamion() != null) {
            dto.setCamionId(v.getCamion().getId());
            dto.setCamionImmatriculation(v.getCamion().getImmatriculation());
            dto.setChauffeurId(v.getCamion().getChauffeurId());
            dto.setChauffeur(v.getCamion().getChauffeurNom());
        }
        dto.setClient(v.getClient());
        dto.setNbColis((int) colisRepository.findByVoyageId(v.getId()).size());
        dto.setNbArticles(articleRepository.findByColis_VoyageId(v.getId()).size());
        dto.setForceCode(v.getForceCode());
        Chantier dest = destinationDe(v);
        if (dest != null) {
            dto.setChantierId(dest.getId());
            dto.setDestinationNom(dest.getNom());
            dto.setDestinationLat(dest.getLatitude());
            dto.setDestinationLng(dest.getLongitude());
            dto.setDestinationRayon(dest.getRayonMetres());
        }
        dto.setEtatChargement(v.getEtatChargement());
        dto.setChargementJour(v.getChargementJour());
        dto.setChargementHeure(v.getChargementHeure());
        dto.setArriveeEffectiveChargement(v.getArriveeEffectiveChargement());
        dto.setEtatDechargement(v.getEtatDechargement());
        dto.setDechargementJour(v.getDechargementJour());
        dto.setDechargementHeure(v.getDechargementHeure());
        dto.setArriveeEffectiveDechargement(v.getArriveeEffectiveDechargement());
        dto.setBl(v.getBl());
        dto.setHasBl(v.getBlFichier() != null);
        dto.setDerniereConnexion(v.getDerniereConnexion());
        dto.setStatut(v.getStatut());
        return dto;
    }
}
