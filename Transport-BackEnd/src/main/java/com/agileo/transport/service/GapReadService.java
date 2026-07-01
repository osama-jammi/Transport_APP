package com.agileo.transport.service;

import com.agileo.transport.Dtos.response.GapArticleDTO;
import com.agileo.transport.Dtos.response.GapChantierDTO;
import com.agileo.transport.Dtos.response.GapChauffeurDTO;
import com.agileo.transport.Dtos.response.GapVoyageArticleDTO;
import com.agileo.transport.Dtos.request.LivraisonDateDTO;
import com.agileo.transport.Dtos.request.MatiereLigneDTO;
import com.agileo.transport.Dtos.request.VoyageMatiereLigneDTO;
import com.agileo.transport.Dtos.response.DashboardStatsDTO;
import com.agileo.transport.Dtos.response.DepotDTO;
import com.agileo.transport.Dtos.response.GapVoyageDTO;
import com.agileo.transport.Dtos.response.MatierePremiereDTO;
import com.agileo.transport.Dtos.response.VoyageConteneurDTO;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Accès à la base GAP (ERP) via gapJdbcTemplate.
 * Lecture : articles, chauffeurs, chantiers, voyages (livraisons).
 * Écriture : voyages (livraisons + detail_livraison).
 */
@Service
public class GapReadService {

    private final JdbcTemplate gapJdbcTemplate;

    public GapReadService(@Qualifier("gapJdbcTemplate") JdbcTemplate gapJdbcTemplate) {
        this.gapJdbcTemplate = gapJdbcTemplate;
    }

    private static final RowMapper<GapArticleDTO> ARTICLE_MAPPER = (rs, i) -> {
        GapArticleDTO dto = new GapArticleDTO();
        dto.setId(rs.getLong("id"));
        dto.setDesignation(rs.getString("designation"));
        dto.setUnite(rs.getString("unite"));
        dto.setQuantiteTot(rs.getDouble("quantite_tot"));
        dto.setQuantiteProd(rs.getDouble("quantite_prod"));
        dto.setQuantiteEnProd(rs.getDouble("quantite_en_prod"));
        dto.setQuantiteLivre(rs.getDouble("quantite_livre"));
        dto.setQuantitePose(rs.getDouble("quantite_pose"));
        dto.setQuantiteReste(rs.getDouble("quantite_tot") - rs.getDouble("quantite_livre"));
        dto.setNumPrix(rs.getString("num_prix"));
        dto.setOrigineArticle(rs.getString("origine_article"));
        long projetId = rs.getLong("projet_id");
        dto.setProjetId(rs.wasNull() ? null : projetId);
        long atelierId = rs.getLong("ateliers_id");
        dto.setAtelierId(rs.wasNull() ? null : atelierId);
        return dto;
    };

    private static final RowMapper<GapChauffeurDTO> CHAUFFEUR_MAPPER = (rs, i) -> {
        GapChauffeurDTO dto = new GapChauffeurDTO();
        dto.setId(rs.getLong("id"));
        dto.setNom(rs.getString("nom"));
        dto.setPrenom(rs.getString("prenom"));
        int matricule = rs.getInt("matricule");
        dto.setMatricule(rs.wasNull() ? null : matricule);
        Timestamp dc = rs.getTimestamp("derniere_connexion");
        dto.setDerniereConnexion(dc != null ? dc.toLocalDateTime() : null);
        boolean actif = rs.getBoolean("actif");
        dto.setActif(rs.wasNull() ? Boolean.TRUE : actif);
        return dto;
    };

    private static final RowMapper<GapChantierDTO> CHANTIER_MAPPER = (rs, i) -> {
        GapChantierDTO dto = new GapChantierDTO();
        dto.setId(rs.getLong("id"));
        dto.setCode(rs.getString("code"));
        dto.setDesignation(rs.getString("designation"));
        int st = rs.getInt("status");
        dto.setStatus(rs.wasNull() ? null : st);
        double lat = rs.getDouble("latitude");
        dto.setLatitude(rs.wasNull() ? null : lat);
        double lng = rs.getDouble("longitude");
        dto.setLongitude(rs.wasNull() ? null : lng);
        int rayon = rs.getInt("rayon_metres");
        dto.setRayonMetres(rs.wasNull() ? null : rayon);
        boolean archive = rs.getBoolean("archive");
        dto.setActif(rs.wasNull() ? Boolean.TRUE : !archive);
        return dto;
    };

    private static final RowMapper<GapVoyageArticleDTO> VOYAGE_ARTICLE_MAPPER = (rs, i) -> {
        GapVoyageArticleDTO dto = new GapVoyageArticleDTO();
        dto.setId(rs.getLong("id"));
        long artId = rs.getLong("id_article");
        dto.setArticleId(rs.wasNull() ? null : artId);
        dto.setDesignation(rs.getString("designation"));
        dto.setNumPrix(rs.getString("num_prix"));
        dto.setOrigineArticle(rs.getString("origine_article"));
        dto.setQuantite(rs.getDouble("quantite"));
        dto.setStatutReception(rs.getString("statut_reception"));
        dto.setProjet(rs.getString("projet"));
        Timestamp ts = rs.getTimestamp("modifier_le");
        dto.setHeureScan(ts != null ? ts.toLocalDateTime() : null);
        return dto;
    };

    private static final RowMapper<GapVoyageDTO> VOYAGE_MAPPER = (rs, i) -> {
        GapVoyageDTO dto = new GapVoyageDTO();
        dto.setId(rs.getLong("id"));
        Timestamp ts = rs.getTimestamp("date_livraison");
        dto.setDateLivraison(ts != null ? ts.toLocalDateTime() : null);
        Timestamp tch = rs.getTimestamp("date_chargement");
        dto.setChargement(tch != null ? tch.toLocalDateTime() : null);
        Timestamp tde = rs.getTimestamp("date_dechargement");
        dto.setDechargement(tde != null ? tde.toLocalDateTime() : null);
        long chId = rs.getLong("id_chauffeur");
        dto.setChauffeurId(rs.wasNull() ? null : chId);
        String nom = rs.getString("ch_nom");
        String prenom = rs.getString("ch_prenom");
        dto.setChauffeur(((prenom != null ? prenom : "") + " " + (nom != null ? nom : "")).trim());
        long pId = rs.getLong("id_projet");
        dto.setProjetId(rs.wasNull() ? null : pId);
        dto.setProjetCode(rs.getString("projet_code"));
        dto.setProjetDesignation(rs.getString("projet_designation"));
        long aId = rs.getLong("id_atelier");
        dto.setAtelierId(rs.wasNull() ? null : aId);
        dto.setAtelierDesignation(rs.getString("atelier_designation"));
        dto.setStatutReception(rs.getString("statut_reception"));
        dto.setImprime(rs.getBoolean("imprime"));
        dto.setNbArticles(rs.getInt("nb_articles"));
        dto.setForceCode(rs.getString("force_code"));
        dto.setBl(rs.getString("bl"));
        String blFichier = rs.getString("bl_fichier");
        dto.setBlFichier(blFichier);
        dto.setBlContentType(rs.getString("bl_content_type"));
        dto.setHasBl(blFichier != null);
        double lat = rs.getDouble("dest_lat");
        dto.setDestinationLat(rs.wasNull() ? null : lat);
        double lng = rs.getDouble("dest_lng");
        dto.setDestinationLng(rs.wasNull() ? null : lng);
        int rayon = rs.getInt("dest_rayon");
        dto.setDestinationRayon(rs.wasNull() ? null : rayon);
        long vId = rs.getLong("voyage_id");
        dto.setVoyageId(rs.wasNull() ? null : vId);
        Timestamp arr = rs.getTimestamp("arrivee_dechargement");
        dto.setArriveeDechargement(arr != null ? arr.toLocalDateTime() : null);
        return dto;
    };

    private static final RowMapper<VoyageConteneurDTO> CONTENEUR_MAPPER = (rs, i) -> {
        VoyageConteneurDTO dto = new VoyageConteneurDTO();
        dto.setId(rs.getLong("id"));
        Timestamp ts = rs.getTimestamp("date_voyage");
        dto.setDateVoyage(ts != null ? ts.toLocalDateTime() : null);
        long chId = rs.getLong("id_chauffeur");
        dto.setChauffeurId(rs.wasNull() ? null : chId);
        String nom = rs.getString("ch_nom");
        String prenom = rs.getString("ch_prenom");
        dto.setChauffeur(((prenom != null ? prenom : "") + " " + (nom != null ? nom : "")).trim());
        dto.setForceCode(rs.getString("force_code"));
        dto.setNbLivraisons(rs.getInt("nb_livraisons"));
        dto.setNbMatieres(rs.getInt("nb_matieres"));
        Timestamp tc = rs.getTimestamp("date_chargement");
        dto.setChargement(tc != null ? tc.toLocalDateTime() : null);
        Timestamp td = rs.getTimestamp("date_dechargement");
        dto.setDechargement(td != null ? td.toLocalDateTime() : null);
        Timestamp rc = rs.getTimestamp("real_chargement");
        dto.setRealChargement(rc != null ? rc.toLocalDateTime() : null);
        Timestamp rd = rs.getTimestamp("real_dechargement");
        dto.setRealDechargement(rd != null ? rd.toLocalDateTime() : null);
        // Statut AFFICHÉ, dérivé de l'avancement réel (inclut articles, MP ET stock via
        // real_chargement / real_dechargement) : Annulé/Archivé prioritaires, sinon
        // Livré (déchargé) > Chargé > En cours. Le filtre en-cours/archives reste sur la colonne brute.
        String statutBrut = rs.getString("statut");
        String statutAffiche;
        if ("ANNULE".equalsIgnoreCase(statutBrut) || "ARCHIVE".equalsIgnoreCase(statutBrut)) {
            statutAffiche = statutBrut;
        } else if (rd != null) {
            statutAffiche = "LIVRE";
        } else if (rc != null) {
            statutAffiche = "CHARGE";
        } else {
            statutAffiche = statutBrut != null ? statutBrut : "EN_COURS";
        }
        dto.setStatut(statutAffiche);
        dto.setLocalNom(rs.getString("local_nom"));
        double llat = rs.getDouble("local_lat"); dto.setLocalLat(rs.wasNull() ? null : llat);
        double llng = rs.getDouble("local_lng"); dto.setLocalLng(rs.wasNull() ? null : llng);
        int lr = rs.getInt("local_rayon"); dto.setLocalRayon(rs.wasNull() ? null : lr);
        return dto;
    };

    /** Tous les articles du catalogue GAP. */
    public List<GapArticleDTO> getArticles() {
        String sql = "SELECT id, designation, unite, quantite_tot, quantite_prod, " +
                "quantite_en_prod, quantite_livre, quantite_pose, num_prix, " +
                "origine_article, projet_id, ateliers_id " +
                "FROM article ORDER BY designation";
        return gapJdbcTemplate.query(sql, ARTICLE_MAPPER);
    }

    /** Tous les chauffeurs depuis GAP. */
    public List<GapChauffeurDTO> getChauffeurs() {
        String sql = "SELECT id, nom, prenom, matricule, derniere_connexion, actif FROM chauffeur ORDER BY nom, prenom";
        return gapJdbcTemplate.query(sql, CHAUFFEUR_MAPPER);
    }

