package com.agileo.transport.service;

import com.agileo.transport.Dtos.request.PositionGpsRequestDTO;
import com.agileo.transport.Dtos.response.PositionGpsResponseDTO;
import com.agileo.transport.Dtos.response.TrajetChauffeurDTO;
import com.agileo.transport.Dtos.response.TrajetVoyageResponseDTO;

import java.time.LocalDateTime;
import java.util.List;

public interface GpsService {
    /** Enregistre la position remontée par un camion */
    PositionGpsResponseDTO savePosition(PositionGpsRequestDTO dto);
    /** Dernière position connue de chaque camion */
    List<PositionGpsResponseDTO> getDernieresPositions();
    /** Dernière position d'un camion spécifique */
    PositionGpsResponseDTO getDernierePosition(Long camionId);
    /** Trajet GPS d'un voyage (livraison GAP) + durée calculée */
    TrajetVoyageResponseDTO getTrajetVoyage(Long voyageId);
    /** Trajet GPS agrégé d'un voyage conteneur (positions de toutes ses livraisons). */
    TrajetVoyageResponseDTO getTrajetAgrege(Long voyageConteneurId, List<Long> livraisonIds);
    /**
     * Trajets GPS regroupés par chauffeur sur une période (suivi multi-chauffeurs).
     * @param chauffeurId si non nul, ne renvoie que ce chauffeur.
     */
    List<TrajetChauffeurDTO> getTrajetsParChauffeur(LocalDateTime debut, LocalDateTime fin, Long chauffeurId);
}
