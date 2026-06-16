# Principes de développement — à respecter toujours

## 1. Pas de "debugging panique"
Quand quelque chose ne marche pas :
1. **Diagnostiquer** : reproduire, lire les logs, identifier la cause réelle.
2. **Comprendre** : comprendre le code existant et pourquoi le bug se produit.
3. **Corriger l'existant** : modifier le code en place.

On **ne crée pas** un nouveau fichier, une nouvelle route, une nouvelle page,
ni une logique parallèle uniquement pour contourner un bug.

## 2. Source de données
- **Chauffeurs** : toujours lus depuis **GAP**.
- **Chantiers** : toujours lus depuis **GAP**.
- **Articles** : lus depuis **GAP**.
- **Voyages** : lus depuis **GAP** (table `livraisons`), avec leurs articles
  depuis `detail_livraison`.

## 3. Cohérence
- Un même concept = une seule source de vérité et une seule logique.
- Réutiliser les services/endpoints existants plutôt que d'en dupliquer.
- Les corrections doivent garder l'écran et les flux existants fonctionnels.
