package com.agileo.transport.repository;

import com.agileo.transport.entity.Transporteur;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TransporteurRepository extends JpaRepository<Transporteur, Long> {
    List<Transporteur> findByActifTrue();
}
