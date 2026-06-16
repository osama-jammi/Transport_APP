package com.agileo.transport.controller;

import com.agileo.transport.Dtos.request.ChauffeurRequestDTO;
import com.agileo.transport.Dtos.response.ChauffeurResponseDTO;
import com.agileo.transport.Dtos.response.GapChauffeurDTO;
import com.agileo.transport.service.ChauffeurService;
import com.agileo.transport.service.GapReadService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chauffeurs")
@RequiredArgsConstructor
@Tag(name = "Chauffeurs", description = "Gestion des chauffeurs et QR codes")
public class ChauffeurController {

    private final ChauffeurService chauffeurService;
    private final GapReadService gapReadService;

    @GetMapping
    public ResponseEntity<List<ChauffeurResponseDTO>> getAll() {
        return ResponseEntity.ok(chauffeurService.getAll());
    }

    @GetMapping("/gap")
    @Operation(summary = "Liste les chauffeurs lus directement depuis la base GAP (ERP)")
    public ResponseEntity<List<GapChauffeurDTO>> getFromGap() {
        return ResponseEntity.ok(gapReadService.getChauffeurs());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ChauffeurResponseDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(chauffeurService.getById(id));
    }

    @PostMapping
    public ResponseEntity<ChauffeurResponseDTO> create(@Valid @RequestBody ChauffeurRequestDTO dto) {
        return ResponseEntity.ok(chauffeurService.create(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ChauffeurResponseDTO> update(@PathVariable Long id,
                                                        @Valid @RequestBody ChauffeurRequestDTO dto) {
        return ResponseEntity.ok(chauffeurService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        chauffeurService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping(value = "/{id}/qrcode", produces = MediaType.IMAGE_PNG_VALUE)
    @Operation(summary = "Générer le QR code du chauffeur (PNG)")
    public ResponseEntity<byte[]> generateQrCode(@PathVariable Long id) {
        return ResponseEntity.ok(chauffeurService.generateQrCode(id));
    }

    @GetMapping(value = "/gap/{id}/qrcode", produces = MediaType.IMAGE_PNG_VALUE)
    @Operation(summary = "Générer le QR code d'un chauffeur GAP (PNG)")
    public ResponseEntity<byte[]> generateQrCodeGap(@PathVariable Long id) {
        return ResponseEntity.ok(chauffeurService.generateQrCodeGap(id));
    }

    @PostMapping("/connect")
    @Operation(summary = "Appairage mobile via scan du QR code chauffeur")
    public ResponseEntity<ChauffeurResponseDTO> connectByQrCode(@RequestParam String qrCode) {
        return ResponseEntity.ok(chauffeurService.connectByQrCode(qrCode));
    }

    @PatchMapping("/{id}/push-token")
    @Operation(summary = "Enregistrer le jeton de notification push (Expo) du chauffeur")
    public ResponseEntity<ChauffeurResponseDTO> registerPushToken(@PathVariable Long id,
                                                                  @RequestParam String token) {
        return ResponseEntity.ok(chauffeurService.registerPushToken(id, token));
    }
}
