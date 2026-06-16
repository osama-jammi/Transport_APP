# Transport-Livraison — Interface Web Administration (Angular)

Version **2.0** — réécriture complète en Angular 16 de l'ancienne interface HTML
(`Transport-Web`), avec authentification **Keycloak SSO** identique à DivNet/Agileo.

> **Pourquoi cette v2 ?** L'ancienne interface (`Transport-Web/index.html` + `server.js`)
> plantait au retour de Keycloak avec `Not found: /?state=...&code=...` : le mini-serveur
> Node interprétait la *query string* du callback OAuth comme un nom de fichier.
> Ici, le callback est géré nativement par `keycloak-js` (flux Authorization Code + PKCE),
> et le serveur de production applique un **fallback SPA** vers `index.html`.

---

## 1. Stack technique

| Élément        | Choix                                          |
|----------------|------------------------------------------------|
| Framework      | Angular 16 (mêmes versions qu'Agileo)          |
| Auth           | `keycloak-angular` 14 + `keycloak-js` 25       |
| Cartographie   | Leaflet 1.9 (OpenStreetMap)                    |
| Notifications  | ngx-toastr                                     |
| Backend ciblé  | `http://localhost:8082/Transport_DEV/api`      |

## 2. Prérequis

- Node.js 18+ et npm
- Backend `Transport-BackEnd` démarré sur le port **8082**
- Keycloak démarré sur le port **8080**, realm **`agileo-realm`**

## 3. Installation & démarrage (développement)

```bash
cd Transport-Web-Angular
npm install
npm start            # ng serve + proxy vers le backend, http://localhost:4200
```

Le fichier `proxy.conf.json` redirige `/Transport_DEV/*` vers `http://localhost:8082`,
ce qui évite tout souci de CORS en développement.

## 4. Configuration Keycloak (client web)

L'application réutilise le client public **`agileo-front-app`** du realm `agileo-realm`
(le même que celui ciblé par l'ancienne interface). Dans la console Keycloak, ouvrez ce
client et vérifiez :

| Réglage                     | Valeur                                            |
|-----------------------------|---------------------------------------------------|
| Client type                 | **Public** (OpenID Connect)                       |
| Standard flow               | **Enabled**                                       |
| Valid redirect URIs         | `http://localhost:4200/*` (+ URL de prod)         |
| Valid post logout redirect  | `http://localhost:4200/*` (+ URL de prod)         |
| Web origins                 | `http://localhost:4200` (+ URL de prod), ou `+`   |
| PKCE method                 | `S256`                                            |

> Les valeurs `url` / `realm` / `clientId` sont centralisées dans
> `src/environments/environment.ts` (dev) et `environment.prod.ts` (prod).
> **Adaptez `environment.prod.ts`** à votre domaine avant de builder pour la production.

## 5. Build & déploiement (production)

### Option A — Serveur Node fourni (fallback SPA)

```bash
npm run build:prod          # génère dist/transport-web
npm run serve:prod          # sert dist/ sur http://localhost:3000 avec fallback SPA
```

### Option B — Docker + Nginx (recommandé)

```bash
docker build -t transport-web .
docker run -p 8088:80 transport-web
```

Le `nginx.conf` fourni applique le fallback SPA et proxifie `/Transport/api/`
vers le backend (adaptez l'`upstream`).

## 6. Structure

```
src/app/
├── core/         keycloak-init · auth.guard · token.interceptor · models
├── services/     un service par entité (voyage, chauffeur, camion, chantier, article, gps, rapport)
├── features/     une page par entité (+ dashboard)
├── app.component.ts   layout (sidebar + topbar)
├── app.module.ts      bootstrap + APP_INITIALIZER Keycloak + intercepteur
└── app-routing.module.ts   routes protégées par AuthGuard
```

## 7. Fonctionnalités couvertes

- **Tableau de bord** : indicateurs (voyages en cours, chauffeurs/chantiers actifs, camions occupés) + voyages en cours.
- **Voyages** : liste en cours / archives (filtre période), création, archivage, suppression.
- **Chauffeurs** : CRUD complet + affichage/téléchargement du QR code.
- **Camions** : CRUD (prêt — *nécessite l'ajout d'un `CamionController` côté backend*, voir `AUDIT.md`).
- **Chantiers** : CRUD + archivage/réactivation.
- **Articles** : import depuis GAP, scan (chargement/livraison), QR code.
- **Suivi GPS** : carte Leaflet temps réel (rafraîchissement 15 s) + tableau des positions.
- **Rapports** : exports Excel (Synthèse, Détaillé, Réserves, Non livrés) sur période.

## 8. Sécurité

- `onLoad: 'login-required'` → aucune page n'est accessible sans connexion.
- `TokenInterceptor` ajoute le Bearer JWT à chaque appel `/api`, rafraîchit le token
  (`updateToken(20)`) et gère 401/403.
- `AuthGuard` permet une restriction fine par rôle via `route.data.roles`.

## 9. À vérifier avant la mise en production

Voir le rapport **`AUDIT.md`** : points bloquants identifiés côté backend et mobile
(endpoints manquants, incohérences d'URL/token de l'app mobile).
