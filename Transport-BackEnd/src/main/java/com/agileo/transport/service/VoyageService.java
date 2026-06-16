package com.agileo.transport.service;

import com.agileo.transport.Dtos.request.VoyageRequestDTO;
import com.agileo.transport.Dtos.response.ArriveeResponseDTO;
import com.agileo.transport.Dtos.response.VoyageResponseDTO;
import com.agileo.transport.entity.Voyage;

import java.time.LocalDateTime;
import java.util.List;

public interface VoyageService {
    /** Confirme l'arrivée du chauffeur sur le chantier (geofence + forçage par code). */
    ArriveeResponseDTO confirmerArrivee(Long voyageId, Double latitude, Double longitude,
                                        boolean force, String forceCode);
    /** Régénère le code de forçage d'arrivée du voyage. */
    VoyageResponseDTO regenererForceCode(Long voyageId);
    /** Enregistre le bon de livraison (fichier + référence) → voyage livré. */
    VoyageResponseDTO enregistrerBL(Long voyageId, org.springframework.web.multipart.MultipartFile fichier, String reference);
    /** Contenu du fichier BL pour téléchargement. */
    byte[] getBLBytes(Long voyageId);
    /** Type MIME du fichier BL. */
    String getBLContentType(Long voyageId);
    /** @param chauffeurId si non null, filtre les voyages du chauffeur (via son camion) */
    List<VoyageResponseDTO> getAllEnCours(Long chauffeurId);
    List<VoyageResponseDTO> getArchivesBetween(LocalDateTime debut, LocalDateTime fin);
    VoyageResponseDTO getById(Long id);
    VoyageResponseDTO create(VoyageRequestDTO dto);
    VoyageResponseDTO update(Long id, VoyageRequestDTO dto);
    void archiver(Long id);
    void supprimer(Long id);
}
