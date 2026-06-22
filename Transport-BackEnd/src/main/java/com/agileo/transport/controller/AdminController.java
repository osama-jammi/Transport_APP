package com.agileo.transport.controller;

import com.agileo.transport.entity.FeatureFlag;
import com.agileo.transport.service.FeatureFlagService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Espace administrateur : activation/désactivation des fonctionnalités.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Tag(name = "Administration", description = "Activation/désactivation des fonctionnalités")
public class AdminController {

    private final FeatureFlagService featureFlagService;

    @GetMapping("/features")
    @Operation(summary = "Liste des fonctionnalités et leur état (activé/désactivé)")
    public ResponseEntity<List<FeatureFlag>> getFeatures() {
        return ResponseEntity.ok(featureFlagService.getAll());
    }

    @PatchMapping("/features/{cle}")
    @Operation(summary = "Activer / désactiver une fonctionnalité")
    public ResponseEntity<FeatureFlag> setFeature(@PathVariable String cle, @RequestParam boolean actif) {
        return ResponseEntity.ok(featureFlagService.setActif(cle, actif));
    }
}
