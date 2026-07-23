package com.agileo.transport.repository;

import com.agileo.transport.entity.UtilisateurMobile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UtilisateurMobileRepository extends JpaRepository<UtilisateurMobile, Long> {
    Optional<UtilisateurMobile> findByUsername(String username);
    boolean existsByUsername(String username);
}
