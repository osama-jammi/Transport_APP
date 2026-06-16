package com.agileo.transport.Dtos.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Résultat d'une tentative de confirmation d'arrivée sur le chantier. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ArriveeResponseDTO {
    /** true si l'arrivée a été validée (dans la zone, ou forçage accepté) */
    private boolean confirmed;
    /** Distance mesurée entre le chauffeur et le chantier (mètres), null si inconnue */
    private Integer distanceMetres;
    /** Rayon autorisé de la zone du chantier (mètres) */
    private Integer rayonMetres;
    /** true si un code de forçage est requis (hors zone) */
    private boolean forcageRequis;
    private String message;
}
