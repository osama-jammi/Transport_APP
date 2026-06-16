package com.agileo.transport.service.impl;

import com.agileo.transport.Dtos.request.ChauffeurRequestDTO;
import com.agileo.transport.Dtos.response.ChauffeurResponseDTO;
import com.agileo.transport.Dtos.response.GapChauffeurDTO;
import com.agileo.transport.entity.Camion;
import com.agileo.transport.entity.Chauffeur;
import com.agileo.transport.repository.CamionRepository;
import com.agileo.transport.repository.ChauffeurRepository;
import com.agileo.transport.service.ChauffeurService;
import com.agileo.transport.service.GapReadService;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    /** Préfixe encodé dans le QR d'un chauffeur GAP. */
    private static final String PREFIXE_QR_GAP = "CHAUFFEUR_GAP:";

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
        Chauffeur chauffeur = Chauffeur.builder()
                .nom(dto.getNom())
                .prenom(dto.getPrenom())
                .telephone(dto.getTelephone())
                .matricule(dto.getMatricule())
                .qrCode(UUID.randomUUID().toString())
                .build();
        return toDTO(chauffeurRepository.save(chauffeur));
    }

    @Override
    public ChauffeurResponseDTO update(Long id, ChauffeurRequestDTO dto) {
        Chauffeur chauffeur = findById(id);
        chauffeur.setNom(dto.getNom());
        chauffeur.setPrenom(dto.getPrenom());
        chauffeur.setTelephone(dto.getTelephone());
        chauffeur.setMatricule(dto.getMatricule());
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
        Chauffeur chauffeur = findById(id);
        // Régénère si absent
        if (chauffeur.getQrCode() == null) {
            chauffeur.setQrCode(UUID.randomUUID().toString());
            chauffeurRepository.save(chauffeur);
        }
        return encodeQr(chauffeur.getQrCode());
    }

    @Override
    public byte[] generateQrCodeGap(Long gapChauffeurId) {
        // Le QR encode l'id du chauffeur GAP (pour identification / appairage).
        return encodeQr("CHAUFFEUR_GAP:" + gapChauffeurId);
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
        // Nouveau format : QR d'un chauffeur GAP → appairage à partir de la base GAP
        if (qrCode != null && qrCode.startsWith(PREFIXE_QR_GAP)) {
            return connectChauffeurGap(qrCode);
        }
        // Ancien format : QR stocké dans la table locale
        Chauffeur chauffeur = chauffeurRepository.findByQrCode(qrCode)
                .orElseThrow(() -> new EntityNotFoundException("QR code chauffeur invalide"));
        chauffeur.setDerniereConnexion(LocalDateTime.now());
        return toDTO(chauffeurRepository.save(chauffeur));
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
        return dto;
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private Chauffeur findById(Long id) {
        return chauffeurRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Chauffeur introuvable : " + id));
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
