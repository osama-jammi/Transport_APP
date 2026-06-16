package com.agileo.transport.service.impl;

import com.agileo.transport.Dtos.request.CamionRequestDTO;
import com.agileo.transport.Dtos.response.CamionResponseDTO;
import com.agileo.transport.entity.Camion;
import com.agileo.transport.repository.CamionRepository;
import com.agileo.transport.service.CamionService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class CamionServiceImpl implements CamionService {

    private final CamionRepository camionRepository;

    @Override
    @Transactional(readOnly = true)
    public List<CamionResponseDTO> getAll() {
        return camionRepository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public CamionResponseDTO getById(Long id) {
        return toDTO(findById(id));
    }

    @Override
    public CamionResponseDTO create(CamionRequestDTO dto) {
        Camion camion = Camion.builder()
                .immatriculation(dto.getImmatriculation())
                .device(dto.getDevice())
                .type(dto.getType())
                .marque(dto.getMarque())
                .build();
        affecterChauffeur(camion, dto.getChauffeurId(), dto.getChauffeurNom(), null);
        return toDTO(camionRepository.save(camion));
    }

    @Override
    public CamionResponseDTO update(Long id, CamionRequestDTO dto) {
        Camion camion = findById(id);
        camion.setImmatriculation(dto.getImmatriculation());
        camion.setDevice(dto.getDevice());
        camion.setType(dto.getType());
        camion.setMarque(dto.getMarque());
        affecterChauffeur(camion, dto.getChauffeurId(), dto.getChauffeurNom(), camion.getId());
        return toDTO(camionRepository.save(camion));
    }

    /**
     * Affecte (ou retire) le chauffeur GAP au camion. Un chauffeur ne peut être
     * affecté qu'à un seul camion : on le détache de tout autre camion.
     * L'état découle de l'affectation : OCCUPE si un chauffeur est affecté, sinon LIBRE.
     */
    private void affecterChauffeur(Camion camion, Long chauffeurId, String chauffeurNom, Long camionCourantId) {
        if (chauffeurId != null) {
            camionRepository.findByChauffeurId(chauffeurId).ifPresent(autre -> {
                if (camionCourantId == null || !autre.getId().equals(camionCourantId)) {
                    autre.setChauffeurId(null);
                    autre.setChauffeurNom(null);
                    autre.setEtat(Camion.EtatCamion.LIBRE);
                    camionRepository.save(autre);
                }
            });
            camion.setChauffeurId(chauffeurId);
            camion.setChauffeurNom(chauffeurNom);
            camion.setEtat(Camion.EtatCamion.OCCUPE);
        } else {
            camion.setChauffeurId(null);
            camion.setChauffeurNom(null);
            camion.setEtat(Camion.EtatCamion.LIBRE);
        }
    }

    @Override
    public void delete(Long id) {
        camionRepository.deleteById(id);
    }

    private Camion findById(Long id) {
        return camionRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Camion introuvable : " + id));
    }

    private CamionResponseDTO toDTO(Camion c) {
        CamionResponseDTO dto = new CamionResponseDTO();
        dto.setId(c.getId());
        dto.setImmatriculation(c.getImmatriculation());
        dto.setDevice(c.getDevice());
        dto.setType(c.getType());
        dto.setMarque(c.getMarque());
        dto.setEtat(c.getEtat());
        dto.setChauffeurId(c.getChauffeurId());
        dto.setChauffeurNom(c.getChauffeurNom());
        return dto;
    }
}
