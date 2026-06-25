package com.agileo.transport.service;

import com.agileo.transport.Dtos.request.MobileLoginDTO;
import com.agileo.transport.Dtos.request.SuperviseurRequestDTO;
import com.agileo.transport.Dtos.response.MobileAuthResponseDTO;
import com.agileo.transport.Dtos.response.SuperviseurDTO;
import com.agileo.transport.entity.UtilisateurMobile;
import com.agileo.transport.repository.UtilisateurMobileRepository;
import com.agileo.transport.security.JwtService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Authentification de l'app mobile superviseur (table {@code utilisateur_mobile},
 * hors Keycloak) + gestion des comptes superviseur côté web admin.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class MobileAuthService {

    private final UtilisateurMobileRepository repository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    /** Connexion mobile : vérifie identifiants (BCrypt) puis émet un jeton backend. */
    public MobileAuthResponseDTO login(MobileLoginDTO dto) {
        UtilisateurMobile u = repository.findByUsername(dto.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Identifiants invalides"));
        if (Boolean.FALSE.equals(u.getActif())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Compte désactivé. Contactez l'administrateur.");
        }
        if (!passwordEncoder.matches(dto.getPassword(), u.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Identifiants invalides");
        }
        u.setDerniereConnexion(LocalDateTime.now());
        repository.save(u);

        MobileAuthResponseDTO out = new MobileAuthResponseDTO();
        out.setToken(jwtService.generer("superviseur:" + u.getId(), u.getRole(), u.getNom(), u.getPrenom()));
        out.setRole(u.getRole());
        out.setId(u.getId());
        out.setUsername(u.getUsername());
        out.setNom(u.getNom());
        out.setPrenom(u.getPrenom());
        return out;
    }

    // ── Gestion des comptes (web admin) ──────────────────────────────────────

    @Transactional(readOnly = true)
    public List<SuperviseurDTO> lister() {
        return repository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    public SuperviseurDTO creer(SuperviseurRequestDTO dto) {
        if (dto.getPassword() == null || dto.getPassword().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mot de passe requis");
        }
        if (repository.existsByUsername(dto.getUsername())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nom d'utilisateur déjà utilisé");
        }
        UtilisateurMobile u = UtilisateurMobile.builder()
                .username(dto.getUsername())
                .passwordHash(passwordEncoder.encode(dto.getPassword()))
                .nom(dto.getNom())
                .prenom(dto.getPrenom())
                .role("SUPERVISEUR")
                .actif(dto.getActif() == null ? Boolean.TRUE : dto.getActif())
                .build();
        return toDTO(repository.save(u));
    }

    public SuperviseurDTO modifier(Long id, SuperviseurRequestDTO dto) {
        UtilisateurMobile u = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Superviseur introuvable : " + id));
        if (dto.getNom() != null) u.setNom(dto.getNom());
        if (dto.getPrenom() != null) u.setPrenom(dto.getPrenom());
        if (dto.getActif() != null) u.setActif(dto.getActif());
        // Mot de passe changé seulement s'il est fourni (sinon inchangé).
        if (dto.getPassword() != null && !dto.getPassword().isBlank()) {
            u.setPasswordHash(passwordEncoder.encode(dto.getPassword()));
        }
        return toDTO(repository.save(u));
    }

    public void supprimer(Long id) {
        repository.deleteById(id);
    }

    private SuperviseurDTO toDTO(UtilisateurMobile u) {
        SuperviseurDTO d = new SuperviseurDTO();
        d.setId(u.getId());
        d.setUsername(u.getUsername());
        d.setNom(u.getNom());
        d.setPrenom(u.getPrenom());
        d.setRole(u.getRole());
        d.setActif(u.getActif());
        d.setDerniereConnexion(u.getDerniereConnexion());
        return d;
    }
}
