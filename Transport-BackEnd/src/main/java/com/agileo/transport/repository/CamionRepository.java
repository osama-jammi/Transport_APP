package com.agileo.transport.repository;

import com.agileo.transport.entity.Camion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CamionRepository extends JpaRepository<Camion, Long> {
    Optional<Camion> findByImmatriculation(String immatriculation);
    List<Camion> findByEtat(Camion.EtatCamion etat);
    Optional<Camion> findByChauffeurId(Long chauffeurId);
}
