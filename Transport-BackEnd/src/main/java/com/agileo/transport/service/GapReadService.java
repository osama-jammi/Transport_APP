package com.agileo.transport.service;

import com.agileo.transport.Dtos.response.GapArticleDTO;
import com.agileo.transport.Dtos.response.GapChantierDTO;
import com.agileo.transport.Dtos.response.GapChauffeurDTO;
import com.agileo.transport.Dtos.response.GapVoyageArticleDTO;
import com.agileo.transport.Dtos.request.MatiereLigneDTO;
import com.agileo.transport.Dtos.request.VoyageMatiereLigneDTO;
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
        return dto;
    };

    private static final RowMapper<GapVoyageArticleDTO> VOYAGE_ARTICLE_MAPPER = (rs, i) -> {
        GapVoyageArticleDTO dto = new GapVoyageArticleDTO();
        dto.setId(rs.getLong("id"));
        long artId = rs.getLong("id_article");
        dto.setArticleId(rs.wasNull() ? null : artId);
        dto.setDesignation(rs.getString("designation"));
        dto.setNumPrix(rs.getString("num_prix"));
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
        dto.setStatut(rs.getString("statut"));
        dto.setForceCode(rs.getString("force_code"));
        dto.setNbLivraisons(rs.getInt("nb_livraisons"));
        dto.setNbMatieres(rs.getInt("nb_matieres"));
        Timestamp tc = rs.getTimestamp("date_chargement");
        dto.setChargement(tc != null ? tc.toLocalDateTime() : null);
        Timestamp td = rs.getTimestamp("date_dechargement");
        dto.setDechargement(td != null ? td.toLocalDateTime() : null);
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
        String sql = "SELECT id, nom, prenom, matricule, derniere_connexion FROM chauffeur ORDER BY nom, prenom";
        return gapJdbcTemplate.query(sql, CHAUFFEUR_MAPPER);
    }

    /** Un chauffeur GAP par son id (null si absent). */
    public GapChauffeurDTO getChauffeurById(Long id) {
        List<GapChauffeurDTO> list = gapJdbcTemplate.query(
                "SELECT id, nom, prenom, matricule, derniere_connexion FROM chauffeur WHERE id = ?", CHAUFFEUR_MAPPER, id);
        return list.isEmpty() ? null : list.get(0);
    }

    /** Enregistre la dernière connexion mobile d'un chauffeur GAP (scan QR). */
    public void updateChauffeurConnexion(Long chauffeurId) {
        gapJdbcTemplate.update(
                "UPDATE chauffeur SET derniere_connexion = ? WHERE id = ?",
                Timestamp.valueOf(LocalDateTime.now()), chauffeurId);
    }

    /** Tous les chantiers (projets) depuis GAP. */
    public List<GapChantierDTO> getChantiers() {
        String sql = "SELECT id, code, designation, status, latitude, longitude, rayon_metres " +
                "FROM projet ORDER BY designation";
        return gapJdbcTemplate.query(sql, CHANTIER_MAPPER);
    }

    /** Un chantier (projet) GAP par son id. */
    public GapChantierDTO getChantierById(Long id) {
        List<GapChantierDTO> list = gapJdbcTemplate.query(
                "SELECT id, code, designation, status, latitude, longitude, rayon_metres " +
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
        String sql = "SELECT dl.id, dl.id_article, a.designation, a.num_prix, dl.quantite, " +
                "dl.statut_reception, dl.modifier_le, p.designation AS projet " +
                "FROM detail_livraison dl " +
                "LEFT JOIN article    a ON dl.id_article   = a.id " +
                "LEFT JOIN livraisons l ON dl.id_livraison = l.id " +
                "LEFT JOIN projet     p ON l.id_projet     = p.id " +
                "WHERE dl.id_livraison = ? ORDER BY dl.id";
        return gapJdbcTemplate.query(sql, VOYAGE_ARTICLE_MAPPER, livraisonId);
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
        gapJdbcTemplate.update(
                "UPDATE detail_livraison SET statut_reception = ?, modifier_le = ? WHERE id = ?",
                statut, Timestamp.valueOf(LocalDateTime.now()), detailId);
        majStatutLivraison(detailId);
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

    /** Enregistre le code de forçage d'arrivée d'un voyage. */
    public void updateForceCode(Long livraisonId, String code) {
        gapJdbcTemplate.update(
                "UPDATE livraisons SET force_code = ?, modifier_le = ? WHERE id = ?",
                code, Timestamp.valueOf(LocalDateTime.now()), livraisonId);
    }

    /** Enregistre le bon de livraison d'un voyage (fichier + référence) → voyage livré. */
    public void saveBl(Long livraisonId, String reference, String fichier, String contentType) {
        gapJdbcTemplate.update(
                "UPDATE livraisons SET bl = ?, bl_fichier = ?, bl_content_type = ?, " +
                        "statut_reception = 'LIVRE', " +
                        "arrivee_dechargement = COALESCE(arrivee_dechargement, ?), modifier_le = ? " +
                        "WHERE id = ?",
                reference, fichier, contentType,
                Timestamp.valueOf(LocalDateTime.now()), Timestamp.valueOf(LocalDateTime.now()), livraisonId);
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

    /** Liste des voyages conteneurs, avec chauffeur et nombre de livraisons. */
    public List<VoyageConteneurDTO> getVoyagesConteneurs() {
        String sql = "SELECT v.id, v.date_voyage, v.id_chauffeur, ch.nom AS ch_nom, ch.prenom AS ch_prenom, " +
                "v.statut, v.force_code, v.date_chargement, v.date_dechargement, " +
                "(SELECT COUNT(*) FROM livraisons l WHERE l.voyage_id = v.id) AS nb_livraisons, " +
                "(SELECT COUNT(*) FROM voyage_matiere vm WHERE vm.voyage_id = v.id) AS nb_matieres " +
                "FROM voyage v LEFT JOIN chauffeur ch ON v.id_chauffeur = ch.id " +
                "ORDER BY v.id DESC";
        return gapJdbcTemplate.query(sql, CONTENEUR_MAPPER);
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
    }

    /**
     * Définit la liste des livraisons rattachées à un voyage : on détache d'abord toutes
     * celles déjà liées, puis on rattache la nouvelle sélection.
     */
    public void setLivraisonsDuVoyage(Long voyageId, List<Long> livraisonIds) {
        gapJdbcTemplate.update("UPDATE livraisons SET voyage_id = NULL WHERE voyage_id = ?", voyageId);
        if (livraisonIds != null) {
            Timestamp now = Timestamp.valueOf(LocalDateTime.now());
            for (Long id : livraisonIds) {
                gapJdbcTemplate.update(
                        "UPDATE livraisons SET voyage_id = ?, modifier_le = ? WHERE id = ?", voyageId, now, id);
            }
        }
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
                "(SELECT COUNT(*) FROM detail_livraison dl WHERE dl.id_livraison = l.id) AS nb_articles " +
                "FROM livraisons l " +
                "LEFT JOIN chauffeur ch  ON l.id_chauffeur = ch.id " +
                "LEFT JOIN projet    p   ON l.id_projet    = p.id " +
                "LEFT JOIN ateliers  ate ON l.id_atelier   = ate.id " +
                "WHERE l.voyage_id IS NULL OR l.voyage_id = ? " +
                "ORDER BY l.date_livraison DESC";
        return gapJdbcTemplate.query(sql, VOYAGE_MAPPER, voyageId);
    }

    /** Livraisons rattachées à un voyage conteneur. */
    public List<GapVoyageDTO> getLivraisonsDuVoyage(Long voyageId) {
        String sql = "SELECT l.id, l.date_livraison, l.date_chargement, l.date_dechargement, l.id_chauffeur, " +
                "ch.nom AS ch_nom, ch.prenom AS ch_prenom, " +
                "l.id_projet, p.code AS projet_code, p.designation AS projet_designation, " +
                "l.id_atelier, ate.designation AS atelier_designation, " +
                "l.statut_reception, l.imprime, l.force_code, l.bl, l.bl_fichier, l.bl_content_type, " +
                "p.latitude AS dest_lat, p.longitude AS dest_lng, p.rayon_metres AS dest_rayon, l.voyage_id, " +
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
                "(voyage_id, projet, cdno, ref, designation, of_no, quantite, unite, date_livraison, creer_par, creer_le) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());
        for (VoyageMatiereLigneDTO m : matieres) {
            double q = (m.getQuantite() != null && m.getQuantite() > 0) ? m.getQuantite() : 1.0;
            Timestamp dl = m.getDateLivraison() != null ? Timestamp.valueOf(m.getDateLivraison().atStartOfDay()) : null;
            gapJdbcTemplate.update(sql, voyageId, m.getProjet(), m.getCdno(), m.getRef(),
                    m.getDesignation(), m.getOf(), q, m.getUnite(), dl, user, now);
        }
    }

    /** Lignes de matières premières d'un voyage (table voyage_matiere). */
    public List<MatierePremiereDTO> getVoyageMatieres(Long voyageId) {
        return gapJdbcTemplate.query(
                "SELECT id, projet, ref, designation, of_no, quantite, unite FROM voyage_matiere " +
                        "WHERE voyage_id = ? ORDER BY id",
                (rs, i) -> {
                    MatierePremiereDTO d = new MatierePremiereDTO();
                    d.setId(rs.getLong("id"));
                    d.setProjet(rs.getString("projet"));
                    d.setReference(rs.getString("ref"));
                    d.setDesignation(rs.getString("designation"));
                    d.setOf(rs.getString("of_no"));
                    d.setQuantite(rs.getDouble("quantite"));
                    d.setUnite(rs.getString("unite"));
                    return d;
                }, voyageId);
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
    public int scanAllDetailsForVoyage(Long voyageId, String phase) {
        String statut = "CHARGEMENT".equalsIgnoreCase(phase) ? "SCANNE_CHARGEMENT" : "SCANNE_LIVRAISON";
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());
        int n = gapJdbcTemplate.update(
                "UPDATE dl SET dl.statut_reception = ?, dl.modifier_le = ? " +
                        "FROM detail_livraison dl JOIN livraisons l ON dl.id_livraison = l.id " +
                        "WHERE l.voyage_id = ?", statut, now, voyageId);
        // Passe les livraisons du voyage à 'CHARGE' au chargement (sauf déjà 'LIVRE')
        if ("CHARGEMENT".equalsIgnoreCase(phase)) {
            gapJdbcTemplate.update(
                    "UPDATE livraisons SET statut_reception = 'CHARGE', modifier_le = ? " +
                            "WHERE voyage_id = ? AND (statut_reception IS NULL OR statut_reception <> 'LIVRE')",
                    now, voyageId);
        }
        return n;
    }
}
