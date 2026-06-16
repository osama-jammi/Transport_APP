package com.agileo.transport.service;

import com.agileo.transport.Dtos.request.ChauffeurRequestDTO;
import com.agileo.transport.Dtos.response.ChauffeurResponseDTO;

import java.util.List;

public interface ChauffeurService {
    List<ChauffeurResponseDTO> getAll();
    ChauffeurResponseDTO getById(Long id);
    ChauffeurResponseDTO create(ChauffeurRequestDTO dto);
    ChauffeurResponseDTO update(Long id, ChauffeurRequestDTO dto);
    void delete(Long id);
    /** Génère ou régénère le QR code du chauffeur (table locale) */
    byte[] generateQrCode(Long id);
    /** Génère un QR code à partir de l'id d'un chauffeur GAP (sans table locale) */
    byte[] generateQrCodeGap(Long gapChauffeurId);
    /** Appairage mobile : connexion persistante via scan QR */
    ChauffeurResponseDTO connectByQrCode(String qrCode);
    /** Enregistre le jeton de notification push (Expo) du téléphone du chauffeur */
    ChauffeurResponseDTO registerPushToken(Long id, String token);
}
