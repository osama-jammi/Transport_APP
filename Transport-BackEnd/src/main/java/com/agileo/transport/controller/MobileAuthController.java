package com.agileo.transport.controller;

import com.agileo.transport.Dtos.request.MobileLoginDTO;
import com.agileo.transport.Dtos.request.SuperviseurRequestDTO;
import com.agileo.transport.Dtos.response.MobileAuthResponseDTO;
import com.agileo.transport.Dtos.response.SuperviseurDTO;
import com.agileo.transport.service.MobileAuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/mobile")
@RequiredArgsConstructor
@Tag(name = "Auth mobile", description = "Connexion superviseur (mobile) + gestion des comptes (web admin)")
public class MobileAuthController {

    private final MobileAuthService service;

    /** Connexion superviseur depuis l'app mobile — PUBLIC (porte d'entrée). */
    @PostMapping("/auth/login")
    @Operation(summary = "Connexion superviseur (mobile) → renvoie un jeton backend")
    public ResponseEntity<MobileAuthResponseDTO> login(@Valid @RequestBody MobileLoginDTO dto) {
        return ResponseEntity.ok(service.login(dto));
    }

    // ── Gestion des comptes superviseur (réservé au web admin : jeton Keycloak) ──

    @GetMapping("/superviseurs")
    @Operation(summary = "Liste des comptes superviseur (web admin)")
    public ResponseEntity<List<SuperviseurDTO>> lister() {
        return ResponseEntity.ok(service.lister());
    }

    @PostMapping("/superviseurs")
    @Operation(summary = "Créer un compte superviseur (web admin)")
    public ResponseEntity<SuperviseurDTO> creer(@Valid @RequestBody SuperviseurRequestDTO dto) {
        return ResponseEntity.ok(service.creer(dto));
    }

    @PutMapping("/superviseurs/{id}")
    @Operation(summary = "Modifier un compte superviseur (web admin)")
    public ResponseEntity<SuperviseurDTO> modifier(@PathVariable Long id,
                                                   @Valid @RequestBody SuperviseurRequestDTO dto) {
        return ResponseEntity.ok(service.modifier(id, dto));
    }

    @DeleteMapping("/superviseurs/{id}")
    @Operation(summary = "Supprimer un compte superviseur (web admin)")
    public ResponseEntity<Void> supprimer(@PathVariable Long id) {
        service.supprimer(id);
        return ResponseEntity.noContent().build();
    }
}
