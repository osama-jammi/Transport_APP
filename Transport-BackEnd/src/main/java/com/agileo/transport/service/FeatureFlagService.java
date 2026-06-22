package com.agileo.transport.service;

import com.agileo.transport.entity.FeatureFlag;
import com.agileo.transport.repository.FeatureFlagRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Gestion des fonctionnalités activables/désactivables par l'administrateur.
 * Les fonctionnalités par défaut sont créées au démarrage (idempotent).
 */
@Service
@RequiredArgsConstructor
@Transactional
public class FeatureFlagService {

    private final FeatureFlagRepository repository;

    /** Fonctionnalités par défaut (clé -> libellé), créées si absentes. */
    private static final Map<String, String> DEFAUTS = new LinkedHashMap<>() {{
        // Le suivi GPS est désormais inclus dans « suivi-trajets » (plus de flag « tracking » séparé).
        put("suivi-trajets", "Suivi des trajets (carte + GPS chauffeurs)");
        put("cloture-mp", "Clôture des matières premières");
        put("historique-voyages", "Historique des voyages");
    }};

    /** Fonctionnalités obsolètes à supprimer au démarrage (fusionnées ailleurs). */
    private static final List<String> OBSOLETES = List.of("tracking");

    @PostConstruct
    public void seed() {
        try {
            DEFAUTS.forEach((cle, libelle) -> {
                if (!repository.existsById(cle)) {
                    repository.save(FeatureFlag.builder().cle(cle).libelle(libelle).actif(true).build());
                }
            });
            // Purge des fonctionnalités obsolètes (ex. « tracking » fusionné dans « suivi-trajets »).
            OBSOLETES.forEach(cle -> {
                if (repository.existsById(cle)) repository.deleteById(cle);
            });
        } catch (Exception e) {
            // Table pas encore créée selon le profil : on ignore (les défauts seront créés au prochain démarrage).
        }
    }

    @Transactional(readOnly = true)
    public List<FeatureFlag> getAll() {
        return repository.findAll();
    }

    public FeatureFlag setActif(String cle, boolean actif) {
        FeatureFlag f = repository.findById(cle)
                .orElseGet(() -> FeatureFlag.builder().cle(cle).libelle(cle).build());
        f.setActif(actif);
        return repository.save(f);
    }
}
