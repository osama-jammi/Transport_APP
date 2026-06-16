package com.agileo.transport.controller;

import com.agileo.transport.entity.Transporteur;
import com.agileo.transport.repository.TransporteurRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/transporteurs")
@RequiredArgsConstructor
@Tag(name = "Transporteurs")
public class TransporteurController {

    private final TransporteurRepository transporteurRepository;

    @GetMapping
    public ResponseEntity<List<Transporteur>> getAll() {
        return ResponseEntity.ok(transporteurRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<Transporteur> create(@RequestBody Transporteur t) {
        t.setId(null);
        return ResponseEntity.ok(transporteurRepository.save(t));
    }
}
