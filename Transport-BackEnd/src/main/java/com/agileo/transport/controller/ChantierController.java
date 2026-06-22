package com.agileo.transport.controller;

import com.agileo.transport.Dtos.request.ChantierRequestDTO;
import com.agileo.transport.Dtos.response.ChantierResponseDTO;
import com.agileo.transport.Dtos.response.GapChantierDTO;
import com.agileo.transport.service.ChantierService;
import com.agileo.transport.service.GapReadService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chantiers")
@RequiredArgsConstructor
@Tag(name = "Chantiers", description = "Référentiel des chantiers")
public class ChantierController {

    private final ChantierService chantierService;
    private final GapReadService gapReadService;

    @GetMapping
    public ResponseEntity<List<ChantierResponseDTO>> getAll() {
        return ResponseEntity.ok(chantierService.getAll());
    }

    @GetMapping("/gap")
    @Operation(summary = "Chantiers (projets) lus directement depuis la base GAP (ERP)")
    public ResponseEntity<List<GapChantierDTO>> getFromGap() {
        return ResponseEntity.ok(gapReadService.getChantiers());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ChantierResponseDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(chantierService.getById(id));
    }

    @PostMapping
    public ResponseEntity<ChantierResponseDTO> create(@Valid @RequestBody ChantierRequestDTO dto) {
        return ResponseEntity.ok(chantierService.create(dto));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Affecter une localisation (lat/lng/rayon) à un chantier GAP")
    public ResponseEntity<GapChantierDTO> update(@PathVariable Long id,
                                                  @Valid @RequestBody ChantierRequestDTO dto) {
        gapReadService.updateChantierGeo(id, dto.getLatitude(), dto.getLongitude(), dto.getRayonMetres());
        return ResponseEntity.ok(gapReadService.getChantierById(id));
    }
}
