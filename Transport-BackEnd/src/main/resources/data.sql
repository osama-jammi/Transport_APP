-- ═══════════════════════════════════════════════════════════
--  DONNÉES DE TEST — Transport-Livraison
--  Utilise INSERT ... SELECT ... WHERE NOT EXISTS
--  (compatible avec ScriptUtils qui sépare sur ";")
-- ═══════════════════════════════════════════════════════════

-- ── Migration : rendre article.colis_id NULLABLE ────────────
--  Les articles "disponibles / actifs" (non encore rattachés à
--  un voyage) ont colis_id = NULL. L'ancien schéma créait la
--  colonne en NOT NULL ; ddl-auto=update ne corrige pas la
--  nullabilité, on l'ajuste donc explicitement ici.
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_NAME = 'article' AND COLUMN_NAME = 'colis_id' AND IS_NULLABLE = 'NO')
  ALTER TABLE article ALTER COLUMN colis_id BIGINT NULL;

-- ── Migration : élargir article.statut_scan ─────────────────
--  L'ancien schéma créait la colonne en VARCHAR(15), trop court pour
--  'SCANNE_CHARGEMENT' (17 car.) → erreur de troncature lors du scan.
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_NAME = 'article' AND COLUMN_NAME = 'statut_scan' AND CHARACTER_MAXIMUM_LENGTH < 20)
  ALTER TABLE article ALTER COLUMN statut_scan VARCHAR(30) NOT NULL;

-- ── Backfill du rayon de zone par défaut (100 m) ────────────
UPDATE chantier SET rayon_metres = 100 WHERE rayon_metres IS NULL;

-- ── 2 Chantiers ─────────────────────────────────────────────
INSERT INTO chantier (nom, lieu, ville, latitude, longitude, actif)
SELECT 'Chantier Alger Centre', 'Rue Didouche Mourad', 'Alger', 36.7372, 3.0865, 1
WHERE NOT EXISTS (SELECT 1 FROM chantier WHERE nom = 'Chantier Alger Centre');

INSERT INTO chantier (nom, lieu, ville, latitude, longitude, actif)
SELECT 'Chantier Oran Ouest', 'Boulevard de la Soummam', 'Oran', 35.6969, -0.6331, 1
WHERE NOT EXISTS (SELECT 1 FROM chantier WHERE nom = 'Chantier Oran Ouest');

-- ── 1 Chauffeur ─────────────────────────────────────────────
INSERT INTO chauffeur (nom, prenom, telephone, matricule, qr_code, actif)
SELECT 'Jammi', 'Osama', '0555123456', 'CH-001', CONVERT(VARCHAR(36), NEWID()), 1
WHERE NOT EXISTS (SELECT 1 FROM chauffeur WHERE matricule = 'CH-001');

-- ── 2 Camions ────────────────────────────────────────────────
INSERT INTO camion (immatriculation, device, etat, chauffeur_id)
SELECT '16-TRK-001', 'DEVICE-A', 'LIBRE', id
FROM chauffeur
WHERE matricule = 'CH-001'
AND NOT EXISTS (SELECT 1 FROM camion WHERE immatriculation = '16-TRK-001');

INSERT INTO camion (immatriculation, device, etat, chauffeur_id)
SELECT '31-TRK-002', 'DEVICE-B', 'LIBRE', NULL
WHERE NOT EXISTS (SELECT 1 FROM camion WHERE immatriculation = '31-TRK-002');

-- ── 1 Transporteur ───────────────────────────────────────────
INSERT INTO transporteur (nom, contact, actif)
SELECT 'Transport Express DZ', '0213555000', 1
WHERE NOT EXISTS (SELECT 1 FROM transporteur WHERE nom = 'Transport Express DZ');

-- ── 1 Voyage de test ─────────────────────────────────────────
INSERT INTO voyage (date_creation, camion_id, transporteur_id, client, etat_chargement, etat_dechargement, statut)
SELECT
    GETDATE(),
    (SELECT TOP 1 id FROM camion       WHERE immatriculation = '16-TRK-001'),
    (SELECT TOP 1 id FROM transporteur WHERE nom = 'Transport Express DZ'),
    'Client Test', 'EN_ATTENTE', 'EN_ATTENTE', 'EN_COURS'
WHERE NOT EXISTS (SELECT 1 FROM voyage WHERE client = 'Client Test');

-- ── 1 Colis pour ce voyage ────────────────────────────────────
INSERT INTO colis (voyage_id, etat, nb_articles)
SELECT (SELECT TOP 1 id FROM voyage WHERE client = 'Client Test'), 'PREPARE', 3
WHERE NOT EXISTS (
    SELECT 1 FROM colis
    WHERE voyage_id = (SELECT TOP 1 id FROM voyage WHERE client = 'Client Test')
);

-- ── 3 Articles ───────────────────────────────────────────────
INSERT INTO article (colis_id, reference_gap, nom, chantier_destination_id, qr_code, statut_scan)
SELECT
    (SELECT TOP 1 id FROM colis WHERE voyage_id = (SELECT TOP 1 id FROM voyage WHERE client = 'Client Test')),
    'GAP-ART-001',
    'Poutre metallique 6m',
    (SELECT TOP 1 id FROM chantier WHERE nom = 'Chantier Alger Centre'),
    CONCAT('Poutre metallique 6m|Chantier Alger Centre|', CONVERT(VARCHAR(36), NEWID())),
    'NON_SCANNE'
WHERE NOT EXISTS (SELECT 1 FROM article WHERE reference_gap = 'GAP-ART-001');

