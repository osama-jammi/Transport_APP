package com.agileo.transport.repository;

import com.agileo.transport.entity.Chauffeur;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ChauffeurRepository extends JpaRepository<Chauffeur, Long> {
    Optional<Chauffeur> findByMatricule(String matricule);
    Optional<Chauffeur> findByQrCode(String qrCode);
}
