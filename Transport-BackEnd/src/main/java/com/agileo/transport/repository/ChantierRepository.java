package com.agileo.transport.repository;

import com.agileo.transport.entity.Chantier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChantierRepository extends JpaRepository<Chantier, Long> {
    List<Chantier> findByActifTrue();
    List<Chantier> findByVilleContainingIgnoreCase(String ville);
}
