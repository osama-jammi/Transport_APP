package com.agileo.transport.config;

import com.agileo.transport.service.GapReadService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Archive automatiquement les voyages déchargés depuis plus de 24 h.
 * S'exécute toutes les heures.
 */
@Component
public class VoyageArchiveScheduler {

    private static final Logger log = LoggerFactory.getLogger(VoyageArchiveScheduler.class);
    private final GapReadService gapReadService;

    public VoyageArchiveScheduler(GapReadService gapReadService) {
        this.gapReadService = gapReadService;
    }

    @Scheduled(fixedRate = 3600000) // toutes les heures
    public void archiverVoyagesLivres() {
        try {
            int n = gapReadService.archiverVoyagesLivresAuto();
            if (n > 0) log.info("[archivage] {} voyage(s) archivé(s) automatiquement (déchargés > 24 h)", n);
        } catch (Exception e) {
            log.warn("[archivage] échec de l'archivage automatique : {}", e.getMessage());
        }
    }
}
