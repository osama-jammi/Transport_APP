package com.agileo.transport.controller;

import com.agileo.transport.Dtos.request.CamionRequestDTO;
import com.agileo.transport.Dtos.response.CamionResponseDTO;
import com.agileo.transport.service.CamionService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/camions")
@RequiredArgsConstructor
@Tag(name = "Camions", description = "Gestion du parc véhicules")
public class CamionController {

    private final CamionService camionService;

    @GetMapping
    public ResponseEntity<List<CamionResponseDTO>> getAll() {
        return ResponseEntity.ok(camionService.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CamionResponseDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(camionService.getById(id));
    }

    @PostMapping
    public ResponseEntity<CamionResponseDTO> create(@Valid @RequestBody CamionRequestDTO dto) {
        return ResponseEntity.ok(camionService.create(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CamionResponseDTO> update(@PathVariable Long id,
                                                     @Valid @RequestBody CamionRequestDTO dto) {
        return ResponseEntity.ok(camionService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        camionService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
