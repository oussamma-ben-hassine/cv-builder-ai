# Intégration Authentification SSO (OpenID Connect)

L'application utilise exclusivement le serveur d'authentification centralisé de l'écosystème : `https://sso-a.oussamma.tn/`.

## 1. Flux OIDC & PKCE

1. **Redirection (`GET /auth/login`)** :
   - Génération d'un `code_verifier` aléatoire et d'un `code_challenge` (`SHA-256` en `base64url`).
   - Génération d'un paramètre `state` signé par `HMAC-SHA256` pour prévenir toute attaque CSRF.
   - Redirection vers `https://sso-a.oussamma.tn/oauth/authorize`.
2. **Callback (`GET /auth/callback`)** :
   - Vérification cryptographique de la signature du `state`.
   - Échange du code d'autorisation contre un `access_token` via `POST /oauth/token` en incluant le `code_verifier`.
   - Récupération des claims utilisateur via `GET /oauth/userinfo`.
3. **Provisionnement Automatique** :
   - Association du compte local au claim `sub` unique.
   - Mise à jour automatique du nom, de l'email et de l'avatar à chaque connexion.

## 2. Variables d'Environnement

L'application supporte aussi bien la nomenclature `OIDC_*` que la nomenclature `SSO_*` de l'écosystème :

- `OIDC_ISSUER` / `SSO_BASE_URL` : `https://sso-a.oussamma.tn`
- `OIDC_CLIENT_ID` / `SSO_CLIENT_ID` : `client_cvbuilder_app`
- `OIDC_CLIENT_SECRET` / `SSO_CLIENT_SECRET` : Configuré dans Coolify (secret non committé)
- `OIDC_REDIRECT_URI` / `SSO_REDIRECT_URI` : `<APP_URL>/auth/callback`
- `OIDC_POST_LOGOUT_REDIRECT_URI` : `<APP_URL>/`
- `SESSION_SECRET` : Clé secrète de signature des cookies de session
