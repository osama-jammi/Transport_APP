package com.agileo.transport.service.impl;

import com.agileo.transport.Dtos.request.ChantierRequestDTO;
import com.agileo.transport.Dtos.response.ChantierResponseDTO;
import com.agileo.transport.entity.Chantier;
import com.agileo.transport.repository.ChantierRepository;
import com.agileo.transport.service.ChantierService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ChantierServiceImpl implements ChantierService {

    private final ChantierRepository chantierRepository;

    @Override
    @Transactional(readOnly = true)
    public List<ChantierResponseDTO> getAll() {
        return chantierRepository.findByActifTrue()
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ChantierResponseDTO getById(Long id) {
        return toDTO(findById(id));
    }

    @Override
    public ChantierResponseDTO create(ChantierRequestDTO dto) {
        Chantier.ChantierBuilder builder = Chantier.builder()
                .nom(dto.getNom())
                .lieu(dto.getLieu())
                .ville(dto.getVille())
                .latitude(dto.getLatitude())
                .longitude(dto.getLongitude());
        if (dto.getRayonMetres() != null) {
            builder.rayonMetres(dto.getRayonMetres());
        }
        return toDTO(chantierRepository.save(builder.build()));
    }

    @Override
    public ChantierResponseDTO update(Long id, ChantierRequestDTO dto) {
        Chantier chantier = findById(id);
        chantier.setNom(dto.getNom());
        chantier.setLieu(dto.getLieu());
        chantier.setVille(dto.getVille());
        chantier.setLatitude(dto.getLatitude());
        chantier.setLongitude(dto.getLongitude());
        if (dto.getRayonMetres() != null) {
            chantier.setRayonMetres(dto.getRayonMetres());
        }
        return toDTO(chantierRepository.save(chantier));
    }

    @Override
    public void archiver(Long id) {
        Chantier chantier = findById(id);
        chantier.setActif(false);
        chantierRepository.save(chantier);
    }

    private Chantier findById(Long id) {
        return chantierRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Chantier introuvable : " + id));
    }

    private ChantierResponseDTO toDTO(Chantier c) {
        ChantierResponseDTO dto = new ChantierResponseDTO();
        dto.setId(c.getId());
        dto.setNom(c.getNom());
        dto.setLieu(c.getLieu());
        dto.setVille(c.getVille());
        dto.setLatitude(c.getLatitude());
        dto.setLongitude(c.getLongitude());
        dto.setRayonMetres(c.getRayonMetres());
        dto.setActif(c.getActif());
        return dto;
    }
}