INSERT INTO article (colis_id, reference_gap, nom, chantier_destination_id, qr_code, statut_scan)
SELECT
    (SELECT TOP 1 id FROM colis WHERE voyage_id = (SELECT TOP 1 id FROM voyage WHERE client = 'Client Test')),
    'GAP-ART-002',
    'Dalle de beton 50x50',
    (SELECT TOP 1 id FROM chantier WHERE nom = 'Chantier Alger Centre'),
    CONCAT('Dalle de beton 50x50|Chantier Alger Centre|', CONVERT(VARCHAR(36), NEWID())),
    'NON_SCANNE'
WHERE NOT EXISTS (SELECT 1 FROM article WHERE reference_gap = 'GAP-ART-002');

INSERT INTO article (colis_id, reference_gap, nom, chantier_destination_id, qr_code, statut_scan)
SELECT
    (SELECT TOP 1 id FROM colis WHERE voyage_id = (SELECT TOP 1 id FROM voyage WHERE client = 'Client Test')),
    'GAP-ART-003',
    'Tuyau PVC DN200',
    (SELECT TOP 1 id FROM chantier WHERE nom = 'Chantier Oran Ouest'),
    CONCAT('Tuyau PVC DN200|Chantier Oran Ouest|', CONVERT(VARCHAR(36), NEWID())),
    'NON_SCANNE'
WHERE NOT EXISTS (SELECT 1 FROM article WHERE reference_gap = 'GAP-ART-003');

-- ── 2ème Chauffeur ───────────────────────────────────────────
INSERT INTO chauffeur (nom, prenom, telephone, matricule, qr_code, actif)
SELECT 'Benali', 'Ahmed', '0666789012', 'CH-002', CONVERT(VARCHAR(36), NEWID()), 1
WHERE NOT EXISTS (SELECT 1 FROM chauffeur WHERE matricule = 'CH-002');

-- Lier le 2ème camion au 2ème chauffeur
UPDATE camion
SET chauffeur_id = (SELECT TOP 1 id FROM chauffeur WHERE matricule = 'CH-002')
WHERE immatriculation = '31-TRK-002'
  AND chauffeur_id IS NULL;

-- ── 5 Articles disponibles (sans colis) ──────────────────────
INSERT INTO article (colis_id, reference_gap, nom, chantier_destination_id, qr_code, statut_scan)
SELECT NULL, 'GAP-ART-011', 'Poutre HEA 200',
       (SELECT TOP 1 id FROM chantier WHERE nom = 'Chantier Alger Centre'),
       CONCAT('Poutre HEA 200|Chantier Alger Centre|', CONVERT(VARCHAR(36), NEWID())),
       'NON_SCANNE'
WHERE NOT EXISTS (SELECT 1 FROM article WHERE reference_gap = 'GAP-ART-011');

INSERT INTO article (colis_id, reference_gap, nom, chantier_destination_id, qr_code, statut_scan)
SELECT NULL, 'GAP-ART-012', 'Plancher collaborant 3x6m',
       (SELECT TOP 1 id FROM chantier WHERE nom = 'Chantier Alger Centre'),
       CONCAT('Plancher collaborant 3x6m|Chantier Alger Centre|', CONVERT(VARCHAR(36), NEWID())),
       'NON_SCANNE'
WHERE NOT EXISTS (SELECT 1 FROM article WHERE reference_gap = 'GAP-ART-012');

INSERT INTO article (colis_id, reference_gap, nom, chantier_destination_id, qr_code, statut_scan)
SELECT NULL, 'GAP-ART-013', 'Barre acier HA32 12m',
       (SELECT TOP 1 id FROM chantier WHERE nom = 'Chantier Oran Ouest'),
       CONCAT('Barre acier HA32 12m|Chantier Oran Ouest|', CONVERT(VARCHAR(36), NEWID())),
       'NON_SCANNE'
WHERE NOT EXISTS (SELECT 1 FROM article WHERE reference_gap = 'GAP-ART-013');

INSERT INTO article (colis_id, reference_gap, nom, chantier_destination_id, qr_code, statut_scan)
SELECT NULL, 'GAP-ART-014', 'Coffrage bois 100x200',
       (SELECT TOP 1 id FROM chantier WHERE nom = 'Chantier Oran Ouest'),
       CONCAT('Coffrage bois 100x200|Chantier Oran Ouest|', CONVERT(VARCHAR(36), NEWID())),
       'NON_SCANNE'
WHERE NOT EXISTS (SELECT 1 FROM article WHERE reference_gap = 'GAP-ART-014');

INSERT INTO article (colis_id, reference_gap, nom, chantier_destination_id, qr_code, statut_scan)
SELECT NULL, 'GAP-ART-015', 'Ciment Portland 50kg x20',
       (SELECT TOP 1 id FROM chantier WHERE nom = 'Chantier Alger Centre'),
       CONCAT('Ciment Portland 50kg x20|Chantier Alger Centre|', CONVERT(VARCHAR(36), NEWID())),
       'NON_SCANNE'
WHERE NOT EXISTS (SELECT 1 FROM article WHERE reference_gap = 'GAP-ART-015');

-- ── Nettoyage des positions GPS de test (Algérie) ───────────
--  Ces coordonnées avaient été insérées comme données de démo ;
--  on les supprime pour que seules les positions RÉELLES remontées
--  par l'app mobile s'affichent sur la carte de suivi.
DELETE FROM position_gps WHERE (latitude = 36.7450 AND longitude = 3.0900)
                            OR (latitude = 35.7010 AND longitude = -0.6390);
