package com.agileo.transport.repository;

import com.agileo.transport.entity.Reserve;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ReserveRepository extends JpaRepository<Reserve, Long> {

    List<Reserve> findByVoyageId(Long voyageId);

    @Query("SELECT r FROM Reserve r WHERE r.voyage.dateCreation BETWEEN :debut AND :fin")
    List<Reserve> findByVoyageDateCreationBetween(
            @Param("debut") LocalDateTime debut,
            @Param("fin") LocalDateTime fin);
}
