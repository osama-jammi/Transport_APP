package com.agileo.transport.controller;

import com.agileo.transport.Dtos.response.CommandeMpDTO;
import com.agileo.transport.Dtos.response.MatierePremiereDTO;
import com.agileo.transport.service.DivaltoReadService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/matieres-premieres")
@Tag(name = "Matières premières", description = "Matières premières lues depuis Divalto (ENT puis MOUV)")
public class MatierePremiereController {

    private final DivaltoReadService divaltoReadService;

    public MatierePremiereController(DivaltoReadService divaltoReadService) {
        this.divaltoReadService = divaltoReadService;
    }

    @GetMapping("/commandes")
    @Operation(summary = "Étape 1 : commandes (ENT) à sélectionner (PICOD=2, DOS=1, TICOD='F', CE4=1)")
    public ResponseEntity<List<CommandeMpDTO>> getCommandes() {
        return ResponseEntity.ok(divaltoReadService.getCommandes());
    }

    @GetMapping("/commandes/{cdno}/lignes")
    @Operation(summary = "Étape 2 : lignes (MOUV) d'une commande par CDNO (DOS=1, TICOD='F', PICOD=2)")
    public ResponseEntity<List<MatierePremiereDTO>> getLignes(@PathVariable Long cdno) {
        return ResponseEntity.ok(divaltoReadService.getMatieresByCommande(cdno));
    }
}
