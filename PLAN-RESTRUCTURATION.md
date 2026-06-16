# Plan de restructuration — Voyage / Livraison + Matières premières

## Modèle métier cible
- **Voyage** = conteneur. Regroupe **1..N livraisons**. (nouvelle table GAP `voyage`)
- **Livraison** = une livraison GAP (table `livraisons`), rattachée à un voyage (`voyage_id`).
  - Chaque livraison contient **soit des articles, soit des matières premières** (`type_livraison` = `ARTICLE` | `MATIERE_PREMIERE`).
- **Articles** : base GAP (table `article`) — déjà en place.
- **Matières premières** : Divalto **RB217_MIG**, table `ART` (REF, DES, familles…), liées aux affaires via les documents (`ENT`/`MOUV`).

## Fondation (FAIT)
- Table `voyage` (id, date, id_chauffeur, statut, force_code, audit).
- `livraisons.voyage_id` + `livraisons.type_livraison`.
- Colonnes ajoutées automatiquement au démarrage (`SchemaInitializer`).

## Phases suivantes
1. **Backend voyage conteneur** : créer/lire/éditer un voyage + ses livraisons (GAP).
2. **Livraison typée** : à la création d'une livraison, choisir le type (articles ou matières premières) + ses lignes.
3. **Matières premières Divalto** : lire les matières premières d'une affaire (ART via ENT/MOUV), endpoint dédié, sélection + quantité.
4. **Front web** : écran Voyage = liste de voyages → chaque voyage déplié en livraisons → chaque livraison en lignes (articles/MP).
5. **Mobile** : chauffeur voit ses voyages → livraisons → scan articles/MP.

## Autres demandes (à intégrer dans les phases)
- Quantité par article à la sélection + décrément de la quantité GAP de l'article.
- Recherche/filtre dans les listes déroulantes (chauffeur, chantier, article).
- Archivage automatique d'un voyage livré après 24 h.
- Ajout de chauffeurs depuis la Flotte (écriture GAP `chauffeur`).
- Double scan (phase LIVRAISON) obligatoire avant le BL.
- Statut de connexion des chauffeurs (corriger « jamais connecté »).
- Camion : type (Voiture/Camion/Pickup) + marque + immatriculation marocaine en 3 champs. **(FAIT)**
