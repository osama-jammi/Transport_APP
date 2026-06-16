package com.agileo.transport.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Applique au démarrage les évolutions de schéma nécessaires, de façon
 * idempotente (chaque colonne n'est ajoutée que si elle manque). Remplace les
 * scripts SQL manuels — fonctionne quel que soit le profil (ddl-auto=none compris).
 *
 *  - Base primaire (Transport) : camion.chauffeur_nom, suppression de la FK
 *    camion.chauffeur_id -> chauffeur, position_gps.voyage_id, camion_id nullable.
 *  - Base GAP (livraisons)     : date_chargement, date_dechargement.
 */
@Component
public class SchemaInitializer {

    private static final Logger log = LoggerFactory.getLogger(SchemaInitializer.class);

    private final JdbcTemplate primaryJdbcTemplate;
    private final JdbcTemplate gapJdbcTemplate;

    public SchemaInitializer(@Qualifier("primaryJdbcTemplate") JdbcTemplate primaryJdbcTemplate,
                             @Qualifier("gapJdbcTemplate") JdbcTemplate gapJdbcTemplate) {
        this.primaryJdbcTemplate = primaryJdbcTemplate;
        this.gapJdbcTemplate = gapJdbcTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void migrer() {
        // ── Base primaire (Transport) ──
        exec(primaryJdbcTemplate,
                "IF COL_LENGTH('camion','chauffeur_nom') IS NULL " +
                        "ALTER TABLE camion ADD chauffeur_nom VARCHAR(255) NULL",
                "camion.chauffeur_nom");
        exec(primaryJdbcTemplate,
                "IF COL_LENGTH('camion','type') IS NULL ALTER TABLE camion ADD type VARCHAR(20) NULL",
                "camion.type");
        exec(primaryJdbcTemplate,
                "IF COL_LENGTH('camion','marque') IS NULL ALTER TABLE camion ADD marque VARCHAR(100) NULL",
                "camion.marque");

        exec(primaryJdbcTemplate,
                "DECLARE @fk sysname; " +
                        "SELECT @fk = fk.name FROM sys.foreign_keys fk " +
                        "WHERE fk.parent_object_id = OBJECT_ID('camion') " +
                        "AND fk.referenced_object_id = OBJECT_ID('chauffeur'); " +
                        "IF @fk IS NOT NULL EXEC('ALTER TABLE camion DROP CONSTRAINT ' + @fk)",
                "suppression FK camion.chauffeur_id -> chauffeur");

        exec(primaryJdbcTemplate,
                "IF COL_LENGTH('position_gps','voyage_id') IS NULL " +
                        "ALTER TABLE position_gps ADD voyage_id BIGINT NULL",
                "position_gps.voyage_id");

        exec(primaryJdbcTemplate,
                "IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('position_gps') " +
                        "AND name = 'camion_id' AND is_nullable = 0) " +
                        "ALTER TABLE position_gps ALTER COLUMN camion_id BIGINT NULL",
                "position_gps.camion_id nullable");

        // ── Base GAP (livraisons) ──
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('livraisons','date_chargement') IS NULL " +
                        "ALTER TABLE livraisons ADD date_chargement datetime2 NULL",
                "livraisons.date_chargement");

        exec(gapJdbcTemplate,
                "IF COL_LENGTH('livraisons','date_dechargement') IS NULL " +
                        "ALTER TABLE livraisons ADD date_dechargement datetime2 NULL",
                "livraisons.date_dechargement");

        exec(gapJdbcTemplate,
                "IF COL_LENGTH('livraisons','force_code') IS NULL " +
                        "ALTER TABLE livraisons ADD force_code VARCHAR(20) NULL",
                "livraisons.force_code");

        exec(gapJdbcTemplate,
                "IF COL_LENGTH('livraisons','arrivee_dechargement') IS NULL " +
                        "ALTER TABLE livraisons ADD arrivee_dechargement datetime2 NULL",
                "livraisons.arrivee_dechargement");

        exec(gapJdbcTemplate,
                "IF COL_LENGTH('livraisons','bl') IS NULL " +
                        "ALTER TABLE livraisons ADD bl VARCHAR(255) NULL",
                "livraisons.bl");
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('livraisons','bl_fichier') IS NULL " +
                        "ALTER TABLE livraisons ADD bl_fichier VARCHAR(255) NULL",
                "livraisons.bl_fichier");
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('livraisons','bl_content_type') IS NULL " +
                        "ALTER TABLE livraisons ADD bl_content_type VARCHAR(100) NULL",
                "livraisons.bl_content_type");

        // Dernière connexion mobile du chauffeur (renseignée au scan QR)
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('chauffeur','derniere_connexion') IS NULL " +
                        "ALTER TABLE chauffeur ADD derniere_connexion datetime2 NULL",
                "chauffeur.derniere_connexion");

        // ── Restructuration : Voyage = conteneur de 1..N livraisons ──
        exec(gapJdbcTemplate,
                "IF OBJECT_ID('voyage','U') IS NULL " +
                        "CREATE TABLE voyage (" +
                        " id BIGINT IDENTITY(1,1) PRIMARY KEY," +
                        " date_voyage datetime2 NULL," +
                        " id_chauffeur BIGINT NULL," +
                        " statut VARCHAR(20) NULL," +
                        " force_code VARCHAR(20) NULL," +
                        " creer_par VARCHAR(255) NULL," +
                        " creer_le datetime2 NULL," +
                        " modifier_par VARCHAR(255) NULL," +
                        " modifier_le datetime2 NULL)",
                "table voyage (conteneur)");
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('livraisons','voyage_id') IS NULL " +
                        "ALTER TABLE livraisons ADD voyage_id BIGINT NULL",
                "livraisons.voyage_id");
        // Heures de chargement/déchargement au niveau du voyage conteneur
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('voyage','date_chargement') IS NULL " +
                        "ALTER TABLE voyage ADD date_chargement datetime2 NULL",
                "voyage.date_chargement");
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('voyage','date_dechargement') IS NULL " +
                        "ALTER TABLE voyage ADD date_dechargement datetime2 NULL",
                "voyage.date_dechargement");
        // Type de livraison : ARTICLE ou MATIERE_PREMIERE
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('livraisons','type_livraison') IS NULL " +
                        "ALTER TABLE livraisons ADD type_livraison VARCHAR(30) NULL",
                "livraisons.type_livraison");
        // Lignes de matières premières (issues de Divalto) rattachées à une livraison.
        // Table dédiée car les MP n'ont pas d'id_article GAP (detail_livraison est article-only).
        exec(gapJdbcTemplate,
                "IF OBJECT_ID('detail_livraison_mp','U') IS NULL " +
                        "CREATE TABLE detail_livraison_mp (" +
                        " id BIGINT IDENTITY(1,1) PRIMARY KEY," +
                        " id_livraison BIGINT NULL," +
                        " ref VARCHAR(50) NULL," +
                        " designation VARCHAR(255) NULL," +
                        " quantite FLOAT NULL," +
                        " unite VARCHAR(20) NULL," +
                        " statut_reception VARCHAR(30) NULL," +
                        " creer_par VARCHAR(255) NULL," +
                        " creer_le datetime2 NULL)",
                "table detail_livraison_mp");

        // Géolocalisation des chantiers (table projet)
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('projet','latitude') IS NULL " +
                        "ALTER TABLE projet ADD latitude FLOAT NULL",
                "projet.latitude");
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('projet','longitude') IS NULL " +
                        "ALTER TABLE projet ADD longitude FLOAT NULL",
                "projet.longitude");
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('projet','rayon_metres') IS NULL " +
                        "ALTER TABLE projet ADD rayon_metres INT NULL",
                "projet.rayon_metres");
    }

    private void exec(JdbcTemplate jdbc, String sql, String libelle) {
        try {
            jdbc.execute(sql);
            log.info("[schema] OK : {}", libelle);
        } catch (Exception e) {
            // Ne bloque pas le démarrage (ex. base GAP injoignable à la maison)
            log.warn("[schema] Ignoré ({}) : {}", libelle, e.getMessage());
        }
    }
}
