# 🚚 Système de Gestion des Transports et Livraisons (Transport APP)

> **Solution Intégrée pour le suivi des expéditions, des voyages et des chauffeurs.**

L'application **Transport APP** est une plateforme complète (Backend, Front Web, et Mobile) dédiée à l'optimisation de la logistique d'entreprise. Elle permet de structurer les expéditions en "Voyages", de suivre les livraisons d'articles et de matières premières, et d'assurer une traçabilité complète sur le terrain via une application mobile pour les chauffeurs.

## ✨ Fonctionnalités Principales

- 🗺️ **Gestion des Voyages** : Regroupement de multiples livraisons dans un même "Voyage" ou conteneur.
- 📦 **Livraisons Typées** : Gestion fine des livraisons d'**Articles** (via GAP) et de **Matières Premières** (intégration Divalto).
- 📱 **Application Mobile Chauffeur** : Interface dédiée pour les chauffeurs pour consulter les voyages, les trajets, et scanner les colis.
- 📷 **Validation par Double Scan** : Sécurité renforcée avec un scan obligatoire avant la génération du Bon de Livraison (BL).
- 📍 **Suivi GPS** : Traçabilité des trajets et des statuts de livraison.
- 🔗 **Intégration ERP** : Synchronisation avec Divalto (Affaires, ENT/MOUV) et GAP.
- 📊 **Tableau de Bord Web** : Interface d'administration pour la flotte, les voyages et l'archivage automatique.

---

## 🏗️ Architecture et Conception Technique

Le projet repose sur une architecture répartie :
- **Transport-BackEnd** : API robuste gérant la logique métier et la connexion ERP.
- **Transport-Web-Angular** : Interface d'administration.
- **Transport-Mobile** : Application chauffeur.

### Diagrammes et Flux
**Diagramme de Classes :**
<img src="https://raw.githubusercontent.com/osama-jammi/Transport_APP/main/class_diagram.png" alt="Diagramme de Classes" width="100%" />

**Séquence GPS :**
<img src="https://raw.githubusercontent.com/osama-jammi/Transport_APP/main/sequence_gps.png" alt="Séquence GPS" width="100%" />

**Flux de Scan & Livraison :**
<img src="https://raw.githubusercontent.com/osama-jammi/Transport_APP/main/sequence_scan_livraison.png" alt="Flux de Scan" width="100%" />

---

## 📸 Aperçu de l'Application Web (Screenshots)

*L'interface Web permet aux gestionnaires de suivre l'ensemble de la flotte et des expéditions.*

### 1. Tableau de bord / Liste des Voyages
<img src="https://raw.githubusercontent.com/osama-jammi/Transport_APP/main/web_1.png" alt="Tableau de Bord Voyages" width="100%" />

### 2. Détail d'une Livraison
<img src="https://raw.githubusercontent.com/osama-jammi/Transport_APP/main/web_2.png" alt="Détail Livraison" width="100%" />

### 3. Gestion des Articles et Matières Premières
<img src="https://raw.githubusercontent.com/osama-jammi/Transport_APP/main/web_3.png" alt="Articles et Matières Premières" width="100%" />

### 4. Suivi des Chauffeurs
<img src="https://raw.githubusercontent.com/osama-jammi/Transport_APP/main/web_4.png" alt="Suivi des Chauffeurs" width="100%" />

### 5. Options Avancées
<img src="https://raw.githubusercontent.com/osama-jammi/Transport_APP/main/web_5.png" alt="Options Avancées" width="100%" />

*(Note : L'application mobile est en cours de développement, les captures d'écran mobiles seront ajoutées prochainement).*

---

## 🛠️ Technologies & Outils

- **Backend** : Java / Spring Boot *(à confirmer)*
- **Frontend Web** : Angular
- **Application Mobile** : React Native / Expo *(à confirmer)*
- **Intégration** : Divalto / Base GAP

## 🚀 Installation & Déploiement

1. Cloner le dépôt :
   ```bash
   git clone https://github.com/osama-jammi/Transport_APP.git
   ```
2. Lancer le Backend (`Transport-BackEnd`)
3. Lancer le Frontend Angular :
   ```bash
   cd Transport-Web-Angular
   npm install && ng serve
   ```
4. Lancer l'application Mobile :
   ```bash
   cd Transport-Mobile
   npx expo start
   ```

---
*Projet développé par [Osama Jammi](https://github.com/osama-jammi).*
