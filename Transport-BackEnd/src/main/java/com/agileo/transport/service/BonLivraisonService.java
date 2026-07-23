package com.agileo.transport.service;

/** Génération du bon de livraison (PDF JasperReports) d'un voyage GAP. */
public interface BonLivraisonService {
    /** Construit le BL d'un voyage (livraison) au format PDF. */
    byte[] genererBL(Long voyageId);
}
