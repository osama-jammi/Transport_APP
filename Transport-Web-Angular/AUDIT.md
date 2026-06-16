# Rapport d'audit — Transport-Livraison (avant mise en production)

Date : juin 2026 · Périmètre : Backend, Web (nouvelle v2 Angular), Mobile (Expo/React Native).

Ce document liste les écarts constatés entre les trois briques et ce qu'il reste à corriger
pour une exploitation fiable en production. La nouvelle interface web Angular livrée dans
`Transport-Web-Angular/` est, elle, prête (voir `README.md`).

---

## 1. Cause de l'erreur « Not found » (résolue)

L'ancienne interface (`Transport-Web/index.html` + `server.js`) utilisait un flux PKCE
manuel et un mini-serveur Node qui résolvait `req.url` comme un chemin de fichier.
Au retour de Keycloak, l'URL devient `/?state=...&code=...` ; le serveur cherchait alors
un fichier nommé `?state=...` → `Not found`.

**Résolu en v2** par :
- la gestion native du callback par `keycloak-js` (plus de fichier à servir pour le callback) ;
- un **fallback SPA** dans `server.js` (et `nginx.conf`) qui ignore la query string et renvoie `index.html`.

## 2. Backend — endpoints manquants ou incohérents

| Sévérité | Constat | Impact | Recommandation |
|----------|---------|--------|----------------|
| 🔴 Bloquant | **Aucun `CamionController`** : `/api/camions` n'existe pas. | Le web (dashboard, page Camions) et la création de voyage (`camionId`) ne disposent d'aucune source de camions. | Ajouter `CamionController` (CRUD + liste). La page web Camions est déjà prête et s'activera automatiquement. |
| 🔴 Bloquant | **Aucun `TransporteurController`** : pas de liste des transporteurs. | La création de voyage exige un `transporteurId` saisi à la main. | Exposer `/api/transporteurs` (liste) pour alimenter un menu déroulant. |
| 🟠 Majeur | Le mobile appelle `PATCH /voyages/{id}/arrivee` et `PATCH /voyages/{id}/bl` (`livraisonService.ts`). | Ces routes **n'existent pas** dans `VoyageController` → 404. | Implémenter ces endpoints, ou retirer les appels mobiles. |
| 🟡 Mineur | `VoyageResponseDTO` renvoie des champs *plats* (`transporteur`, `camionImmatriculation`) ; l'ancien web lisait `v.camion?.immatriculation` / `v.transporteur?.nom`. | Colonnes vides dans l'ancien web. | Corrigé en v2 (le web Angular lit les vrais champs du DTO). |

## 3. Mobile (Expo) — incohérences à corriger

| Sévérité | Constat | Impact | Recommandation |
|----------|---------|--------|----------------|
| 🔴 Bloquant | **URL backend incohérente** : `constants/api.ts` pointe par défaut sur `http://192.168.77.22:8090/transport-api/api`, alors que le backend tourne sur `:8082/Transport_DEV/api`. | Toutes les requêtes mobiles échouent tant que `.env` n'est pas renseigné. | Définir `EXPO_PUBLIC_API_URL=http://<IP-LAN>:8082/Transport_DEV/api` dans `.env`, et aligner la valeur d'exemple. |
| 🔴 Bloquant | **Jeton jamais stocké** : `api.ts` lit `auth_token` dans SecureStore, mais `authService.connectByQrCode` n'enregistre que `chauffeur_info`. | Les appels vers les endpoints protégés (`/voyages/en-cours`, `/articles/scan`…) partent **sans Bearer** → 401. | Soit faire renvoyer un JWT par `/chauffeurs/connect` et le stocker sous `auth_token` ; soit rendre ces endpoints accessibles au device (clé d'appairage). À trancher avec la sécurité. |
| 🟠 Majeur | `SecurityConfig` n'autorise en public que `/chauffeurs/connect` et `/gps/position`. | `/voyages/en-cours`, `/articles/scan`, etc. exigent un JWT que le mobile n'a pas (cf. ci-dessus). | Cohérent avec la correction du jeton ; à valider ensemble. |
| 🟡 Mineur | `gpsService.startTracking()` est défini mais ne semble pas appelé depuis les écrans chauffeur. | La remontée GPS pourrait ne jamais démarrer. | Vérifier l'appel à `startTracking(camionId)` après appairage et la permission localisation. |

## 4. Sécurité / configuration — bonnes pratiques production

- **Secrets** : `application-dev.properties` contient des identifiants en clair
  (`keycloak.admin.password=admin`, `spring.datasource…password=sasa`,
  `client-secret=JnibEKK4…`). En production : externaliser via variables
  d'environnement / coffre-fort, et **régénérer le client-secret** (il est désormais exposé).
- **CORS** : restreindre `cors.allowed-origins` au domaine réel du front (pas `*`).
- **TLS** : servir Keycloak, le backend et le web en HTTPS ; mettre à jour
  `environment.prod.ts` en conséquence.
- **Realm** : confirmer que `agileo-realm` et le client `agileo-front-app` existent bien
  en production (l'`app.module` d'Agileo committé pointe ailleurs : `RB-realm` / `Client_Agileo`).

## 5. Checklist de mise en production

- [ ] Ajouter `CamionController` (+ `TransporteurController`) au backend.
- [ ] Implémenter `/voyages/{id}/arrivee` et `/voyages/{id}/bl` (ou nettoyer le mobile).
- [ ] Corriger l'URL et la gestion du jeton dans l'app mobile.
- [ ] Créer/vérifier le client Keycloak `agileo-front-app` + redirect URIs de prod.
- [ ] Renseigner `environment.prod.ts` (apiUrl, url Keycloak).
- [ ] Externaliser les secrets, restreindre CORS, activer HTTPS, régénérer le client-secret.
- [ ] `npm install && npm run build:prod` puis déployer (`server.js` ou Docker/Nginx).
- [ ] Tests bout-en-bout : login SSO, CRUD chauffeurs/chantiers, carte GPS, exports Excel.
