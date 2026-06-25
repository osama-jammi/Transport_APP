package com.agileo.transport.service.impl;

import com.agileo.transport.Dtos.request.ChauffeurRequestDTO;
import com.agileo.transport.Dtos.response.ChauffeurResponseDTO;
import com.agileo.transport.Dtos.response.GapChauffeurDTO;
import com.agileo.transport.entity.Camion;
import com.agileo.transport.entity.Chauffeur;
import com.agileo.transport.repository.CamionRepository;
import com.agileo.transport.repository.ChauffeurRepository;
import com.agileo.transport.security.JwtService;
import com.agileo.transport.security.QrCipherService;
import com.agileo.transport.service.ChauffeurService;
import com.agileo.transport.service.GapReadService;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ChauffeurServiceImpl implements ChauffeurService {

    private final ChauffeurRepository chauffeurRepository;
    private final CamionRepository camionRepository;
    private final GapReadService gapReadService;
    private final JwtService jwtService;
    private final QrCipherService qrCipherService;

    /** Préfixe historique (QR en clair) d'un chauffeur GAP — gardé pour compat ascendante. */
    private static final String PREFIXE_QR_GAP = "CHAUFFEUR_GAP:";
    /** Rôle applicatif des jetons chauffeur. */
    private static final String ROLE_CHAUFFEUR = "CHAUFFEUR";

    @Override
    @Transactional(readOnly = true)
    public List<ChauffeurResponseDTO> getAll() {
        return chauffeurRepository.findAll()
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ChauffeurResponseDTO getById(Long id) {
        return toDTO(findById(id));
    }

    @Override
    public ChauffeurResponseDTO create(ChauffeurRequestDTO dto) {
        // Chauffeur normal (non administrateur) → enregistré dans GAP : il apparaît
        // dans la grille de la flotte (comme les chauffeurs de l'ERP).
        if (!Boolean.TRUE.equals(dto.getAdmin())) {
            Long gapId = gapReadService.createChauffeur(
                    dto.getNom(), dto.getPrenom(), parseMatriculeGap(dto.getMatricule()), "WEB");
            ChauffeurResponseDTO out = new ChauffeurResponseDTO();
            out.setId(gapId);
            out.setNom(dto.getNom());
            out.setPrenom(dto.getPrenom());
            out.setMatricule(dto.getMatricule());
            out.setActif(true);
            out.setAdmin(false);
            return out;
        }
        // Administrateur → base locale (compte app mobile / tableau de bord).
        Chauffeur chauffeur = Chauffeur.builder()
                .nom(dto.getNom())
                .prenom(dto.getPrenom())
                .telephone(dto.getTelephone())
                .matricule(dto.getMatricule())
                .admin(true)
                .qrCode(UUID.randomUUID().toString())
                .build();
        return toDTO(chauffeurRepository.save(chauffeur));
    }

    /**
     * Le matricule GAP est numérique (colonne int). On convertit la saisie ;
     * vide → null, non numérique → erreur 400 explicite.
     */
    private Integer parseMatriculeGap(String matricule) {
        if (matricule == null || matricule.isBlank()) return null;
        try {
            return Integer.valueOf(matricule.trim());
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Le matricule d'un chauffeur doit être numérique (il est enregistré dans GAP). "
                    + "Pour un identifiant alphanumérique, cochez « Compte administrateur ».");
        }
    }

    @Override
    public ChauffeurResponseDTO update(Long id, ChauffeurRequestDTO dto) {
        Chauffeur chauffeur = findById(id);
        chauffeur.setNom(dto.getNom());
        chauffeur.setPrenom(dto.getPrenom());
        chauffeur.setTelephone(dto.getTelephone());
        chauffeur.setMatricule(dto.getMatricule());
        if (dto.getAdmin() != null) chauffeur.setAdmin(dto.getAdmin());
        return toDTO(chauffeurRepository.save(chauffeur));
    }

    @Override
    public void delete(Long id) {
        Chauffeur chauffeur = findById(id);
        chauffeur.setActif(false);
        chauffeurRepository.save(chauffeur);
    }

    @Override
    public byte[] generateQrCode(Long id) {
        Chauffeur c = findById(id);
        // QR chiffré (AES) : "LOC|{id}|{matricule}|{nom prenom}".
        String payload = "LOC|" + c.getId() + "|"
                + (c.getMatricule() == null ? "" : c.getMatricule()) + "|"
                + nomComplet(c.getNom(), c.getPrenom());
        return encodeQr(qrCipherService.chiffrer(payload));
    }

    @Override
    public byte[] generateQrCodeGap(Long gapChauffeurId) {
        GapChauffeurDTO gap = gapReadService.getChauffeurById(gapChauffeurId);
        if (gap == null) {
            throw new EntityNotFoundException("Chauffeur GAP introuvable : " + gapChauffeurId);
        }
        // QR chiffré (AES) : "GAP|{id}|{matricule}|{nom prenom}".
        String payload = "GAP|" + gapChauffeurId + "|"
                + (gap.getMatricule() == null ? "" : String.valueOf(gap.getMatricule())) + "|"
                + nomComplet(gap.getNom(), gap.getPrenom());
        return encodeQr(qrCipherService.chiffrer(payload));
    }

    @Override
    public ChauffeurResponseDTO registerPushToken(Long id, String token) {
        return chauffeurRepository.findById(id)
                .map(ch -> {
                    ch.setPushToken(token);
                    return toDTO(chauffeurRepository.save(ch));
                })
                .orElseGet(() -> {
                    // Chauffeur GAP : pas de stockage local du token pour l'instant (push non géré).
                    GapChauffeurDTO gap = gapReadService.getChauffeurById(id);
                    ChauffeurResponseDTO dto = new ChauffeurResponseDTO();
                    if (gap != null) {
                        dto.setId(gap.getId());
                        dto.setNom(gap.getNom());
                        dto.setPrenom(gap.getPrenom());
                        dto.setMatricule(gap.getMatricule() != null ? String.valueOf(gap.getMatricule()) : null);
                    } else {
                        dto.setId(id);
                    }
                    dto.setActif(true);
                    return dto;
                });
    }

    @Override
    public ChauffeurResponseDTO connectByQrCode(String qrCode) {
        // Format courant : QR chiffré (AES) → on déchiffre pour retrouver "TYPE|id|matricule|nom".
        String contenu = qrCode;
        try {
            String clair = qrCipherService.dechiffrer(qrCode);
            if (clair.startsWith("GAP|") || clair.startsWith("LOC|")) {
                String[] p = clair.split("\\|", 4);
                Long id = Long.parseLong(p[1]);
                return "GAP".equals(p[0])
                        ? connectChauffeurGap(PREFIXE_QR_GAP + id)
                        : connectChauffeurLocal(id);
            }
            contenu = clair;
        } catch (IllegalArgumentException notEncrypted) {
            // QR non chiffré → on retombe sur les formats historiques (compat ascendante).
        }

        // ── Formats historiques (QR en clair) ──
        if (contenu != null && contenu.startsWith(PREFIXE_QR_GAP)) {
            return connectChauffeurGap(contenu);
        }
        Chauffeur chauffeur = chauffeurRepository.findByQrCode(contenu)
                .orElseThrow(() -> new EntityNotFoundException("QR code chauffeur invalide"));
        if (Boolean.FALSE.equals(chauffeur.getActif())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Compte désactivé. Contactez l'administrateur.");
        }
        chauffeur.setDerniereConnexion(LocalDateTime.now());
        ChauffeurResponseDTO dto = toDTO(chauffeurRepository.save(chauffeur));
        dto.setToken(jwtService.generer("chauffeur:" + dto.getId(), ROLE_CHAUFFEUR, dto.getNom(), dto.getPrenom()));
        return dto;
    }

    /** Appairage d'un chauffeur de la table locale (QR "LOC|...") → jeton chauffeur. */
    private ChauffeurResponseDTO connectChauffeurLocal(Long id) {
        Chauffeur chauffeur = findById(id);
        if (Boolean.FALSE.equals(chauffeur.getActif())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Compte désactivé. Contactez l'administrateur.");
        }
        chauffeur.setDerniereConnexion(LocalDateTime.now());
        ChauffeurResponseDTO dto = toDTO(chauffeurRepository.save(chauffeur));
        dto.setToken(jwtService.generer("chauffeur:" + dto.getId(), ROLE_CHAUFFEUR, dto.getNom(), dto.getPrenom()));
        return dto;
    }

    /** Appairage d'un chauffeur GAP (QR = "CHAUFFEUR_GAP:{id}"). */
    private ChauffeurResponseDTO connectChauffeurGap(String qrCode) {
        Long gapId;
        try {
            gapId = Long.parseLong(qrCode.substring(PREFIXE_QR_GAP.length()).trim());
        } catch (NumberFormatException e) {
            throw new EntityNotFoundException("QR code chauffeur invalide");
        }
        GapChauffeurDTO gap = gapReadService.getChauffeurById(gapId);
        if (gap == null) {
            throw new EntityNotFoundException("Chauffeur GAP introuvable : " + gapId);
        }
        if (Boolean.FALSE.equals(gap.getActif())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Compte désactivé. Contactez l'administrateur.");
        }
        // Enregistre la dernière connexion (visible ensuite dans la Flotte)
        gapReadService.updateChauffeurConnexion(gapId);
        ChauffeurResponseDTO dto = new ChauffeurResponseDTO();
        dto.setDerniereConnexion(java.time.LocalDateTime.now());
        dto.setId(gap.getId());
        dto.setNom(gap.getNom());
        dto.setPrenom(gap.getPrenom());
        dto.setMatricule(gap.getMatricule() != null ? String.valueOf(gap.getMatricule()) : null);
        dto.setActif(true);
        // Camion affecté à ce chauffeur GAP (pour la remontée GPS mobile)
        camionRepository.findByChauffeurId(gapId).ifPresent(cam -> {
            dto.setCamionId(cam.getId());
            dto.setCamionImmatriculation(cam.getImmatriculation());
        });
        dto.setToken(jwtService.generer("chauffeur:" + dto.getId(), ROLE_CHAUFFEUR, dto.getNom(), dto.getPrenom()));
        return dto;
    }

    @Override
    public void setActifGap(Long gapChauffeurId, boolean actif) {
        gapReadService.updateChauffeurActif(gapChauffeurId, actif);
    }

    @Override
    public ChauffeurResponseDTO setActif(Long id, boolean actif) {
        Chauffeur chauffeur = findById(id);
        chauffeur.setActif(actif);
        return toDTO(chauffeurRepository.save(chauffeur));
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private Chauffeur findById(Long id) {
        return chauffeurRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Chauffeur introuvable : " + id));
    }

    /** Concatène nom + prénom de façon sûre (valeurs nulles tolérées). */
    private static String nomComplet(String nom, String prenom) {
        return ((nom == null ? "" : nom) + " " + (prenom == null ? "" : prenom)).trim();
    }

    private byte[] encodeQr(String content) {
        try {
            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix matrix = writer.encode(content, BarcodeFormat.QR_CODE, 300, 300);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Erreur génération QR code", e);
        }
    }

    private ChauffeurResponseDTO toDTO(Chauffeur c) {
        ChauffeurResponseDTO dto = new ChauffeurResponseDTO();
        dto.setId(c.getId());
        dto.setNom(c.getNom());
        dto.setPrenom(c.getPrenom());
        dto.setTelephone(c.getTelephone());
        dto.setMatricule(c.getMatricule());
        dto.setQrCode(c.getQrCode());
        dto.setDerniereConnexion(c.getDerniereConnexion());
        dto.setActif(c.getActif());
        dto.setAdmin(Boolean.TRUE.equals(c.getAdmin()));
        // Camion affecté à ce chauffeur (pour la remontée GPS mobile)
        if (c.getId() != null) {
            camionRepository.findByChauffeurId(c.getId()).ifPresent(cam -> {
                dto.setCamionId(cam.getId());
                dto.setCamionImmatriculation(cam.getImmatriculation());
            });
        }
        return dto;
    }
}
