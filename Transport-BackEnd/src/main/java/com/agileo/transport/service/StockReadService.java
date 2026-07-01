package com.agileo.transport.service;

import com.agileo.transport.Dtos.response.ArticleStockDTO;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Accès en LECTURE SEULE au stock DivNet (vue {@code Article_en_stock}).
 *
 * Reproduit l'écran « Articles disponibles (avec stock) » de la consommation
 * DivNet : on liste les dépôts puis, pour un dépôt donné, les articles dont le
 * stock est > 0. Aucune écriture n'est faite dans la base : le transport ne fait
 * que lire le stock pour proposer des articles à livrer (la quantité saisie est
 * traitée comme une matière première, sans impact sur le stock réel).
 */
@Service
public class StockReadService {

    private final JdbcTemplate stockJdbcTemplate;

    public StockReadService(@Qualifier("stockJdbcTemplate") JdbcTemplate stockJdbcTemplate) {
        this.stockJdbcTemplate = stockJdbcTemplate;
        this.stockJdbcTemplate.setQueryTimeout(45);
    }

    private static String trim(String s) {
        return s == null ? null : s.trim();
    }

    private static final RowMapper<ArticleStockDTO> MAPPER = (rs, i) -> {
        ArticleStockDTO dto = new ArticleStockDTO();
        dto.setReference(trim(rs.getString("REF")));
        dto.setDesignation(trim(rs.getString("DES")));
        dto.setUnite(trim(rs.getString("ACHUN")));
        BigDecimal qte = rs.getBigDecimal("SumStQte");
        dto.setStockDisponible(qte != null ? qte.doubleValue() : 0.0);
        dto.setDepot(trim(rs.getString("DEPO")));
        return dto;
    };

    /**
     * Liste des dépôts (codes DEPO) ayant au moins un article en stock.
     * Ex. RB1, RB2, …, RB5. Découvert dynamiquement : pas de liste codée en dur.
     */
    public List<String> getDepots() {
        List<String> depots = stockJdbcTemplate.queryForList(
                "SELECT DISTINCT LTRIM(RTRIM(DEPO)) AS depot FROM Article_en_stock " +
                        "WHERE DEPO IS NOT NULL AND SumStQte > 0 ORDER BY depot",
                String.class);
        List<String> result = new ArrayList<>();
        for (String d : depots) {
            if (d != null && !d.isBlank()) result.add(d.trim());
        }
        return result;
    }

    /**
     * Articles disponibles (stock > 0) d'un dépôt, comme l'écran consommation DivNet.
     *
     * @param depot  code du dépôt (DEPO), ex. RB1
     * @param search filtre optionnel sur la référence ou la désignation
     */
    public List<ArticleStockDTO> getArticlesByDepot(String depot, String search) {
        StringBuilder sql = new StringBuilder(
                "SELECT LTRIM(RTRIM(REF)) AS REF, DES, ACHUN, SumStQte, LTRIM(RTRIM(DEPO)) AS DEPO " +
                        "FROM Article_en_stock " +
                        "WHERE DEPO = ? AND SumStQte > 0 ");
        List<Object> args = new ArrayList<>();
        args.add(depot != null ? depot.trim() : null);

        if (search != null && !search.isBlank()) {
            sql.append("AND (REF LIKE ? OR DES LIKE ?) ");
            String like = "%" + search.trim() + "%";
            args.add(like);
            args.add(like);
        }
        sql.append("ORDER BY REF");
        return stockJdbcTemplate.query(sql.toString(), MAPPER, args.toArray());
    }
}
