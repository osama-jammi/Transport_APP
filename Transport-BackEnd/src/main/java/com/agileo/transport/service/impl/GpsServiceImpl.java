package com.agileo.transport.service.impl;

import com.agileo.transport.Dtos.request.PositionGpsRequestDTO;
import com.agileo.transport.Dtos.response.PositionGpsResponseDTO;
import com.agileo.transport.Dtos.response.TrajetChauffeurDTO;
import com.agileo.transport.Dtos.response.TrajetVoyageResponseDTO;
import com.agileo.transport.Dtos.response.VoyageChauffeurDTO;
import com.agileo.transport.entity.Camion;
import com.agileo.transport.entity.PositionGps;
import com.agileo.transport.repository.CamionRepository;
import com.agileo.transport.repository.PositionGpsRepository;
import com.agileo.transport.service.GapReadService;
import com.agileo.transport.service.GpsService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class GpsServiceImpl implements GpsService {

    private final PositionGpsRepository positionGpsRepository;
    private final CamionRepository camionRepository;
    private final GapReadService gapReadService;

    @Override
    public PositionGpsResponseDTO savePosition(PositionGpsRequestDTO dto) {
        // Camion optionnel (selon le mode de remontée du mobile)
        Camion camion = dto.getCamionId() != null
                ? camionRepository.findById(dto.getCamionId())
                    .orElseThrow(() -> new EntityNotFoundException("Camion introuvable : " + dto.getCamionId()))
                : null;

        PositionGps pos = PositionGps.builder()
                .camion(camion)
                .voyageId(dto.getVoyageId())
                .chauffeurId(dto.getChauffeurId())
                .latitude(dto.getLatitude())
                .longitude(dto.getLongitude())
                .horodatage(LocalDateTime.now())
                .build();

        return toDTO(positionGpsRepository.save(pos));
    }

    @Override
    @Transactional(readOnly = true)
    public TrajetVoyageResponseDTO getTrajetVoyage(Long voyageId) {
        List<PositionGps> points = positionGpsRepository.findByVoyageIdOrderByHorodatageAsc(voyageId);

        TrajetVoyageResponseDTO dto = new TrajetVoyageResponseDTO();
        dto.setVoyageId(voyageId);
        dto.setNbPoints(points.size());
        dto.setPoints(points.stream().map(p -> {
            TrajetVoyageResponseDTO.Point pt = new TrajetVoyageResponseDTO.Point();
            pt.setLatitude(p.getLatitude());
            pt.setLongitude(p.getLongitude());
            pt.setHorodatage(p.getHorodatage());
            return pt;
        }).collect(Collectors.toList()));

        remplirDureeEtBornes(dto, points);
        return dto;
    }

    @Override
    @Transactional(readOnly = true)
    public TrajetVoyageResponseDTO getTrajetAgrege(Long voyageConteneurId, List<Long> livraisonIds) {
        List<PositionGps> points = (livraisonIds == null || livraisonIds.isEmpty())
                ? java.util.Collections.emptyList()
                : positionGpsRepository.findByVoyageIdInOrderByHorodatageAsc(livraisonIds);
        TrajetVoyageResponseDTO dto = new TrajetVoyageResponseDTO();
        dto.setVoyageId(voyageConteneurId);
        dto.setNbPoints(points.size());
        dto.setPoints(points.stream().map(p -> {
            TrajetVoyageResponseDTO.Point pt = new TrajetVoyageResponseDTO.Point();
            pt.setLatitude(p.getLatitude());
            pt.setLongitude(p.getLongitude());
            pt.setHorodatage(p.getHorodatage());
            return pt;
        }).collect(Collectors.toList()));
        remplirDureeEtBornes(dto, points);
        return dto;
    }

    private void remplirDureeEtBornes(TrajetVoyageResponseDTO dto, List<PositionGps> points) {
        if (!points.isEmpty()) {
            LocalDateTime debut = points.get(0).getHorodatage();
            LocalDateTime fin = points.get(points.size() - 1).getHorodatage();
            dto.setDebut(debut);
            dto.setFin(fin);
            dto.setDureeMinutes(Duration.between(debut, fin).toMinutes());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<PositionGpsResponseDTO> getDernieresPositions() {
        return camionRepository.findAll().stream()
                .map(camion -> positionGpsRepository
                        .findTopByCamionIdOrderByHorodatageDesc(camion.getId())
                        .map(this::toDTO)
                        .orElse(null))
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public PositionGpsResponseDTO getDernierePosition(Long camionId) {
        return positionGpsRepository.findTopByCamionIdOrderByHorodatageDesc(camionId)
                .map(this::toDTO)
                .orElseThrow(() -> new EntityNotFoundException("Aucune position pour le camion : " + camionId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<TrajetChauffeurDTO> getTrajetsParChauffeur(LocalDateTime debut, LocalDateTime fin, Long chauffeurId) {
        List<PositionGps> positions = positionGpsRepository.findByHorodatageBetweenOrderByHorodatageAsc(debut, fin);

        // Map voyageId -> chauffeur (id + nom) lu depuis GAP
        Map<Long, VoyageChauffeurDTO> parVoyage = new java.util.HashMap<>();
        for (VoyageChauffeurDTO vc : gapReadService.getVoyageChauffeurs()) {
            if (vc.getVoyageId() != null) parVoyage.put(vc.getVoyageId(), vc);
        }
        // Map chauffeurId -> nom (tous les chauffeurs GAP), pour le suivi sans voyage
        Map<Long, String> nomParChauffeur = new java.util.HashMap<>();
        gapReadService.getChauffeurs().forEach(c -> nomParChauffeur.put(c.getId(),
                ((c.getPrenom() != null ? c.getPrenom() : "") + " " + (c.getNom() != null ? c.getNom() : "")).trim()));

        // Regroupe les positions par chauffeur (clé = id si connu, sinon nom)
        Map<String, TrajetChauffeurDTO> groupes = new LinkedHashMap<>();
        for (PositionGps p : positions) {
            Long chId = null;
            String chNom = null;
            // 1) chauffeur remonté directement par le mobile (suivi même sans voyage)
            if (p.getChauffeurId() != null) {
                chId = p.getChauffeurId();
                chNom = nomParChauffeur.get(chId);
            }
            // 2) sinon via le voyage rattaché
            if (chId == null && p.getVoyageId() != null) {
                VoyageChauffeurDTO vc = parVoyage.get(p.getVoyageId());
                if (vc != null) { chId = vc.getChauffeurId(); chNom = vc.getChauffeur(); }
            }
            // 3) sinon via le camion
            if (chNom == null && p.getCamion() != null) chNom = p.getCamion().getChauffeurNom();
            if (chNom == null || chNom.isBlank()) chNom = "Non affecté";

            if (chauffeurId != null && (chId == null || !chId.equals(chauffeurId))) continue;

            final Long fChId = chId;
            final String fChNom = chNom;
            String key = chId != null ? ("ID:" + chId) : ("NOM:" + chNom);
            TrajetChauffeurDTO t = groupes.computeIfAbsent(key, k -> {
                TrajetChauffeurDTO dto = new TrajetChauffeurDTO();
                dto.setChauffeurId(fChId);
                dto.setChauffeur(fChNom);
                dto.setPoints(new ArrayList<>());
                return dto;
            });
            TrajetVoyageResponseDTO.Point pt = new TrajetVoyageResponseDTO.Point();
            pt.setLatitude(p.getLatitude());
            pt.setLongitude(p.getLongitude());
            pt.setHorodatage(p.getHorodatage());
            t.getPoints().add(pt);
        }
        groupes.values().forEach(t -> t.setNbPoints(t.getPoints().size()));
        return new ArrayList<>(groupes.values());
    }

    private PositionGpsResponseDTO toDTO(PositionGps p) {
        PositionGpsResponseDTO dto = new PositionGpsResponseDTO();
        dto.setId(p.getId());
        Camion camion = p.getCamion();
        if (camion != null) {
            dto.setCamionId(camion.getId());
            dto.setImmatriculation(camion.getImmatriculation());
            dto.setChauffeur(camion.getChauffeurNom() != null ? camion.getChauffeurNom() : "Non affecté");
        } else {
            dto.setChauffeur("Non affecté");
        }
        dto.setLatitude(p.getLatitude());
        dto.setLongitude(p.getLongitude());
        dto.setHorodatage(p.getHorodatage());
        return dto;
    }
}
