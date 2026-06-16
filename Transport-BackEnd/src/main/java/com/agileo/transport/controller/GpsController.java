package com.agileo.transport.controller;

import com.agileo.transport.Dtos.request.PositionGpsRequestDTO;
import com.agileo.transport.Dtos.response.PositionGpsResponseDTO;
import com.agileo.transport.Dtos.response.TrajetVoyageResponseDTO;
import com.agileo.transport.service.GpsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/gps")
@RequiredArgsConstructor
@Tag(name = "GPS", description = "Géolocalisation des camions en temps réel")
public class GpsController {

    private final GpsService gpsService;

    @PostMapping("/position")
    @Operation(summary = "Remonter la position d'un camion (appelé par l'app mobile)")
    public ResponseEntity<PositionGpsResponseDTO> savePosition(
            @Valid @RequestBody PositionGpsRequestDTO dto) {
        return ResponseEntity.ok(gpsService.savePosition(dto));
    }

    @GetMapping("/positions")
    @Operation(summary = "Dernières positions de tous les camions")
    public ResponseEntity<List<PositionGpsResponseDTO>> getDernieresPositions() {
        return ResponseEntity.ok(gpsService.getDernieresPositions());
    }

    @GetMapping("/positions/{camionId}")
    @Operation(summary = "Dernière position d'un camion spécifique")
    public ResponseEntity<PositionGpsResponseDTO> getDernierePosition(
            @PathVariable Long camionId) {
        return ResponseEntity.ok(gpsService.getDernierePosition(camionId));
    }

    @GetMapping("/voyage/{voyageId}/trajet")
    @Operation(summary = "Trajet GPS d'un voyage (du 1er scan à l'arrivée) + durée")
    public ResponseEntity<TrajetVoyageResponseDTO> getTrajetVoyage(@PathVariable Long voyageId) {
        return ResponseEntity.ok(gpsService.getTrajetVoyage(voyageId));
    }
}
