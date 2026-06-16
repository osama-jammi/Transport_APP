package com.agileo.transport.service;

import com.agileo.transport.Dtos.response.CommandeMpDTO;
import com.agileo.transport.Dtos.response.MatierePremiereDTO;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.List;

/**
 * Accès en lecture seule à la base Divalto (RB217_MIG) pour les matières premières.
 *
 * Flux en 2 étapes :
 *  1. Sélection d'une commande (entête ENT) : PICOD=2, DOS=1, TICOD='F', CE4=1.
 *  2. Lignes de la commande (MOUV) par CDNO : DOS=1, TICOD='F', PICOD=1.
 * Strictement en lecture (aucune écriture dans l'ERP).
 */
@Service
public class DivaltoReadService {

    private final JdbcTemplate divaltoJdbcTemplate;

    public DivaltoReadService(@Qualifier("divaltoJdbcTemplate") JdbcTemplate divaltoJdbcTemplate) {
        this.divaltoJdbcTemplate = divaltoJdbcTemplate;
        // Évite qu'une requête sur la grosse table MOUV ne bloque indéfiniment.
        this.divaltoJdbcTemplate.setQueryTimeout(45);
    }

    private static String trim(String s) { return s == null ? null : s.trim(); }

    private static final RowMapper<MatierePremiereDTO> MAPPER = (rs, i) -> {
        MatierePremiereDTO dto = new MatierePremiereDTO();
        dto.setId(rs.getLong("MOUV_ID"));
        dto.setReference(trim(rs.getString("REF")));
        dto.setDesignation(trim(rs.getString("DES")));
        dto.setQuantite(rs.getDouble("QTE1"));
        String refun = trim(rs.getString("REFUN"));
        String venun = trim(rs.getString("VENUN"));
        dto.setUnite(refun != null && !refun.isEmpty() ? refun : venun);
        dto.setProjet(trim(rs.getString("PROJET")));
        dto.setMarche(trim(rs.getString("MARCHE")));
        dto.setTiers(trim(rs.getString("TIERS")));
        dto.setDevise(trim(rs.getString("DEV")));
        return dto;
    };

    private static final RowMapper<CommandeMpDTO> COMMANDE_MAPPER = (rs, i) -> {
        CommandeMpDTO dto = new CommandeMpDTO();
        dto.setCdno(rs.getLong("PINO"));
        dto.setPrefixe(trim(rs.getString("PREFPINO")));
        dto.setProjet(trim(rs.getString("PROJET")));
        dto.setMarche(trim(rs.getString("MARCHE")));
        dto.setTiers(trim(rs.getString("TIERS")));
        Timestamp d = rs.getTimestamp("PIDT");
        dto.setDate(d != null ? d.toLocalDateTime() : null);
        return dto;
    };

    /**
     * Étape 1 — Commandes (entêtes ENT) parmi lesquelles choisir.
     * Filtre : PICOD = 2, DOS = 1, TICOD = 'F', CE4 = 1.
     */
    public List<CommandeMpDTO> getCommandes() {
        String sql = "SELECT TOP (500) PINO, PREFPINO, PROJET, MARCHE, TIERS, PIDT " +
                "FROM ENT WHERE PICOD = 2 AND DOS = 1 AND TICOD = 'F' AND CE4 = 1 " +
                "ORDER BY PINO DESC";
        return divaltoJdbcTemplate.query(sql, COMMANDE_MAPPER);
    }

    /**
     * Étape 2 — Lignes (matières premières) d'une commande, par CDNO.
     * Filtre : CDNO = ?, DOS = 1, TICOD = 'F', PICOD = 2. Lecture seule.
     */
    public List<MatierePremiereDTO> getMatieresByCommande(Long cdno) {
        String sql = "SELECT MOUV_ID, REF, DES, QTE1, REFUN, VENUN, PROJET, MARCHE, TIERS, DEV " +
                "FROM MOUV WHERE CDNO = ? AND DOS = 1 AND TICOD = 'F' AND PICOD = 2 " +
                "ORDER BY DES";
        return divaltoJdbcTemplate.query(sql, MAPPER, cdno);
    }
}
