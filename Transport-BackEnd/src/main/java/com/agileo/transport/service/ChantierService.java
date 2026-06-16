package com.agileo.transport.service;

import com.agileo.transport.Dtos.request.ChantierRequestDTO;
import com.agileo.transport.Dtos.response.ChantierResponseDTO;

import java.util.List;

public interface ChantierService {
    List<ChantierResponseDTO> getAll();
    ChantierResponseDTO getById(Long id);
    ChantierResponseDTO create(ChantierRequestDTO dto);
    ChantierResponseDTO update(Long id, ChantierRequestDTO dto);
    void archiver(Long id);
}
