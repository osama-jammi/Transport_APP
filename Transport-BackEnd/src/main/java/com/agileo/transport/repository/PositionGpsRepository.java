package com.agileo.transport.repository;

import com.agileo.transport.entity.PositionGps;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PositionGpsRepository extends JpaRepository<PositionGps, Long> {
    /** Dernière position connue d'un camion */
    Optional<PositionGps> findTopByCamionIdOrderByHorodatageDesc(Long camionId);

    /** Tous les points d'un voyage, du plus ancien au plus récent (le trajet). */
    List<PositionGps> findByVoyageIdOrderByHorodatageAsc(Long voyageId);

    /** Points GPS de plusieurs livraisons (pour agréger un voyage conteneur). */
    List<PositionGps> findByVoyageIdInOrderByHorodatageAsc(List<Long> voyageIds);
}
