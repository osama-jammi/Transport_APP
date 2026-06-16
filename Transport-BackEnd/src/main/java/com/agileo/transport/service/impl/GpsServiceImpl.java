package com.agileo.transport.service.impl;

import com.agileo.transport.Dtos.request.PositionGpsRequestDTO;
import com.agileo.transport.Dtos.response.PositionGpsResponseDTO;
import com.agileo.transport.Dtos.response.TrajetVoyageResponseDTO;
import com.agileo.transport.entity.Camion;
import com.agileo.transport.entity.PositionGps;
import com.agileo.transport.repository.CamionRepository;
import com.agileo.transport.repository.PositionGpsRepository;
import com.agileo.transport.service.GpsService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class GpsServiceImpl implements GpsService {

    private final PositionGpsRepository positionGpsRepository;
    private final CamionRepository camionRepository;

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
