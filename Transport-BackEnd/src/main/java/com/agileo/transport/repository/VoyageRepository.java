package com.agileo.transport.repository;

import com.agileo.transport.entity.Voyage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface VoyageRepository extends JpaRepository<Voyage, Long> {

    List<Voyage> findByStatut(Voyage.StatutVoyage statut);

    @Query("SELECT v FROM Voyage v WHERE v.statut = 'ARCHIVE' " +
           "AND v.dateCreation BETWEEN :debut AND :fin")
    List<Voyage> findArchivesBetween(
            @Param("debut") LocalDateTime debut,
            @Param("fin") LocalDateTime fin);

    List<Voyage> findByCamionId(Long camionId);
}
