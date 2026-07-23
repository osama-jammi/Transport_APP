package com.agileo.transport.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
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
    private final String seedAdminUsername;
    private final String seedAdminPassword;

    public SchemaInitializer(@Qualifier("primaryJdbcTemplate") JdbcTemplate primaryJdbcTemplate,
                             @Qualifier("gapJdbcTemplate") JdbcTemplate gapJdbcTemplate,
                             @Value("${app.mobile.seed-admin-username:admin}") String seedAdminUsername,
                             @Value("${app.mobile.seed-admin-password:Admin@2026}") String seedAdminPassword) {
        this.primaryJdbcTemplate = primaryJdbcTemplate;
        this.gapJdbcTemplate = gapJdbcTemplate;
        this.seedAdminUsername = seedAdminUsername;
        this.seedAdminPassword = seedAdminPassword;
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

        // Chauffeur lié à une position GPS (suivi même sans voyage)
        exec(primaryJdbcTemplate,
                "IF COL_LENGTH('position_gps','chauffeur_id') IS NULL " +
                        "ALTER TABLE position_gps ADD chauffeur_id BIGINT NULL",
                "position_gps.chauffeur_id");

        // Fonctionnalités activables/désactivables (espace administrateur)
        exec(primaryJdbcTemplate,
                "IF OBJECT_ID('feature_flag','U') IS NULL " +
                        "CREATE TABLE feature_flag (" +
                        " cle VARCHAR(60) PRIMARY KEY," +
                        " libelle VARCHAR(150) NULL," +
                        " actif BIT NOT NULL CONSTRAINT DF_feature_flag_actif DEFAULT 1)",
                "table feature_flag");
        // Le suivi GPS est fusionné dans « suivi-trajets » : plus de flag « tracking » séparé.
        seedFeature("suivi-trajets", "Suivi des trajets (carte + GPS chauffeurs)");
        seedFeature("of-voyage", "Activé ordre de fabrication");
        seedFeature("cloture-mp", "Activé matière première");
        seedFeature("stock-voyage", "Activé stock");
        seedFeature("historique-voyages", "Historique des voyages");
        // Purge de l'ancienne fonctionnalité « tracking » (fusionnée dans « suivi-trajets »).
        exec(primaryJdbcTemplate, "DELETE FROM feature_flag WHERE cle = 'tracking'", "feature_flag:tracking (purge)");

        // Comptes superviseur de l'app mobile (auth locale BCrypt, indépendante de Keycloak)
        exec(primaryJdbcTemplate,
                "IF OBJECT_ID('utilisateur_mobile','U') IS NULL " +
                        "CREATE TABLE utilisateur_mobile (" +
                        " id BIGINT IDENTITY(1,1) PRIMARY KEY," +
                        " username VARCHAR(100) NOT NULL UNIQUE," +
                        " password_hash VARCHAR(100) NOT NULL," +
                        " nom VARCHAR(100) NULL," +
                        " prenom VARCHAR(100) NULL," +
                        " role VARCHAR(30) NOT NULL," +
                        " actif BIT NOT NULL CONSTRAINT DF_utilisateur_mobile_actif DEFAULT 1," +
                        " derniere_connexion datetime2 NULL)",
                "table utilisateur_mobile");
        seedAdminMobile();

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

        // Chauffeur GAP actif/inactif : contrôle l'accès à l'app mobile (défaut actif)
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('chauffeur','actif') IS NULL " +
                        "ALTER TABLE chauffeur ADD actif BIT NOT NULL CONSTRAINT DF_chauffeur_gap_actif DEFAULT 1",
                "chauffeur.actif (GAP)");

        // Dépôts (locaux de départ) gérés dans l'application
        exec(gapJdbcTemplate,
                "IF OBJECT_ID('depot','U') IS NULL " +
                        "CREATE TABLE depot (" +
                        " id BIGINT IDENTITY(1,1) PRIMARY KEY," +
                        " nom VARCHAR(255) NULL," +
                        " latitude FLOAT NULL," +
                        " longitude FLOAT NULL," +
                        " rayon INT NULL," +
                        " creer_le datetime2 NULL)",
                "table depot");

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
        // Heures réelles (captées côté chauffeur lors des scans)
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('voyage','real_chargement') IS NULL " +
                        "ALTER TABLE voyage ADD real_chargement datetime2 NULL",
                "voyage.real_chargement");
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('voyage','real_dechargement') IS NULL " +
                        "ALTER TABLE voyage ADD real_dechargement datetime2 NULL",
                "voyage.real_dechargement");
        // Local de départ (géofence de chargement) au niveau du voyage
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('voyage','local_nom') IS NULL " +
                        "ALTER TABLE voyage ADD local_nom VARCHAR(255) NULL", "voyage.local_nom");
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('voyage','local_lat') IS NULL " +
                        "ALTER TABLE voyage ADD local_lat FLOAT NULL", "voyage.local_lat");
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('voyage','local_lng') IS NULL " +
                        "ALTER TABLE voyage ADD local_lng FLOAT NULL", "voyage.local_lng");
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('voyage','local_rayon') IS NULL " +
                        "ALTER TABLE voyage ADD local_rayon INT NULL", "voyage.local_rayon");
        // Type de livraison : ARTICLE ou MATIERE_PREMIERE
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('livraisons','type_livraison') IS NULL " +
                        "ALTER TABLE livraisons ADD type_livraison VARCHAR(30) NULL",
                "livraisons.type_livraison");
        // Lignes de matières premières rattachées DIRECTEMENT à un voyage (sans livraison).
        // Divalto reste en lecture seule : on ne fait que copier ici les lignes choisies.
        exec(gapJdbcTemplate,
                "IF OBJECT_ID('voyage_matiere','U') IS NULL " +
                        "CREATE TABLE voyage_matiere (" +
                        " id BIGINT IDENTITY(1,1) PRIMARY KEY," +
                        " voyage_id BIGINT NULL," +
                        " projet VARCHAR(50) NULL," +          // chantier (code CHxxxx)
                        " cdno BIGINT NULL," +                 // commande Divalto (CDNO)
                        " ref VARCHAR(50) NULL," +
                        " designation VARCHAR(255) NULL," +
                        " of_no VARCHAR(50) NULL," +
                        " quantite FLOAT NULL," +
                        " unite VARCHAR(20) NULL," +
                        " date_livraison datetime2 NULL," +
                        " date_chargement datetime2 NULL," +
                        " date_dechargement datetime2 NULL," +
                        " creer_par VARCHAR(255) NULL," +
                        " creer_le datetime2 NULL)",
                "table voyage_matiere");
        // Colonnes ajoutées si la table existait déjà (heures par ligne)
        exec(gapJdbcTemplate, "IF COL_LENGTH('voyage_matiere','date_chargement') IS NULL " +
                "ALTER TABLE voyage_matiere ADD date_chargement datetime2 NULL", "voyage_matiere.date_chargement");
        exec(gapJdbcTemplate, "IF COL_LENGTH('voyage_matiere','date_dechargement') IS NULL " +
                "ALTER TABLE voyage_matiere ADD date_dechargement datetime2 NULL", "voyage_matiere.date_dechargement");
        // Pièce fournisseur + quantité commandée d'origine (affichage cmd/livré/reste)
        exec(gapJdbcTemplate, "IF COL_LENGTH('voyage_matiere','piece_fournisseur') IS NULL " +
                "ALTER TABLE voyage_matiere ADD piece_fournisseur VARCHAR(50) NULL", "voyage_matiere.piece_fournisseur");
        exec(gapJdbcTemplate, "IF COL_LENGTH('voyage_matiere','qte_commande') IS NULL " +
                "ALTER TABLE voyage_matiere ADD qte_commande FLOAT NULL", "voyage_matiere.qte_commande");
        // Statut de clôture local (EN_ATTENTE / LIVRE) — n'impacte jamais l'ERP Divalto
        exec(gapJdbcTemplate, "IF COL_LENGTH('voyage_matiere','statut') IS NULL " +
                "ALTER TABLE voyage_matiere ADD statut VARCHAR(20) NULL", "voyage_matiere.statut");
        exec(gapJdbcTemplate, "IF COL_LENGTH('voyage_matiere','modifier_le') IS NULL " +
                "ALTER TABLE voyage_matiere ADD modifier_le datetime2 NULL", "voyage_matiere.modifier_le");
        // Origine de la ligne : MATIERE (Divalto, défaut) ou STOCK (vue Article_en_stock DivNet, lecture seule).
        exec(gapJdbcTemplate, "IF COL_LENGTH('voyage_matiere','source') IS NULL " +
                "ALTER TABLE voyage_matiere ADD source VARCHAR(20) NULL CONSTRAINT DF_voyage_matiere_source DEFAULT 'MATIERE'",
                "voyage_matiere.source");
        // Dépôt d'origine (code DEPO, ex. RB1) pour les lignes issues du stock.
        exec(gapJdbcTemplate, "IF COL_LENGTH('voyage_matiere','depot') IS NULL " +
                "ALTER TABLE voyage_matiere ADD depot VARCHAR(20) NULL", "voyage_matiere.depot");

        // Arrivée au niveau (voyage conteneur, chantier) — sert aux lignes SANS OF
        // (matières premières / stock seuls) qui n'ont pas de livraison GAP pour porter
        // arrivee_dechargement. Géofence validée par chantier (table GAP projet, via code).
        exec(gapJdbcTemplate,
                "IF OBJECT_ID('voyage_arrivee_chantier','U') IS NULL " +
                        "CREATE TABLE voyage_arrivee_chantier (" +
                        " id BIGINT IDENTITY(1,1) PRIMARY KEY," +
                        " voyage_id BIGINT NOT NULL," +
                        " projet VARCHAR(50) NOT NULL," +
                        " arrivee datetime2 NULL," +
                        " creer_le datetime2 NULL," +
                        " CONSTRAINT UQ_voyage_arrivee_chantier UNIQUE (voyage_id, projet))",
                "table voyage_arrivee_chantier");

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

        exec(gapJdbcTemplate,
                "IF OBJECT_ID('livraison_bl_files','U') IS NULL " +
                        "CREATE TABLE livraison_bl_files (" +
                        " id BIGINT IDENTITY(1,1) PRIMARY KEY," +
                        " livraison_id BIGINT NOT NULL," +
                        " reference VARCHAR(255) NULL," +
                        " fichier VARCHAR(255) NULL," +
                        " content_type VARCHAR(100) NULL," +
                        " creer_le datetime2 NULL)",
                "table livraison_bl_files");

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
        // Archivage des chantiers (projets) — défaut non archivé
        exec(gapJdbcTemplate,
                "IF COL_LENGTH('projet','archive') IS NULL " +
                        "ALTER TABLE projet ADD archive BIT NOT NULL CONSTRAINT DF_projet_archive DEFAULT 0",
                "projet.archive");
    }

    /**
     * Crée un compte superviseur initial (ADMIN) si la table est vide pour ce
     * username. Mot de passe haché en BCrypt. Identifiants paramétrables via
     * app.mobile.seed-admin-username / app.mobile.seed-admin-password — à
     * changer / supprimer une fois les vrais comptes créés depuis le web.
     */
    private void seedAdminMobile() {
        try {
            Integer count = primaryJdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM utilisateur_mobile WHERE username = ?",
                    Integer.class, seedAdminUsername);
            if (count != null && count == 0) {
                String hash = new BCryptPasswordEncoder().encode(seedAdminPassword);
                primaryJdbcTemplate.update(
                        "INSERT INTO utilisateur_mobile (username, password_hash, nom, prenom, role, actif) " +
                                "VALUES (?, ?, ?, ?, ?, 1)",
                        seedAdminUsername, hash, "Administrateur", "", "ADMIN");
                log.info("[schema] OK : compte superviseur initial '{}' créé (à changer)", seedAdminUsername);
            }
        } catch (Exception e) {
            log.warn("[schema] Ignoré (seed superviseur) : {}", e.getMessage());
        }
    }

    /** Insère une fonctionnalité par défaut si elle n'existe pas (active par défaut). */
    private void seedFeature(String cle, String libelle) {
        exec(primaryJdbcTemplate,
                "IF NOT EXISTS (SELECT 1 FROM feature_flag WHERE cle = '" + cle + "') " +
                        "INSERT INTO feature_flag (cle, libelle, actif) VALUES ('" + cle + "', '"
                        + libelle.replace("'", "''") + "', 1)",
                "feature_flag:" + cle);
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