    /** Un chauffeur GAP par son id (null si absent). */
    public GapChauffeurDTO getChauffeurById(Long id) {
        List<GapChauffeurDTO> list = gapJdbcTemplate.query(
                "SELECT id, nom, prenom, matricule, derniere_connexion, actif FROM chauffeur WHERE id = ?", CHAUFFEUR_MAPPER, id);
        return list.isEmpty() ? null : list.get(0);
    }

    /** Active / désactive un chauffeur GAP (contrôle l'accès à l'app mobile). */
    public void updateChauffeurActif(Long chauffeurId, boolean actif) {
        gapJdbcTemplate.update("UPDATE chauffeur SET actif = ? WHERE id = ?", actif ? 1 : 0, chauffeurId);
    }

    /** Crée un chauffeur dans GAP (apparaît dans la grille de la flotte) et renvoie son id généré. */
    public Long createChauffeur(String nom, String prenom, Integer matricule, String user) {
        String sql = "INSERT INTO chauffeur (nom, prenom, matricule, creer_par, creer_le) " +
                "VALUES (?, ?, ?, ?, ?)";
        KeyHolder kh = new GeneratedKeyHolder();
        gapJdbcTemplate.update(con -> {
            PreparedStatement ps = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, nom);
            ps.setString(2, prenom);
            if (matricule != null) ps.setInt(3, matricule); else ps.setNull(3, Types.INTEGER);
            ps.setString(4, user);
            ps.setTimestamp(5, Timestamp.valueOf(LocalDateTime.now()));
            return ps;
        }, kh);
        Number key = kh.getKey();
        return key != null ? key.longValue() : null;
    }

    /** Enregistre la dernière connexion mobile d'un chauffeur GAP (scan QR). */
    public void updateChauffeurConnexion(Long chauffeurId) {
        gapJdbcTemplate.update(
                "UPDATE chauffeur SET derniere_connexion = ? WHERE id = ?",
                Timestamp.valueOf(LocalDateTime.now()), chauffeurId);
    }

    /** Tous les chantiers (projets) depuis GAP. */
    public List<GapChantierDTO> getChantiers() {
        String sql = "SELECT id, code, designation, status, latitude, longitude, rayon_metres, archive " +
                "FROM projet ORDER BY designation";
        return gapJdbcTemplate.query(sql, CHANTIER_MAPPER);
    }

    /** Un chantier (projet) GAP par son id. */
    public GapChantierDTO getChantierById(Long id) {
        List<GapChantierDTO> list = gapJdbcTemplate.query(
                "SELECT id, code, designation, status, latitude, longitude, rayon_metres, archive " +
                        "FROM projet WHERE id = ?", CHANTIER_MAPPER, id);
        return list.isEmpty() ? null : list.get(0);
    }

    /** Tous les voyages (livraisons) depuis GAP, avec chauffeur / projet / atelier. */
    public List<GapVoyageDTO> getVoyages() {
        String sql = "SELECT l.id, l.date_livraison, l.date_chargement, l.date_dechargement, l.id_chauffeur, " +
                "ch.nom AS ch_nom, ch.prenom AS ch_prenom, " +
                "l.id_projet, p.code AS projet_code, p.designation AS projet_designation, " +
                "l.id_atelier, ate.designation AS atelier_designation, " +
                "l.statut_reception, l.imprime, l.force_code, l.bl, l.bl_fichier, l.bl_content_type, " +
                "p.latitude AS dest_lat, p.longitude AS dest_lng, p.rayon_metres AS dest_rayon, l.voyage_id, " +
                "l.arrivee_dechargement, " +
                "(SELECT COUNT(*) FROM detail_livraison dl WHERE dl.id_livraison = l.id) AS nb_articles " +
                "FROM livraisons l " +
                "LEFT JOIN chauffeur ch  ON l.id_chauffeur = ch.id " +
                "LEFT JOIN projet    p   ON l.id_projet    = p.id " +
                "LEFT JOIN ateliers  ate ON l.id_atelier   = ate.id " +
                "ORDER BY l.date_livraison DESC";
        return gapJdbcTemplate.query(sql, VOYAGE_MAPPER);
    }

    /** Voyages (livraisons) GAP d'un chauffeur donné. */
    public List<GapVoyageDTO> getVoyagesByChauffeur(Long chauffeurId) {
        String sql = "SELECT l.id, l.date_livraison, l.date_chargement, l.date_dechargement, l.id_chauffeur, " +
                "ch.nom AS ch_nom, ch.prenom AS ch_prenom, " +
                "l.id_projet, p.code AS projet_code, p.designation AS projet_designation, " +
                "l.id_atelier, ate.designation AS atelier_designation, " +
                "l.statut_reception, l.imprime, l.force_code, l.bl, l.bl_fichier, l.bl_content_type, " +
                "p.latitude AS dest_lat, p.longitude AS dest_lng, p.rayon_metres AS dest_rayon, l.voyage_id, " +
                "l.arrivee_dechargement, " +
                "(SELECT COUNT(*) FROM detail_livraison dl WHERE dl.id_livraison = l.id) AS nb_articles " +
                "FROM livraisons l " +
                "LEFT JOIN chauffeur ch  ON l.id_chauffeur = ch.id " +
                "LEFT JOIN projet    p   ON l.id_projet    = p.id " +
                "LEFT JOIN ateliers  ate ON l.id_atelier   = ate.id " +
                "WHERE l.id_chauffeur = ? " +
                "ORDER BY l.date_livraison DESC";
        return gapJdbcTemplate.query(sql, VOYAGE_MAPPER, chauffeurId);
    }

    /** Un voyage (livraison) GAP par son id. */
    public GapVoyageDTO getVoyageById(Long id) {
        String sql = "SELECT l.id, l.date_livraison, l.date_chargement, l.date_dechargement, l.id_chauffeur, " +
                "ch.nom AS ch_nom, ch.prenom AS ch_prenom, " +
                "l.id_projet, p.code AS projet_code, p.designation AS projet_designation, " +
                "l.id_atelier, ate.designation AS atelier_designation, " +
                "l.statut_reception, l.imprime, l.force_code, l.bl, l.bl_fichier, l.bl_content_type, " +
                "p.latitude AS dest_lat, p.longitude AS dest_lng, p.rayon_metres AS dest_rayon, l.voyage_id, " +
                "l.arrivee_dechargement, " +
                "(SELECT COUNT(*) FROM detail_livraison dl WHERE dl.id_livraison = l.id) AS nb_articles " +
                "FROM livraisons l " +
                "LEFT JOIN chauffeur ch  ON l.id_chauffeur = ch.id " +
                "LEFT JOIN projet    p   ON l.id_projet    = p.id " +
                "LEFT JOIN ateliers  ate ON l.id_atelier   = ate.id " +
                "WHERE l.id = ?";
        List<GapVoyageDTO> list = gapJdbcTemplate.query(sql, VOYAGE_MAPPER, id);
        return list.isEmpty() ? null : list.get(0);
    }

    /** Articles (lignes detail_livraison) d'un voyage GAP. */
    public List<GapVoyageArticleDTO> getVoyageArticles(Long livraisonId) {
        String sql = "SELECT dl.id, dl.id_article, a.designation, a.num_prix, a.origine_article, dl.quantite, " +
                "dl.statut_reception, dl.modifier_le, p.designation AS projet " +
                "FROM detail_livraison dl " +
                "LEFT JOIN article    a ON dl.id_article   = a.id " +
                "LEFT JOIN livraisons l ON dl.id_livraison = l.id " +
                "LEFT JOIN projet     p ON l.id_projet     = p.id " +
                "WHERE dl.id_livraison = ? ORDER BY dl.id";
        return gapJdbcTemplate.query(sql, VOYAGE_ARTICLE_MAPPER, livraisonId);
    }

    // ─────────────── BON DE LIVRAISON : données « façon GAP » ───────────────

    /**
     * Infos BL par ligne (detail_livraison.id) façon GAP. Pour chaque ligne :
     *  [0] ID OF = {@code "OF " + ordre_fabrication.compteur + "-" + MM(of.date) + initiale(creer_par)} (ex. OF 193-06S) ;
     *  [1] emplacement (detail_livraison.emplacement) ;
     *  [2] observation (detail_livraison.observation).
     * Lecture seule, tolérante : renvoie une map vide si le schéma diffère.
     */
    public Map<Long, String[]> getBlInfosParLigne(Long livraisonId) {
        Map<Long, String[]> map = new java.util.HashMap<>();
        try {
            java.text.SimpleDateFormat mm = new java.text.SimpleDateFormat("MM");
            gapJdbcTemplate.query(
                    "SELECT d.id AS detail_id, d.emplacement AS emplacement, d.observation AS observation, " +
                            "o.compteur AS compteur, o.date AS of_date, o.creer_par AS creer_par " +
                            "FROM detail_livraison d " +
                            "LEFT JOIN ordre_fabrication o ON o.id = d.idof " +
                            "WHERE d.id_livraison = ?",
                    rs -> {
                        long detailId = rs.getLong("detail_id");
                        String emplacement = rs.getString("emplacement");
                        String observation = rs.getString("observation");
                        int compteur = rs.getInt("compteur");
                        String ofLabel = "";
                        if (!rs.wasNull()) { // ligne avec OF
                            java.sql.Timestamp ofDate = rs.getTimestamp("of_date");
                            String creerPar = rs.getString("creer_par");
                            String initiale = (creerPar != null && !creerPar.isEmpty())
                                    ? creerPar.substring(0, 1).toUpperCase() : "";
                            String mois = ofDate != null ? mm.format(ofDate) : "";
                            ofLabel = "OF " + compteur + "-" + mois + initiale;
                        }
                        map.put(detailId, new String[]{ofLabel,
                                emplacement != null ? emplacement : "",
                                observation != null ? observation : ""});
                    }, livraisonId);
        } catch (Exception e) {
            System.err.println("BL : infos lignes (ID OF / emplacement / observation) indisponibles (schéma GAP ?) : " + e.getMessage());
        }
        return map;
    }

    /**
     * Agents du BL pour une livraison, comme GAP :
     *  [0] agent de livraison  = utilisateur ayant saisi le BL (login.creer_par), sinon Agent_Livraison de l'atelier ;
     *  [1] agent contrôle qualité = Agent_Controle_Livraison de l'atelier.
     * Tolérant : chaque valeur est "" si introuvable / schéma différent.
     */
    public String[] getBlAgents(Long livraisonId) {
        String agentLivraison = "";
        String agentControle = "";
        Long atelierId = null;
        String creerPar = null;
        try {
            Map<String, Object> liv = gapJdbcTemplate.queryForMap(
                    "SELECT id_atelier, creer_par FROM livraisons WHERE id = ?", livraisonId);
            Object a = liv.get("id_atelier");
            if (a != null) atelierId = ((Number) a).longValue();
            creerPar = (String) liv.get("creer_par");
        } catch (Exception e) {
            System.err.println("BL : lecture livraison (atelier/creer_par) impossible : " + e.getMessage());
        }
        // 1) Agent de livraison = utilisateur (login) ayant saisi le BL
        if (creerPar != null && !creerPar.equalsIgnoreCase("system") && !creerPar.isBlank()) {
            agentLivraison = nomComplet(
                    "SELECT nom, prenom FROM login WHERE username = ?", creerPar);
        }
        // repli : Agent_Livraison de l'atelier
        if (agentLivraison.isEmpty() && atelierId != null) {
            agentLivraison = nomComplet(
                    "SELECT TOP 1 nom, prenom FROM Agent_Livraison WHERE atelier_id = ?", atelierId);
        }
        // 2) Agent contrôle qualité = Agent_Controle_Livraison de l'atelier
        if (atelierId != null) {
            agentControle = nomComplet(
                    "SELECT TOP 1 nom, prenom FROM Agent_Controle_Livraison WHERE atelier_id = ?", atelierId);
        }
        return new String[]{agentLivraison.toUpperCase(), agentControle};
    }

    /** Exécute une requête (nom, prenom) et renvoie "NOM PRENOM" trimé, ou "" si rien/erreur. */
    private String nomComplet(String sql, Object param) {
        try {
            return gapJdbcTemplate.query(sql, rs -> {
                if (!rs.next()) return "";
                String nom = rs.getString("nom");
                String prenom = rs.getString("prenom");
                // GAP : si "nom nom" dupliqué, on garde un seul mot
                if (nom != null) {
                    String[] parts = nom.trim().split("\\s+");
                    if (parts.length > 1 && parts[0].equalsIgnoreCase(parts[1])) nom = parts[0];
                }
                return ((nom != null ? nom : "") + " " + (prenom != null ? prenom : "")).trim();
            }, param);
        } catch (Exception e) {
            System.err.println("BL : agent introuvable (" + sql + ") : " + e.getMessage());
            return "";
        }
    }

    // ─────────────── ÉCRITURE (livraisons + detail_livraison) ───────────────

    /** Crée une livraison (voyage) dans GAP et renvoie son id généré. */
    public Long createLivraison(LocalDateTime chargement, LocalDateTime dechargement,
                                Long chauffeurId, Long projetId, Long atelierId, String user) {
        // date_livraison = date de chargement (référence pour le tri/affichage)
        LocalDateTime dateLivraison = chargement != null ? chargement : LocalDateTime.now();
        String sql = "INSERT INTO livraisons " +
                "(date_livraison, date_chargement, date_dechargement, id_chauffeur, id_projet, id_atelier, " +
                "statut_reception, imprime, creer_par, creer_le) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)";
        KeyHolder kh = new GeneratedKeyHolder();
        gapJdbcTemplate.update(con -> {
            PreparedStatement ps = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setTimestamp(1, Timestamp.valueOf(dateLivraison));
            if (chargement != null) ps.setTimestamp(2, Timestamp.valueOf(chargement)); else ps.setNull(2, Types.TIMESTAMP);
            if (dechargement != null) ps.setTimestamp(3, Timestamp.valueOf(dechargement)); else ps.setNull(3, Types.TIMESTAMP);
            if (chauffeurId != null) ps.setLong(4, chauffeurId); else ps.setNull(4, Types.BIGINT);
            if (projetId != null) ps.setLong(5, projetId); else ps.setNull(5, Types.BIGINT);
            if (atelierId != null) ps.setLong(6, atelierId); else ps.setNull(6, Types.BIGINT);
            ps.setString(7, "EN_ATTENTE");
            ps.setString(8, user);
            ps.setTimestamp(9, Timestamp.valueOf(LocalDateTime.now()));
            return ps;
        }, kh);
        Number key = kh.getKey();
        return key != null ? key.longValue() : null;
    }

    /** Ajoute les lignes d'articles (detail_livraison) à une livraison (quantité 1 par défaut). */
    public void addDetailLines(Long livraisonId, List<Long> articleIds, String user) {
        addDetailLines(livraisonId, articleIds, null, user);
    }

    /**
     * Ajoute les lignes d'articles à une livraison avec la quantité choisie par article
     * (clé = id article). Quantité = 1 si absente ou ≤ 0.
     */
    public void addDetailLines(Long livraisonId, List<Long> articleIds,
                               Map<Long, Double> quantites, String user) {
        if (articleIds == null || articleIds.isEmpty()) return;
        String sql = "INSERT INTO detail_livraison " +
                "(id_livraison, id_article, quantite, type_detail, imprime, statut_reception, creer_par, creer_le) " +
                "VALUES (?, ?, ?, ?, 0, ?, ?, ?)";
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());
        for (Long artId : articleIds) {
            Double q = quantites != null ? quantites.get(artId) : null;
            double qte = (q != null && q > 0) ? q : 1.0;
            gapJdbcTemplate.update(sql, livraisonId, artId, qte, "ARTICLE", "EN_ATTENTE", user, now);
            // Décrémente le stock disponible : quantite_livre augmente → reste = tot - livre diminue
            gapJdbcTemplate.update(
                    "UPDATE article SET quantite_livre = ISNULL(quantite_livre, 0) + ? WHERE id = ?", qte, artId);
        }
    }

    /** Met à jour l'en-tête d'une livraison (voyage). */
    public void updateLivraison(Long id, LocalDateTime chargement, LocalDateTime dechargement,
                                Long chauffeurId, Long projetId, String user) {
        String sql = "UPDATE livraisons SET date_livraison = ?, date_chargement = ?, date_dechargement = ?, " +
                "id_chauffeur = ?, id_projet = ?, modifier_par = ?, modifier_le = ? WHERE id = ?";
        gapJdbcTemplate.update(sql,
                chargement != null ? Timestamp.valueOf(chargement) : null,
                chargement != null ? Timestamp.valueOf(chargement) : null,
                dechargement != null ? Timestamp.valueOf(dechargement) : null,
                chauffeurId, projetId, user, Timestamp.valueOf(LocalDateTime.now()), id);
    }

    /** Remplace les lignes d'articles d'une livraison par la nouvelle sélection. */
    public void replaceDetailLines(Long livraisonId, List<Long> articleIds, String user) {
        replaceDetailLines(livraisonId, articleIds, null, user);
    }

    /** Remplace les lignes d'articles d'une livraison (avec quantités par article). */
    public void replaceDetailLines(Long livraisonId, List<Long> articleIds,
                                   Map<Long, Double> quantites, String user) {
        // Restaure le stock des anciennes lignes avant de les supprimer (évite un double décompte)
        gapJdbcTemplate.query(
                "SELECT id_article, quantite FROM detail_livraison WHERE id_livraison = ?",
                (rs, i) -> {
                    long artId = rs.getLong("id_article");
                    double q = rs.getDouble("quantite");
                    if (!rs.wasNull() && artId != 0) {
                        gapJdbcTemplate.update(
                                "UPDATE article SET quantite_livre = ISNULL(quantite_livre, 0) - ? WHERE id = ?", q, artId);
                    }
                    return null;
                }, livraisonId);
        gapJdbcTemplate.update("DELETE FROM detail_livraison WHERE id_livraison = ?", livraisonId);
        addDetailLines(livraisonId, articleIds, quantites, user);
    }

    /** Met à jour le statut de réception d'une ligne (scan chauffeur). */
    public void updateDetailStatut(Long detailId, String statut) {
        if (isDetailDeLivraisonAnnulee(detailId)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "Livraison annulée : scan impossible.");
        }
        gapJdbcTemplate.update(
                "UPDATE detail_livraison SET statut_reception = ?, modifier_le = ? WHERE id = ?",
                statut, Timestamp.valueOf(LocalDateTime.now()), detailId);
        majStatutLivraison(detailId);
        // 1er scan de chargement d'un article → démarre le chargement du voyage (et son trajet).
        if ("SCANNE_CHARGEMENT".equals(statut)) marquerRealChargementParDetail(detailId);
    }

    /**
     * Passe la livraison à 'CHARGE' lorsque toutes ses lignes ont été scannées
     * (sauf si elle est déjà 'LIVRE').
     */
    private void majStatutLivraison(Long detailId) {
        List<Long> livIds = gapJdbcTemplate.query(
                "SELECT id_livraison FROM detail_livraison WHERE id = ?",
                (rs, i) -> { long v = rs.getLong(1); return rs.wasNull() ? null : v; }, detailId);
        Long livId = livIds.isEmpty() ? null : livIds.get(0);
        if (livId == null) return;
        Integer total = gapJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM detail_livraison WHERE id_livraison = ?", Integer.class, livId);
        Integer scannes = gapJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM detail_livraison WHERE id_livraison = ? " +
                        "AND statut_reception IN ('SCANNE_CHARGEMENT','SCANNE_LIVRAISON','LIVRE')",
                Integer.class, livId);
        if (total != null && total > 0 && total.equals(scannes)) {
            gapJdbcTemplate.update(
                    "UPDATE livraisons SET statut_reception = 'CHARGE', modifier_le = ? " +
                            "WHERE id = ? AND (statut_reception IS NULL OR statut_reception <> 'LIVRE')",
                    Timestamp.valueOf(LocalDateTime.now()), livId);
        }
    }

    /**
     * Vrai dès qu'une livraison a été scannée : au moins une de ses lignes porte
     * un statut de scan, ou son en-tête est passé à 'CHARGE'/'LIVRE'. Une livraison
     * scannée ne peut plus être modifiée ni supprimée.
     */
    public boolean isLivraisonScannee(Long livraisonId) {
        Integer lignes = gapJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM detail_livraison WHERE id_livraison = ? " +
                        "AND statut_reception IN ('SCANNE_CHARGEMENT','SCANNE_LIVRAISON','LIVRE')",
                Integer.class, livraisonId);
        if (lignes != null && lignes > 0) return true;
        Integer entete = gapJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM livraisons WHERE id = ? AND statut_reception IN ('CHARGE','LIVRE')",
                Integer.class, livraisonId);
        return entete != null && entete > 0;
    }

    // ── Garde-fous « annulé » : un voyage / une livraison annulé(e) ne peut plus
    //    être scanné(e) ni modifié(e). ───────────────────────────────────────────

    /** Vrai si le voyage conteneur est annulé. */
    public boolean isVoyageConteneurAnnule(Long voyageId) {
        Integer n = gapJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM voyage WHERE id = ? AND statut = 'ANNULE'",
                Integer.class, voyageId);
        return n != null && n > 0;
    }

    /** Vrai si la livraison est annulée, OU si son voyage conteneur est annulé. */
    public boolean isLivraisonAnnulee(Long livraisonId) {
        Integer n = gapJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM livraisons l WHERE l.id = ? AND (l.statut_reception = 'ANNULE' " +
                        "OR EXISTS (SELECT 1 FROM voyage v WHERE v.id = l.voyage_id AND v.statut = 'ANNULE'))",
                Integer.class, livraisonId);
        return n != null && n > 0;
    }

    /** Vrai si la ligne d'articles appartient à une livraison/voyage annulé(e). */
    public boolean isDetailDeLivraisonAnnulee(Long detailId) {
        Integer n = gapJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM detail_livraison dl JOIN livraisons l ON dl.id_livraison = l.id " +
                        "WHERE dl.id = ? AND (l.statut_reception = 'ANNULE' " +
                        "OR EXISTS (SELECT 1 FROM voyage v WHERE v.id = l.voyage_id AND v.statut = 'ANNULE'))",
                Integer.class, detailId);
        return n != null && n > 0;
    }

    /** Vrai si la ligne de matière première appartient à un voyage conteneur annulé. */
    public boolean isMatiereDeVoyageAnnule(Long matiereId) {
        Integer n = gapJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM voyage_matiere vm JOIN voyage v ON vm.voyage_id = v.id " +
                        "WHERE vm.id = ? AND v.statut = 'ANNULE'",
                Integer.class, matiereId);
        return n != null && n > 0;
    }

    /** Vrai si l'id correspond à un voyage conteneur (table voyage), pas à une livraison. */
    public boolean isVoyageConteneur(Long voyageId) {
        Integer n = gapJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM voyage WHERE id = ?", Integer.class, voyageId);
        return n != null && n > 0;
    }

    /** Vrai si le code correspond au code de forçage du voyage conteneur lui-même. */
    public boolean isForceCodeConteneur(Long voyageId, String code) {
        if (code == null || code.isBlank()) return false;
        String saisi = code.trim();
        List<String> codes = gapJdbcTemplate.queryForList(
                "SELECT force_code FROM voyage WHERE id = ? AND force_code IS NOT NULL",
                String.class, voyageId);
        return codes.stream().anyMatch(fc -> fc != null && fc.trim().equalsIgnoreCase(saisi));
    }

    /** Enregistre le code de forçage d'arrivée d'un voyage. */
    public void updateForceCode(Long livraisonId, String code) {
        gapJdbcTemplate.update(
                "UPDATE livraisons SET force_code = ?, modifier_le = ? WHERE id = ?",
                code, Timestamp.valueOf(LocalDateTime.now()), livraisonId);
    }

    /**
     * Applique le code de forçage au VOYAGE CONTENEUR lui-même ET à toutes ses
     * livraisons. Le code est ainsi commun à tout le voyage et existe même pour un
     * voyage qui n'a QUE des matières premières (aucune livraison/OF).
     */
    public void updateForceCodeConteneur(Long voyageId, String code) {
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());
        gapJdbcTemplate.update(
                "UPDATE voyage SET force_code = ?, modifier_le = ? WHERE id = ?", code, now, voyageId);
        gapJdbcTemplate.update(
                "UPDATE livraisons SET force_code = ?, modifier_le = ? WHERE voyage_id = ?", code, now, voyageId);
    }

    /**
     * Vrai si {@code code} correspond au code de forçage de la livraison elle-même
     * OU d'une autre livraison du même voyage conteneur. Le code de forçage est ainsi
     * commun à TOUTES les lignes du voyage (et pas seulement à celle qui l'a généré /
     * à celle affichée dans l'interface).
     */
    public boolean isForceCodeValidPourVoyage(Long livraisonId, String code) {
        if (code == null || code.isBlank()) return false;
        String saisi = code.trim();
        List<String> codes = gapJdbcTemplate.queryForList(
                "SELECT force_code FROM livraisons " +
                        "WHERE force_code IS NOT NULL " +
                        "AND (id = ? OR (voyage_id IS NOT NULL " +
                        "     AND voyage_id = (SELECT voyage_id FROM livraisons WHERE id = ?))) " +
                "UNION SELECT force_code FROM voyage " +
                        "WHERE force_code IS NOT NULL " +
                        "AND id = (SELECT voyage_id FROM livraisons WHERE id = ?)",
                String.class, livraisonId, livraisonId, livraisonId);
        return codes.stream().anyMatch(fc -> fc != null && fc.trim().equalsIgnoreCase(saisi));
    }

    /** Enregistre le bon de livraison d'une ligne (fichier + référence) → ligne livrée. */
    public void saveBl(Long livraisonId, String reference, String fichier, String contentType) {
        gapJdbcTemplate.update(
                "UPDATE livraisons SET bl = ?, bl_fichier = ?, bl_content_type = ?, " +
                        "statut_reception = 'LIVRE', " +
                        "arrivee_dechargement = COALESCE(arrivee_dechargement, ?), modifier_le = ? " +
                        "WHERE id = ?",
                reference, fichier, contentType,
                Timestamp.valueOf(LocalDateTime.now()), Timestamp.valueOf(LocalDateTime.now()), livraisonId);
        majDechargementVoyageSiComplet(livraisonId);
    }

    /**
     * Marque le voyage comme livré (real_dechargement) UNIQUEMENT lorsque toutes ses
     * lignes sont livrées (BL fourni) — les lignes annulées ne bloquent pas.
     */
    private void majDechargementVoyageSiComplet(Long livraisonId) {
        List<Long> vids = gapJdbcTemplate.queryForList(
                "SELECT voyage_id FROM livraisons WHERE id = ? AND voyage_id IS NOT NULL", Long.class, livraisonId);
        if (vids.isEmpty()) return;
        majDechargementVoyageConteneur(vids.get(0));
    }

    /**
     * Marque le voyage conteneur livré (real_dechargement) UNIQUEMENT quand TOUT son
     * contenu est livré : les livraisons (BL fourni → statut LIVRE) ET toutes les lignes
     * voyage_matiere (matières premières ET stock) au statut LIVRE. Les lignes annulées
     * ne bloquent pas. Sans contenu, aucun changement.
     */
    public void majDechargementVoyageConteneur(Long voyageId) {
        if (voyageId == null) return;
        Integer total = gapJdbcTemplate.queryForObject(
                "SELECT (SELECT COUNT(*) FROM livraisons WHERE voyage_id = ?) " +
                        "+ (SELECT COUNT(*) FROM voyage_matiere WHERE voyage_id = ?)",
                Integer.class, voyageId, voyageId);
        if (total == null || total == 0) return;
        Integer livRestantes = gapJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM livraisons WHERE voyage_id = ? " +
                        "AND (statut_reception IS NULL OR statut_reception NOT IN ('LIVRE','ANNULE'))",
                Integer.class, voyageId);
        Integer mpRestantes = gapJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM voyage_matiere WHERE voyage_id = ? " +
                        "AND (statut IS NULL OR statut <> 'LIVRE')",
                Integer.class, voyageId);
        boolean tout = (livRestantes == null || livRestantes == 0)
                && (mpRestantes == null || mpRestantes == 0);
        if (tout) {
            Timestamp now = Timestamp.valueOf(LocalDateTime.now());
            gapJdbcTemplate.update(
                    "UPDATE voyage SET real_dechargement = COALESCE(real_dechargement, ?), modifier_le = ? WHERE id = ?",
                    now, now, voyageId);
        }
    }

    /** Ajoute un fichier BL à la table livraison_bl_files (plusieurs BL par livraison). */
    public Long addBlFile(Long livraisonId, String reference, String fichier, String contentType) {
        KeyHolder kh = new GeneratedKeyHolder();
        gapJdbcTemplate.update(con -> {
            PreparedStatement ps = con.prepareStatement(
                    "INSERT INTO livraison_bl_files (livraison_id, reference, fichier, content_type, creer_le) VALUES (?,?,?,?,?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, livraisonId);
            ps.setString(2, reference);
            ps.setString(3, fichier);
            ps.setString(4, contentType);
            ps.setTimestamp(5, Timestamp.valueOf(LocalDateTime.now()));
            return ps;
        }, kh);
        // Marquer la livraison comme livrée (même comportement que saveBl)
        gapJdbcTemplate.update(
                "UPDATE livraisons SET statut_reception = 'LIVRE', " +
                        "arrivee_dechargement = COALESCE(arrivee_dechargement, ?), modifier_le = ? WHERE id = ?",
                Timestamp.valueOf(LocalDateTime.now()), Timestamp.valueOf(LocalDateTime.now()), livraisonId);
        majDechargementVoyageSiComplet(livraisonId);
        Number key = kh.getKey();
        return key != null ? key.longValue() : null;
    }

    /** Liste tous les BL d'une livraison (table livraison_bl_files). */
    public List<com.agileo.transport.Dtos.response.BonLivraisonFileDTO> listBlFiles(Long livraisonId) {
        return gapJdbcTemplate.query(
                "SELECT id, reference, fichier, content_type FROM livraison_bl_files WHERE livraison_id = ? ORDER BY id",
                (rs, i) -> {
                    com.agileo.transport.Dtos.response.BonLivraisonFileDTO d = new com.agileo.transport.Dtos.response.BonLivraisonFileDTO();
                    d.setId(rs.getLong("id"));
                    d.setReference(rs.getString("reference"));
                    d.setFichier(rs.getString("fichier"));
                    d.setContentType(rs.getString("content_type"));
                    return d;
                }, livraisonId);
    }

    /** Retrouve un BL par son id (pour téléchargement). */
    public com.agileo.transport.Dtos.response.BonLivraisonFileDTO getBlFileById(Long blId) {
        List<com.agileo.transport.Dtos.response.BonLivraisonFileDTO> list = gapJdbcTemplate.query(
                "SELECT id, reference, fichier, content_type FROM livraison_bl_files WHERE id = ?",
                (rs, i) -> {
                    com.agileo.transport.Dtos.response.BonLivraisonFileDTO d = new com.agileo.transport.Dtos.response.BonLivraisonFileDTO();
                    d.setId(rs.getLong("id"));
                    d.setReference(rs.getString("reference"));
                    d.setFichier(rs.getString("fichier"));
                    d.setContentType(rs.getString("content_type"));
                    return d;
                }, blId);
        return list.isEmpty() ? null : list.get(0);
    }

    /** Met à jour uniquement les dates chargement/déchargement prévu du voyage conteneur. */
    public void updateVoyageDatesPrevues(Long voyageId, LocalDateTime chargement, LocalDateTime dechargement) {
        gapJdbcTemplate.update(
                "UPDATE voyage SET date_chargement = ?, date_dechargement = ?, modifier_le = ? WHERE id = ?",
                chargement != null ? Timestamp.valueOf(chargement) : null,
                dechargement != null ? Timestamp.valueOf(dechargement) : null,
                Timestamp.valueOf(LocalDateTime.now()), voyageId);
    }

    /** Met à jour les dates réelles chargement/déchargement du voyage conteneur. */
    public void updateVoyageDatesReelles(Long voyageId, LocalDateTime realChargement, LocalDateTime realDechargement) {
        gapJdbcTemplate.update(
                "UPDATE voyage SET real_chargement = ?, real_dechargement = ?, modifier_le = ? WHERE id = ?",
                realChargement != null ? Timestamp.valueOf(realChargement) : null,
                realDechargement != null ? Timestamp.valueOf(realDechargement) : null,
                Timestamp.valueOf(LocalDateTime.now()), voyageId);
    }

    // ── Heure réelle de chargement du voyage conteneur ───────────────────────
    // Posée la 1ʳᵉ fois qu'une de ses lignes est scannée au chargement (article, MP ou
    // voyage entier). Sert au statut « En route » du chauffeur ET au démarrage du suivi
    // de trajet du voyage (le trajet ne commence qu'au chargement, pas à la connexion).

    /** Marque l'heure réelle de chargement du conteneur (1ʳᵉ fois) à partir d'une de ses livraisons. */
    private void marquerRealChargementParLivraison(Long livraisonId) {
        gapJdbcTemplate.update(
                "UPDATE voyage SET real_chargement = COALESCE(real_chargement, ?) " +
                        "WHERE id = (SELECT voyage_id FROM livraisons WHERE id = ?)",
                Timestamp.valueOf(LocalDateTime.now()), livraisonId);
    }

    /** Idem à partir d'une ligne detail_livraison. */
    private void marquerRealChargementParDetail(Long detailId) {
        gapJdbcTemplate.update(
                "UPDATE voyage SET real_chargement = COALESCE(real_chargement, ?) " +
                        "WHERE id IN (SELECT l.voyage_id FROM livraisons l " +
                        "JOIN detail_livraison dl ON dl.id_livraison = l.id WHERE dl.id = ?)",
                Timestamp.valueOf(LocalDateTime.now()), detailId);
    }

    /** Idem à partir d'une ligne de matière première (voyage_matiere). */
    private void marquerRealChargementParMatiere(Long matiereId) {
        gapJdbcTemplate.update(
                "UPDATE voyage SET real_chargement = COALESCE(real_chargement, ?) " +
                        "WHERE id = (SELECT voyage_id FROM voyage_matiere WHERE id = ?)",
                Timestamp.valueOf(LocalDateTime.now()), matiereId);
    }

    /** Enregistre l'heure d'arrivée effective au déchargement d'un voyage. */
    public void updateArrivee(Long livraisonId, LocalDateTime arrivee) {
        gapJdbcTemplate.update(
                "UPDATE livraisons SET arrivee_dechargement = ?, modifier_le = ? WHERE id = ?",
                Timestamp.valueOf(arrivee), Timestamp.valueOf(LocalDateTime.now()), livraisonId);
    }

    /** Affecte une localisation (lat/lng/rayon) à un chantier (projet GAP). */
    public void updateChantierGeo(Long projetId, Double latitude, Double longitude, Integer rayonMetres) {
        gapJdbcTemplate.update(
                "UPDATE projet SET latitude = ?, longitude = ?, rayon_metres = ?, modifier_le = ? WHERE id = ?",
                latitude, longitude, rayonMetres, Timestamp.valueOf(LocalDateTime.now()), projetId);
    }

    // ─────────────── MATIÈRES PREMIÈRES d'une livraison ───────────────

    /** Définit le type de contenu de la livraison (ARTICLE / MATIERE_PREMIERE). */
    public void updateTypeLivraison(Long livraisonId, String type) {
        gapJdbcTemplate.update("UPDATE livraisons SET type_livraison = ? WHERE id = ?", type, livraisonId);
    }

    /** Ajoute les lignes de matières premières (Divalto) à une livraison. */
    public void addMatiereLines(Long livraisonId, List<MatiereLigneDTO> matieres, String user) {
        if (matieres == null || matieres.isEmpty()) return;
        String sql = "INSERT INTO detail_livraison_mp " +
                "(id_livraison, ref, designation, quantite, unite, statut_reception, creer_par, creer_le) " +
                "VALUES (?, ?, ?, ?, ?, 'EN_ATTENTE', ?, ?)";
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());
        for (MatiereLigneDTO m : matieres) {
            double q = (m.getQuantite() != null && m.getQuantite() > 0) ? m.getQuantite() : 1.0;
            gapJdbcTemplate.update(sql, livraisonId, m.getRef(), m.getDesignation(), q, m.getUnite(), user, now);
        }
    }

    /** Remplace les lignes de matières premières d'une livraison. */
    public void replaceMatiereLines(Long livraisonId, List<MatiereLigneDTO> matieres, String user) {
        gapJdbcTemplate.update("DELETE FROM detail_livraison_mp WHERE id_livraison = ?", livraisonId);
        addMatiereLines(livraisonId, matieres, user);
    }

    /** Lignes de matières premières d'une livraison. */
    public List<MatierePremiereDTO> getMatiereLines(Long livraisonId) {
        return gapJdbcTemplate.query(
                "SELECT id, ref, designation, quantite, unite FROM detail_livraison_mp WHERE id_livraison = ? ORDER BY id",
                (rs, i) -> {
                    MatierePremiereDTO dto = new MatierePremiereDTO();
                    dto.setId(rs.getLong("id"));
                    dto.setReference(rs.getString("ref"));
                    dto.setDesignation(rs.getString("designation"));
                    dto.setQuantite(rs.getDouble("quantite"));
                    dto.setUnite(rs.getString("unite"));
                    return dto;
                }, livraisonId);
    }

    // ─────────────── VOYAGE CONTENEUR (regroupe 1..N livraisons) ───────────────

    /** Crée un voyage conteneur (chauffeur + heures affectés ici) et renvoie son id. */
    public Long createVoyageConteneur(Long chauffeurId, LocalDateTime chargement,
                                      LocalDateTime dechargement, String user) {
        String sql = "INSERT INTO voyage (date_voyage, id_chauffeur, date_chargement, date_dechargement, " +
                "statut, creer_par, creer_le) VALUES (?, ?, ?, ?, 'EN_COURS', ?, ?)";
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());
        KeyHolder kh = new GeneratedKeyHolder();
        gapJdbcTemplate.update(con -> {
            PreparedStatement ps = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setTimestamp(1, now);
            if (chauffeurId != null) ps.setLong(2, chauffeurId); else ps.setNull(2, Types.BIGINT);
            if (chargement != null) ps.setTimestamp(3, Timestamp.valueOf(chargement)); else ps.setNull(3, Types.TIMESTAMP);
            if (dechargement != null) ps.setTimestamp(4, Timestamp.valueOf(dechargement)); else ps.setNull(4, Types.TIMESTAMP);
            ps.setString(5, user);
            ps.setTimestamp(6, now);
            return ps;
        }, kh);
        Number key = kh.getKey();
        return key != null ? key.longValue() : null;
    }

    /** Liste des voyages conteneurs (en cours par défaut, ou archivés). */
    public List<VoyageConteneurDTO> getVoyagesConteneurs(boolean archives) {
        return getVoyagesConteneurs(archives, null);
    }

    /** Voyages conteneurs, optionnellement filtrés par chauffeur (app mobile). */
    public List<VoyageConteneurDTO> getVoyagesConteneurs(boolean archives, Long chauffeurId) {
        return getVoyagesConteneurs(archives, chauffeurId, false);
    }

    /**
     * Voyages conteneurs. Si {@code tous} = true → historique complet (en cours + archivés),
     * sinon filtré par {@code archives}. Optionnellement filtré par chauffeur.
     */
    public List<VoyageConteneurDTO> getVoyagesConteneurs(boolean archives, Long chauffeurId, boolean tous) {
        String filtre = tous
                ? "WHERE 1 = 1 "
                : (archives
                    ? "WHERE v.statut = 'ARCHIVE' "
                    : "WHERE (v.statut IS NULL OR v.statut <> 'ARCHIVE') ");
        if (chauffeurId != null) filtre += "AND v.id_chauffeur = ? ";
        String sql = "SELECT v.id, v.date_voyage, v.id_chauffeur, ch.nom AS ch_nom, ch.prenom AS ch_prenom, " +
                "v.statut, v.force_code, v.date_chargement, v.date_dechargement, " +
                "v.real_chargement, v.real_dechargement, v.local_nom, v.local_lat, v.local_lng, v.local_rayon, " +
                "(SELECT COUNT(*) FROM livraisons l WHERE l.voyage_id = v.id) AS nb_livraisons, " +
                "(SELECT COUNT(*) FROM voyage_matiere vm WHERE vm.voyage_id = v.id) AS nb_matieres " +
                "FROM voyage v LEFT JOIN chauffeur ch ON v.id_chauffeur = ch.id " +
                filtre + "ORDER BY v.id DESC";
        return chauffeurId != null
                ? gapJdbcTemplate.query(sql, CONTENEUR_MAPPER, chauffeurId)
                : gapJdbcTemplate.query(sql, CONTENEUR_MAPPER);
    }

    /** Association voyage conteneur -> chauffeur (id + nom), pour le suivi des trajets. */
    public List<com.agileo.transport.Dtos.response.VoyageChauffeurDTO> getVoyageChauffeurs() {
        String sql = "SELECT v.id, v.id_chauffeur, ch.nom AS ch_nom, ch.prenom AS ch_prenom " +
                "FROM voyage v LEFT JOIN chauffeur ch ON v.id_chauffeur = ch.id";
        return gapJdbcTemplate.query(sql, (rs, i) -> {
            com.agileo.transport.Dtos.response.VoyageChauffeurDTO d =
                    new com.agileo.transport.Dtos.response.VoyageChauffeurDTO();
            d.setVoyageId(rs.getLong("id"));
            long ci = rs.getLong("id_chauffeur"); d.setChauffeurId(rs.wasNull() ? null : ci);
            String nom = rs.getString("ch_nom");
            String prenom = rs.getString("ch_prenom");
            String label = ((prenom != null ? prenom : "") + " " + (nom != null ? nom : "")).trim();
            d.setChauffeur(label.isEmpty() ? null : label);
            return d;
        });
    }

    /** Archive un voyage (par clic). */
    public void archiverVoyageConteneur(Long voyageId) {
        gapJdbcTemplate.update(
                "UPDATE voyage SET statut = 'ARCHIVE', modifier_le = ? WHERE id = ?",
                Timestamp.valueOf(LocalDateTime.now()), voyageId);
    }

    /**
     * Annule un voyage conteneur. Lance une IllegalStateException si le voyage est
     * déjà archivé ou annulé (le contrôleur convertit en 409 CONFLICT).
     */
    public void annulerVoyageConteneur(Long voyageId) {
        List<Map<String, Object>> rows = gapJdbcTemplate.queryForList(
                "SELECT statut FROM voyage WHERE id = ?", voyageId);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Voyage conteneur introuvable : " + voyageId);
        }
        String statut = (String) rows.get(0).get("statut");
        if ("ARCHIVE".equals(statut) || "ANNULE".equals(statut)) {
            throw new IllegalStateException("Le voyage ne peut pas être annulé (statut actuel : " + statut + ").");
        }
        gapJdbcTemplate.update(
                "UPDATE voyage SET statut = 'ANNULE', modifier_le = ? WHERE id = ?",
                Timestamp.valueOf(LocalDateTime.now()), voyageId);
    }

    /**
     * Annule une livraison GAP (detail_livraison → statut ANNULE sur l'en-tête).
     * Lance une IllegalStateException si la livraison est déjà scannée.
     */
    public void annulerLivraison(Long livraisonId) {
        if (isLivraisonScannee(livraisonId)) {
            throw new IllegalStateException("Livraison déjà scannée : annulation impossible.");
        }
        gapJdbcTemplate.update(
                "UPDATE livraisons SET statut_reception = 'ANNULE', modifier_le = ? WHERE id = ?",
                Timestamp.valueOf(LocalDateTime.now()), livraisonId);
    }

    /** Archive automatiquement les voyages déchargés depuis plus de 24 h. Renvoie le nb archivés. */
    public int archiverVoyagesLivresAuto() {
        return gapJdbcTemplate.update(
                "UPDATE voyage SET statut = 'ARCHIVE', modifier_le = ? " +
                        "WHERE (statut IS NULL OR statut <> 'ARCHIVE') " +
                        "AND real_dechargement IS NOT NULL AND real_dechargement < ?",
                Timestamp.valueOf(LocalDateTime.now()),
                Timestamp.valueOf(LocalDateTime.now().minusHours(24)));
    }

    /** Met à jour le chauffeur et les heures d'un voyage conteneur. */
    public void updateVoyageConteneur(Long voyageId, Long chauffeurId, LocalDateTime chargement,
                                      LocalDateTime dechargement, String user) {
        gapJdbcTemplate.update(
                "UPDATE voyage SET id_chauffeur = ?, date_chargement = ?, date_dechargement = ?, " +
                        "modifier_par = ?, modifier_le = ? WHERE id = ?",
                chauffeurId,
                chargement != null ? Timestamp.valueOf(chargement) : null,
                dechargement != null ? Timestamp.valueOf(dechargement) : null,
                user, Timestamp.valueOf(LocalDateTime.now()), voyageId);
        // Le chauffeur se gère au niveau du voyage : on le propage à ses livraisons.
        if (chauffeurId != null) {
            gapJdbcTemplate.update(
                    "UPDATE livraisons SET id_chauffeur = ?, modifier_le = ? WHERE voyage_id = ?",
                    chauffeurId, Timestamp.valueOf(LocalDateTime.now()), voyageId);
        }
    }

    /**
     * Définit la liste des livraisons rattachées à un voyage : on détache d'abord toutes
     * celles déjà liées, puis on rattache la nouvelle sélection.
     */
    public void setLivraisonsDuVoyage(Long voyageId, List<Long> livraisonIds) {
        setLivraisonsDuVoyage(voyageId, livraisonIds, null);
    }

    /**
     * Définit la liste des livraisons rattachées à un voyage et, si {@code chauffeurId}
     * est fourni, force le chauffeur de chaque livraison rattachée à celui du voyage
     * (le chauffeur se gère au niveau du voyage, pas de la livraison GAP).
     */
    public void setLivraisonsDuVoyage(Long voyageId, List<Long> livraisonIds, Long chauffeurId) {
        // Livraisons déjà rattachées à CE voyage avant modification : on préserve leur scan.
        List<Long> dejaRattachees = gapJdbcTemplate.queryForList(
                "SELECT id FROM livraisons WHERE voyage_id = ?", Long.class, voyageId);
        gapJdbcTemplate.update("UPDATE livraisons SET voyage_id = NULL WHERE voyage_id = ?", voyageId);
        if (livraisonIds != null) {
            Timestamp now = Timestamp.valueOf(LocalDateTime.now());
            for (Long id : livraisonIds) {
                if (chauffeurId != null) {
                    gapJdbcTemplate.update(
                            "UPDATE livraisons SET voyage_id = ?, id_chauffeur = ?, modifier_le = ? WHERE id = ?",
                            voyageId, chauffeurId, now, id);
                } else {
                    gapJdbcTemplate.update(
                            "UPDATE livraisons SET voyage_id = ?, modifier_le = ? WHERE id = ?", voyageId, now, id);
                }
                // Une livraison nouvellement rattachée a pu être scannée dans un AUTRE voyage :
                // on repart d'un statut de scan vierge pour ce voyage (sans toucher au contenu).
                if (!dejaRattachees.contains(id)) {
                    reinitialiserScanLivraison(id, now);
                }
            }
        }
    }

    /** Remet à zéro le statut de scan d'une livraison (en-tête + lignes detail_livraison). */
    private void reinitialiserScanLivraison(Long livraisonId, Timestamp now) {
        gapJdbcTemplate.update(
                "UPDATE livraisons SET statut_reception = NULL, modifier_le = ? WHERE id = ?", now, livraisonId);
        gapJdbcTemplate.update(
                "UPDATE detail_livraison SET statut_reception = NULL, modifier_le = ? WHERE id_livraison = ?",
                now, livraisonId);
    }

    /** Détache une livraison de son voyage (voyage_id = NULL). La livraison n'est pas supprimée. */
    public void detacherLivraison(Long livraisonId) {
        gapJdbcTemplate.update(
                "UPDATE livraisons SET voyage_id = NULL, modifier_le = ? WHERE id = ?",
                Timestamp.valueOf(LocalDateTime.now()), livraisonId);
    }

    /**
     * Livraisons assignables à un voyage : celles sans voyage (voyage_id IS NULL)
     * ou déjà rattachées à CE voyage (pour les pré-cocher dans l'écran).
     */
    public List<GapVoyageDTO> getLivraisonsAssignables(Long voyageId) {
        String sql = "SELECT l.id, l.date_livraison, l.date_chargement, l.date_dechargement, l.id_chauffeur, " +
                "ch.nom AS ch_nom, ch.prenom AS ch_prenom, " +
                "l.id_projet, p.code AS projet_code, p.designation AS projet_designation, " +
                "l.id_atelier, ate.designation AS atelier_designation, " +
                "l.statut_reception, l.imprime, l.force_code, l.bl, l.bl_fichier, l.bl_content_type, " +
                "p.latitude AS dest_lat, p.longitude AS dest_lng, p.rayon_metres AS dest_rayon, l.voyage_id, " +
                "l.arrivee_dechargement, " +
                "(SELECT COUNT(*) FROM detail_livraison dl WHERE dl.id_livraison = l.id) AS nb_articles " +
                "FROM livraisons l " +
                "LEFT JOIN chauffeur ch  ON l.id_chauffeur = ch.id " +
                "LEFT JOIN projet    p   ON l.id_projet    = p.id " +
                "LEFT JOIN ateliers  ate ON l.id_atelier   = ate.id " +
                "WHERE l.voyage_id IS NULL OR l.voyage_id = ? " +
                "ORDER BY l.date_livraison DESC";
        return gapJdbcTemplate.query(sql, VOYAGE_MAPPER, voyageId);
    }

    /**
     * Livraisons libres : non encore rattachées à un voyage (voyage_id IS NULL)
     * et dont le statut n'est pas LIVRE, CHARGE ou ARCHIVE.
     * Utilisé lors de la création d'un nouveau voyage (id = 0).
     */
    public List<GapVoyageDTO> getLivraisonsLibres() {
        String sql = "SELECT l.id, l.date_livraison, l.date_chargement, l.date_dechargement, l.id_chauffeur, " +
                "ch.nom AS ch_nom, ch.prenom AS ch_prenom, " +
                "l.id_projet, p.code AS projet_code, p.designation AS projet_designation, " +
                "l.id_atelier, ate.designation AS atelier_designation, " +
                "l.statut_reception, l.imprime, l.force_code, l.bl, l.bl_fichier, l.bl_content_type, " +
                "p.latitude AS dest_lat, p.longitude AS dest_lng, p.rayon_metres AS dest_rayon, l.voyage_id, " +
                "l.arrivee_dechargement, " +
                "(SELECT COUNT(*) FROM detail_livraison dl WHERE dl.id_livraison = l.id) AS nb_articles " +
                "FROM livraisons l " +
                "LEFT JOIN chauffeur ch  ON l.id_chauffeur = ch.id " +
                "LEFT JOIN projet    p   ON l.id_projet    = p.id " +
                "LEFT JOIN ateliers  ate ON l.id_atelier   = ate.id " +
                "WHERE l.voyage_id IS NULL " +
                "AND (l.statut_reception IS NULL " +
                "     OR l.statut_reception NOT IN ('LIVRE', 'CHARGE', 'ARCHIVE')) " +
                "ORDER BY l.id ASC";
        return gapJdbcTemplate.query(sql, VOYAGE_MAPPER);
    }

    /** Livraisons rattachées à un voyage conteneur. */
    public List<GapVoyageDTO> getLivraisonsDuVoyage(Long voyageId) {
        String sql = "SELECT l.id, l.date_livraison, l.date_chargement, l.date_dechargement, l.id_chauffeur, " +
                "ch.nom AS ch_nom, ch.prenom AS ch_prenom, " +
                "l.id_projet, p.code AS projet_code, p.designation AS projet_designation, " +
                "l.id_atelier, ate.designation AS atelier_designation, " +
                "l.statut_reception, l.imprime, l.force_code, l.bl, l.bl_fichier, l.bl_content_type, " +
                "p.latitude AS dest_lat, p.longitude AS dest_lng, p.rayon_metres AS dest_rayon, l.voyage_id, " +
                "l.arrivee_dechargement, " +
                "(SELECT COUNT(*) FROM detail_livraison dl WHERE dl.id_livraison = l.id) AS nb_articles " +
                "FROM livraisons l " +
                "LEFT JOIN chauffeur ch  ON l.id_chauffeur = ch.id " +
                "LEFT JOIN projet    p   ON l.id_projet    = p.id " +
                "LEFT JOIN ateliers  ate ON l.id_atelier   = ate.id " +
                "WHERE l.voyage_id = ? ORDER BY l.date_livraison DESC";
        return gapJdbcTemplate.query(sql, VOYAGE_MAPPER, voyageId);
    }

    /** Remplace les lignes de matières premières rattachées directement à un voyage. */
    public void saveVoyageMatieres(Long voyageId, List<VoyageMatiereLigneDTO> matieres, String user) {
        gapJdbcTemplate.update("DELETE FROM voyage_matiere WHERE voyage_id = ?", voyageId);
        if (matieres == null || matieres.isEmpty()) return;
        String sql = "INSERT INTO voyage_matiere " +
                "(voyage_id, projet, cdno, ref, designation, of_no, quantite, unite, " +
                "piece_fournisseur, qte_commande, statut, source, depot, " +
                "date_livraison, date_chargement, date_dechargement, creer_par, creer_le) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EN_ATTENTE', ?, ?, ?, ?, ?, ?, ?)";
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());
        for (VoyageMatiereLigneDTO m : matieres) {
            double q = (m.getQuantite() != null && m.getQuantite() > 0) ? m.getQuantite() : 1.0;
            Timestamp dl = m.getDateLivraison() != null ? Timestamp.valueOf(m.getDateLivraison().atStartOfDay()) : null;
            Timestamp dc = m.getDateChargement() != null ? Timestamp.valueOf(m.getDateChargement()) : null;
            Timestamp dd = m.getDateDechargement() != null ? Timestamp.valueOf(m.getDateDechargement()) : null;
            // Origine de la ligne : STOCK (vue Article_en_stock, lecture seule) ou MATIERE (Divalto) par défaut.
            String source = (m.getSource() != null && !m.getSource().isBlank()) ? m.getSource().trim() : "MATIERE";
            gapJdbcTemplate.update(sql, voyageId, m.getProjet(), m.getCdno(), m.getRef(),
                    m.getDesignation(), m.getOf(), q, m.getUnite(),
                    m.getPieceFournisseur(), m.getQteCommande(), source, m.getDepot(), dl, dc, dd, user, now);
        }
    }

    /** Clôture / rouvre une ligne de matière première (statut stocké localement, sans impact ERP). */
    public void updateVoyageMatiereStatut(Long matiereId, String statut) {
        if (isMatiereDeVoyageAnnule(matiereId)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "Voyage annulé : opération impossible.");
        }
        gapJdbcTemplate.update(
                "UPDATE voyage_matiere SET statut = ?, modifier_le = ? WHERE id = ?",
                statut, Timestamp.valueOf(LocalDateTime.now()), matiereId);
        // 1er scan de chargement d'une MP → démarre le chargement du voyage (et son trajet).
        if ("CHARGE".equals(statut)) marquerRealChargementParMatiere(matiereId);
        // Livraison d'une MP/stock → si tout le voyage est livré, marque le déchargement réel.
        if ("LIVRE".equals(statut)) {
            List<Long> vids = gapJdbcTemplate.queryForList(
                    "SELECT voyage_id FROM voyage_matiere WHERE id = ?", Long.class, matiereId);
            if (!vids.isEmpty()) majDechargementVoyageConteneur(vids.get(0));
        }
    }

    /** Applique les dates prévues (chargement/déchargement) sur les livraisons rattachées. */
    public void applyLivraisonDates(List<LivraisonDateDTO> dates) {
        if (dates == null) return;
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());
        for (LivraisonDateDTO d : dates) {
            if (d.getId() == null) continue;
            gapJdbcTemplate.update(
                    "UPDATE livraisons SET date_chargement = ?, date_dechargement = ?, " +
                            "date_livraison = COALESCE(?, date_livraison), modifier_le = ? WHERE id = ?",
                    d.getChargement() != null ? Timestamp.valueOf(d.getChargement()) : null,
                    d.getDechargement() != null ? Timestamp.valueOf(d.getDechargement()) : null,
                    d.getChargement() != null ? Timestamp.valueOf(d.getChargement()) : null,
                    now, d.getId());
        }
    }

    /** Lignes de matières premières d'un voyage (table voyage_matiere). */
    public List<MatierePremiereDTO> getVoyageMatieres(Long voyageId) {
        return gapJdbcTemplate.query(
                "SELECT id, projet, cdno, ref, designation, of_no, quantite, unite, " +
                        "piece_fournisseur, qte_commande, statut, source, depot, date_chargement, date_dechargement " +
                        "FROM voyage_matiere WHERE voyage_id = ? ORDER BY id",
                (rs, i) -> {
                    MatierePremiereDTO d = new MatierePremiereDTO();
                    d.setId(rs.getLong("id"));
                    d.setProjet(rs.getString("projet"));
                    long cd = rs.getLong("cdno"); d.setCdno(rs.wasNull() ? null : cd);
                    d.setReference(rs.getString("ref"));
                    d.setDesignation(rs.getString("designation"));
                    d.setOf(rs.getString("of_no"));
                    d.setQuantite(rs.getDouble("quantite"));
                    d.setUnite(rs.getString("unite"));
                    d.setPieceFournisseur(rs.getString("piece_fournisseur"));
                    double qc = rs.getDouble("qte_commande"); d.setQteCommande(rs.wasNull() ? null : qc);
                    d.setStatut(rs.getString("statut"));
                    d.setSource(rs.getString("source"));
                    d.setDepot(rs.getString("depot"));
                    Timestamp dc = rs.getTimestamp("date_chargement");
                    d.setDateChargement(dc != null ? dc.toLocalDateTime() : null);
                    Timestamp dd = rs.getTimestamp("date_dechargement");
                    d.setDateDechargement(dd != null ? dd.toLocalDateTime() : null);
                    return d;
                }, voyageId);
    }

    // ─────────────── DÉPÔTS (locaux de départ) ───────────────

    private static final RowMapper<DepotDTO> DEPOT_MAPPER = (rs, i) -> {
        DepotDTO d = new DepotDTO();
        d.setId(rs.getLong("id"));
        d.setNom(rs.getString("nom"));
        double lat = rs.getDouble("latitude"); d.setLatitude(rs.wasNull() ? null : lat);
        double lng = rs.getDouble("longitude"); d.setLongitude(rs.wasNull() ? null : lng);
        int r = rs.getInt("rayon"); d.setRayon(rs.wasNull() ? null : r);
        return d;
    };

    public List<DepotDTO> getDepots() {
        return gapJdbcTemplate.query("SELECT id, nom, latitude, longitude, rayon FROM depot ORDER BY nom", DEPOT_MAPPER);
    }

    public Long createDepot(String nom, Double lat, Double lng, Integer rayon) {
        String sql = "INSERT INTO depot (nom, latitude, longitude, rayon, creer_le) VALUES (?, ?, ?, ?, ?)";
        KeyHolder kh = new GeneratedKeyHolder();
        gapJdbcTemplate.update(con -> {
            PreparedStatement ps = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, nom);
            if (lat != null) ps.setDouble(2, lat); else ps.setNull(2, Types.DOUBLE);
            if (lng != null) ps.setDouble(3, lng); else ps.setNull(3, Types.DOUBLE);
            if (rayon != null) ps.setInt(4, rayon); else ps.setNull(4, Types.INTEGER);
            ps.setTimestamp(5, Timestamp.valueOf(LocalDateTime.now()));
            return ps;
        }, kh);
        Number k = kh.getKey();
        return k != null ? k.longValue() : null;
    }

    public void updateDepot(Long id, String nom, Double lat, Double lng, Integer rayon) {
        gapJdbcTemplate.update("UPDATE depot SET nom = ?, latitude = ?, longitude = ?, rayon = ? WHERE id = ?",
                nom, lat, lng, rayon, id);
    }

    public void deleteDepot(Long id) {
        gapJdbcTemplate.update("DELETE FROM depot WHERE id = ?", id);
    }

    /** Met à jour le local de départ (géofence de chargement) d'un voyage. */
    public void updateVoyageLocal(Long voyageId, String nom, Double lat, Double lng, Integer rayon) {
        gapJdbcTemplate.update(
                "UPDATE voyage SET local_nom = ?, local_lat = ?, local_lng = ?, local_rayon = ? WHERE id = ?",
                nom, lat, lng, rayon, voyageId);
    }

    /** Supprime un voyage conteneur : détache ses livraisons, supprime ses MP, puis le voyage. */
    public void deleteVoyageConteneur(Long voyageId) {
        gapJdbcTemplate.update("UPDATE livraisons SET voyage_id = NULL WHERE voyage_id = ?", voyageId);
        gapJdbcTemplate.update("DELETE FROM voyage_matiere WHERE voyage_id = ?", voyageId);
        gapJdbcTemplate.update("DELETE FROM voyage WHERE id = ?", voyageId);
    }

    /** Ids des livraisons d'un voyage (pour agréger leurs positions GPS). */
    public List<Long> getLivraisonIdsDuVoyage(Long voyageId) {
        return gapJdbcTemplate.queryForList(
                "SELECT id FROM livraisons WHERE voyage_id = ?", Long.class, voyageId);
    }

    /**
     * Scan groupé : marque toutes les lignes (detail_livraison) des livraisons d'un voyage
     * selon la phase. Renvoie le nombre de lignes mises à jour.
     */
    /**
     * Scanne toute la LIGNE : tous les OF du MÊME chantier dans le MÊME voyage que la
     * livraison scannée (1 ligne = 1 chantier). Renvoie le nb de lignes detail mises à jour.
     */
    public int scanAllDetailsForLivraison(Long livraisonId, String phase) {
        if (isLivraisonAnnulee(livraisonId)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "Livraison annulée : scan impossible.");
        }
        String statut = "CHARGEMENT".equalsIgnoreCase(phase) ? "SCANNE_CHARGEMENT" : "SCANNE_LIVRAISON";
        boolean chargement = "CHARGEMENT".equalsIgnoreCase(phase);
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());

        // Tous les OF du même chantier (id_projet) dans le même voyage que la livraison scannée.
        List<Long> ids = gapJdbcTemplate.queryForList(
                "SELECT l2.id FROM livraisons l1 JOIN livraisons l2 " +
                        "ON l2.voyage_id = l1.voyage_id AND l2.id_projet = l1.id_projet " +
                        "WHERE l1.id = ? AND l1.voyage_id IS NOT NULL", Long.class, livraisonId);
        if (ids.isEmpty()) ids = java.util.Collections.singletonList(livraisonId);

        int n = 0;
        for (Long id : ids) {
            n += gapJdbcTemplate.update(
                    "UPDATE detail_livraison SET statut_reception = ?, modifier_le = ? WHERE id_livraison = ?",
                    statut, now, id);
            // En livraison, on NE marque PAS 'LIVRE' au scan (LIVRE = BL fourni) : en-tête au moins 'CHARGE'.
            gapJdbcTemplate.update(
                    "UPDATE livraisons SET statut_reception = 'CHARGE', modifier_le = ? " +
                            "WHERE id = ? AND (statut_reception IS NULL OR statut_reception <> 'LIVRE')",
                    now, id);
        }

        // Matières premières du chantier de cette ligne : même phase que les articles.
        gapJdbcTemplate.update(
                "UPDATE vm SET vm.statut = ?, vm.modifier_le = ? " +
                        "FROM voyage_matiere vm " +
                        "JOIN livraisons l ON vm.voyage_id = l.voyage_id " +
                        "LEFT JOIN projet p ON l.id_projet = p.id " +
                        "WHERE l.id = ? AND vm.projet = p.code" +
                        (chargement ? " AND (vm.statut IS NULL OR vm.statut <> 'LIVRE')" : ""),
                chargement ? "CHARGE" : "LIVRE", now, livraisonId);
        // 1er scan de chargement de la ligne → démarre le chargement du voyage (et son trajet).
        if (chargement) marquerRealChargementParLivraison(livraisonId);
        return n;
    }

    public int scanAllDetailsForVoyage(Long voyageId, String phase) {
        if (isVoyageConteneurAnnule(voyageId)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "Voyage annulé : scan impossible.");
        }
        String statut = "CHARGEMENT".equalsIgnoreCase(phase) ? "SCANNE_CHARGEMENT" : "SCANNE_LIVRAISON";
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());
        int n = gapJdbcTemplate.update(
                "UPDATE dl SET dl.statut_reception = ?, dl.modifier_le = ? " +
                        "FROM detail_livraison dl JOIN livraisons l ON dl.id_livraison = l.id " +
                        "WHERE l.voyage_id = ?", statut, now, voyageId);
        // Matières premières du voyage : même phase que les articles (chargé puis livré).
        if ("CHARGEMENT".equalsIgnoreCase(phase)) {
            gapJdbcTemplate.update(
                    "UPDATE voyage_matiere SET statut = 'CHARGE', modifier_le = ? " +
                            "WHERE voyage_id = ? AND (statut IS NULL OR statut <> 'LIVRE')",
                    now, voyageId);
        } else {
            gapJdbcTemplate.update(
                    "UPDATE voyage_matiere SET statut = 'LIVRE', modifier_le = ? WHERE voyage_id = ?",
                    now, voyageId);
        }
        // Passe les livraisons du voyage à 'CHARGE' au chargement (sauf déjà 'LIVRE')
        if ("CHARGEMENT".equalsIgnoreCase(phase)) {
            gapJdbcTemplate.update(
                    "UPDATE livraisons SET statut_reception = 'CHARGE', modifier_le = ? " +
                            "WHERE voyage_id = ? AND (statut_reception IS NULL OR statut_reception <> 'LIVRE')",
                    now, voyageId);
            // Heure réelle de chargement (première fois seulement)
            gapJdbcTemplate.update(
                    "UPDATE voyage SET real_chargement = COALESCE(real_chargement, ?) WHERE id = ?", now, voyageId);
        } else {
            // En livraison, on NE marque PAS le voyage livré au scan : il le devient quand
            // toutes ses lignes ont leur BL (voir majDechargementVoyageSiComplet). On garde
            // les en-têtes au moins à 'CHARGE'.
            gapJdbcTemplate.update(
                    "UPDATE livraisons SET statut_reception = 'CHARGE', modifier_le = ? " +
                            "WHERE voyage_id = ? AND (statut_reception IS NULL OR statut_reception <> 'LIVRE')",
                    now, voyageId);
            // Voyage sans livraison à BL (matières/stock seuls) → le scan livraison le termine :
            // si toutes ses lignes voyage_matiere sont LIVRE et aucune livraison en attente.
            majDechargementVoyageConteneur(voyageId);
        }
        return n;
    }

    /** Indicateurs du tableau de bord (sans filtre = aujourd'hui, tous chantiers/chauffeurs). */
    public DashboardStatsDTO getDashboardStats() {
        return getDashboardStats(null, null, null, null);
    }

    /**
     * Indicateurs du tableau de bord administrateur, calculés à la volée depuis GAP,
     * filtrables par chantier (projet), chauffeur et plage de dates.
     * Sans plage de dates → période = aujourd'hui. Tolérant aux erreurs.
     */
    public DashboardStatsDTO getDashboardStats(Long projetId, Long chauffeurId,
                                               java.time.LocalDate debut, java.time.LocalDate fin) {
        DashboardStatsDTO s = new DashboardStatsDTO();

        boolean rangeDonne = debut != null && fin != null;

        // Filtre chantier/chauffeur (hors date) commun à la table livraisons (alias l)
        StringBuilder cf = new StringBuilder(" AND (l.statut_reception IS NULL OR l.statut_reception <> 'ARCHIVE') ");
        java.util.List<Object> cp = new java.util.ArrayList<>();
        if (projetId != null)    { cf.append(" AND l.id_projet = ? ");    cp.add(projetId); }
        if (chauffeurId != null) { cf.append(" AND l.id_chauffeur = ? "); cp.add(chauffeurId); }

        // Clause « période » = plage de dates si fournie, sinon aujourd'hui
        StringBuilder pf = new StringBuilder();
        java.util.List<Object> pp = new java.util.ArrayList<>();
        if (rangeDonne) {
            pf.append(" AND CAST(l.date_livraison AS DATE) BETWEEN ? AND ? ");
            pp.add(java.sql.Date.valueOf(debut));
            pp.add(java.sql.Date.valueOf(fin));
        } else {
            pf.append(" AND CAST(l.date_livraison AS DATE) = CAST(GETDATE() AS DATE) ");
        }
        pf.append(cf);
        pp.addAll(cp);
        String periode = pf.toString();
        Object[] periodeArgs = pp.toArray();

        // Synthèse de la période (un seul passage)
        try {
            gapJdbcTemplate.query(
                "SELECT COUNT(*) AS total, " +
                "  SUM(CASE WHEN l.statut_reception = 'LIVRE' THEN 1 ELSE 0 END) AS livres, " +
                "  SUM(CASE WHEN l.statut_reception IS NULL OR l.statut_reception = 'EN_ATTENTE' THEN 1 ELSE 0 END) AS attente, " +
                "  COUNT(DISTINCT l.id_projet) AS chantiers, " +
                "  COUNT(DISTINCT l.id_chauffeur) AS chauffeurs " +
                "FROM livraisons l WHERE 1=1 " + periode,
                rs -> {
                    int total = rs.getInt("total");
                    int livres = rs.getInt("livres");
                    int attente = rs.getInt("attente");
                    s.setVoyagesAujourdhui(total);
                    s.setLivresAujourdhui(livres);
                    s.setEnAttenteAujourdhui(attente);
                    s.setEnCoursAujourdhui(Math.max(0, total - livres - attente));
                    s.setChantiersActifs(rs.getInt("chantiers"));
                    s.setChauffeursActifs(rs.getInt("chauffeurs"));
                }, periodeArgs);
        } catch (Exception ignore) { /* GAP indisponible : compteurs à 0 */ }

        s.setArticlesAujourdhui(intQuery(
            "SELECT COUNT(*) FROM detail_livraison dl JOIN livraisons l ON dl.id_livraison = l.id " +
            "WHERE 1=1 " + periode, periodeArgs));

        // Total (toutes dates) pour le chantier/chauffeur filtré
        s.setVoyagesTotal(intQuery(
            "SELECT COUNT(*) FROM livraisons l WHERE 1=1 " + cf, cp.toArray()));

        // Durée moyenne réelle chargement → déchargement (minutes), filtrée
        try {
            StringBuilder dw = new StringBuilder(
                " WHERE v.real_chargement IS NOT NULL AND v.real_dechargement IS NOT NULL " +
                " AND v.real_dechargement >= v.real_chargement ");
            java.util.List<Object> dp = new java.util.ArrayList<>();
            if (rangeDonne) {
                dw.append(" AND CAST(v.real_chargement AS DATE) BETWEEN ? AND ? ");
                dp.add(java.sql.Date.valueOf(debut));
                dp.add(java.sql.Date.valueOf(fin));
            }
            if (chauffeurId != null) { dw.append(" AND v.id_chauffeur = ? "); dp.add(chauffeurId); }
            if (projetId != null) {
                dw.append(" AND EXISTS (SELECT 1 FROM livraisons l WHERE l.voyage_id = v.id AND l.id_projet = ?) ");
                dp.add(projetId);
            }
            Double moy = gapJdbcTemplate.queryForObject(
                "SELECT AVG(CAST(DATEDIFF(MINUTE, v.real_chargement, v.real_dechargement) AS FLOAT)) " +
                "FROM voyage v" + dw, Double.class, dp.toArray());
            s.setDureeMoyenneMinutes(moy != null ? (int) Math.round(moy) : null);
        } catch (Exception ignore) { s.setDureeMoyenneMinutes(null); }

        // Répartition par chantier (sur la période)
        try {
            s.setParChantier(gapJdbcTemplate.query(
                "SELECT TOP 20 COALESCE(p.designation, '—') AS chantier, COUNT(*) AS total, " +
                "  SUM(CASE WHEN l.statut_reception = 'LIVRE' THEN 1 ELSE 0 END) AS livres " +
                "FROM livraisons l LEFT JOIN projet p ON l.id_projet = p.id " +
                "WHERE 1=1 " + periode + " " +
                "GROUP BY p.designation ORDER BY COUNT(*) DESC",
                (rs, i) -> new DashboardStatsDTO.ChantierStat(
                    rs.getString("chantier"), rs.getInt("total"), rs.getInt("livres")),
                periodeArgs));
        } catch (Exception ignore) { s.setParChantier(java.util.Collections.emptyList()); }

        // Répartition par jour : sur la plage si fournie, sinon 7 derniers jours
        try {
            StringBuilder jw = new StringBuilder();
            java.util.List<Object> jp = new java.util.ArrayList<>();
            if (rangeDonne) {
                jw.append(" AND CAST(l.date_livraison AS DATE) BETWEEN ? AND ? ");
                jp.add(java.sql.Date.valueOf(debut));
                jp.add(java.sql.Date.valueOf(fin));
            } else {
                jw.append(" AND l.date_livraison >= CAST(DATEADD(DAY, -6, GETDATE()) AS DATE) ");
            }
            jw.append(cf);
            jp.addAll(cp);
            s.setParJour(gapJdbcTemplate.query(
                "SELECT CONVERT(varchar(10), l.date_livraison, 23) AS jour, COUNT(*) AS total, " +
                "  SUM(CASE WHEN l.statut_reception = 'LIVRE' THEN 1 ELSE 0 END) AS livres " +
                "FROM livraisons l WHERE 1=1 " + jw + " " +
                "GROUP BY CONVERT(varchar(10), l.date_livraison, 23) ORDER BY jour",
                (rs, i) -> new DashboardStatsDTO.JourStat(
                    rs.getString("jour"), rs.getInt("total"), rs.getInt("livres")),
                jp.toArray()));
        } catch (Exception ignore) { s.setParJour(java.util.Collections.emptyList()); }

        return s;
    }

    /**
     * Productivité par chauffeur sur la période (livraisons GAP), filtrable
     * chantier / chauffeur / plage de dates. Sans plage → aujourd'hui.
     * Tolérant aux erreurs : renvoie une liste vide si GAP est indisponible.
     */
    public java.util.List<DashboardStatsDTO.ChauffeurStat> getChauffeurStats(
            Long projetId, Long chauffeurId, java.time.LocalDate debut, java.time.LocalDate fin) {

        boolean rangeDonne = debut != null && fin != null;

        // Clause période + filtres commune aux deux sous-requêtes (alias l)
        StringBuilder w = new StringBuilder(
                " AND (l.statut_reception IS NULL OR l.statut_reception <> 'ARCHIVE') ");
        java.util.List<Object> wp = new java.util.ArrayList<>();
        if (rangeDonne) {
            w.append(" AND CAST(l.date_livraison AS DATE) BETWEEN ? AND ? ");
            wp.add(java.sql.Date.valueOf(debut));
            wp.add(java.sql.Date.valueOf(fin));
        } else {
            w.append(" AND CAST(l.date_livraison AS DATE) = CAST(GETDATE() AS DATE) ");
        }
        if (projetId != null)    { w.append(" AND l.id_projet = ? ");    wp.add(projetId); }
        if (chauffeurId != null) { w.append(" AND l.id_chauffeur = ? "); wp.add(chauffeurId); }
        String periode = w.toString();

        // Args : période pour la table livraisons (t) + période pour les articles (a)
        java.util.List<Object> args = new java.util.ArrayList<>();
        args.addAll(wp);  // sous-requête t
        args.addAll(wp);  // sous-requête a

        String sql =
            "SELECT ch.nom, ch.prenom, ch.matricule, " +
            "  t.total, t.livres, t.attente, COALESCE(a.articles, 0) AS articles " +
            "FROM chauffeur ch " +
            "JOIN ( " +
            "  SELECT l.id_chauffeur, COUNT(*) AS total, " +
            "    SUM(CASE WHEN l.statut_reception = 'LIVRE' THEN 1 ELSE 0 END) AS livres, " +
            "    SUM(CASE WHEN l.statut_reception IS NULL OR l.statut_reception = 'EN_ATTENTE' THEN 1 ELSE 0 END) AS attente " +
            "  FROM livraisons l WHERE 1=1 " + periode +
            "  GROUP BY l.id_chauffeur " +
            ") t ON t.id_chauffeur = ch.id " +
            "LEFT JOIN ( " +
            "  SELECT l.id_chauffeur, COUNT(*) AS articles " +
            "  FROM detail_livraison dl JOIN livraisons l ON dl.id_livraison = l.id " +
            "  WHERE 1=1 " + periode +
            "  GROUP BY l.id_chauffeur " +
            ") a ON a.id_chauffeur = ch.id " +
            "ORDER BY t.total DESC";

        try {
            return gapJdbcTemplate.query(sql, (rs, i) -> {
                String prenom = rs.getString("prenom");
                String nom = rs.getString("nom");
                String nomComplet = ((prenom != null ? prenom : "") + " " + (nom != null ? nom : "")).trim();
                Object mat = rs.getObject("matricule");
                return new DashboardStatsDTO.ChauffeurStat(
                        nomComplet.isEmpty() ? "—" : nomComplet,
                        mat != null ? String.valueOf(mat) : "",
                        rs.getInt("total"), rs.getInt("livres"),
                        rs.getInt("attente"), rs.getInt("articles"));
            }, args.toArray());
        } catch (Exception ignore) {
            return java.util.Collections.emptyList();
        }
    }

    /** Compteur entier tolérant aux erreurs (renvoie 0 si la requête échoue). */
    private int intQuery(String sql, Object... params) {
        try {
            Integer n = gapJdbcTemplate.queryForObject(sql, Integer.class, params);
            return n != null ? n : 0;
        } catch (Exception ignore) {
            return 0;
        }
    }
}
