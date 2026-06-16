package com.agileo.transport.repository;

import com.agileo.transport.entity.Colis;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ColisRepository extends JpaRepository<Colis, Long> {
    List<Colis> findByVoyageId(Long voyageId);
    List<Colis> findByVoyageIdAndEtat(Long voyageId, Colis.EtatColis etat);
    Optional<Colis> findFirstByVoyageId(Long voyageId);
}
