package com.agileo.transport.controller;

import com.agileo.transport.Dtos.response.DepotDTO;
import com.agileo.transport.service.GapReadService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/depots")
@Tag(name = "Dépôts", description = "Locaux de départ (géolocalisés)")
public class DepotController {

    private final GapReadService gapReadService;

    public DepotController(GapReadService gapReadService) {
        this.gapReadService = gapReadService;
    }

    @GetMapping
    public ResponseEntity<List<DepotDTO>> getAll() {
        return ResponseEntity.ok(gapReadService.getDepots());
    }

    @PostMapping
    public ResponseEntity<Long> create(@RequestBody DepotDTO dto) {
        return ResponseEntity.ok(gapReadService.createDepot(dto.getNom(), dto.getLatitude(), dto.getLongitude(), dto.getRayon()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Void> update(@PathVariable Long id, @RequestBody DepotDTO dto) {
        gapReadService.updateDepot(id, dto.getNom(), dto.getLatitude(), dto.getLongitude(), dto.getRayon());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        gapReadService.deleteDepot(id);
        return ResponseEntity.noContent().build();
    }
}
