package com.agileo.transport.service;

import com.agileo.transport.Dtos.request.CamionRequestDTO;
import com.agileo.transport.Dtos.response.CamionResponseDTO;

import java.util.List;

public interface CamionService {
    List<CamionResponseDTO> getAll();
    CamionResponseDTO getById(Long id);
    CamionResponseDTO create(CamionRequestDTO dto);
    CamionResponseDTO update(Long id, CamionRequestDTO dto);
    void delete(Long id);
}
