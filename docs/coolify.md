# Déploiement Coolify & Exploitation

## 1. Ressource Coolify

- **Projet Coolify** : `cv.oussamma.tn` (`qqoqfsxpnlhyxm5jnxzyt1bc`)
- **Application UUID** : `fgsig3a5qv8fl5npseoryxxx`
- **Dépôt GitHub** : `oussamma-ben-hassine/cv-builder-ai` (branche `main`)
- **Build Pack** : `Dockerfile` (avec exécution intégrée des tests unitaires et d'intégration pendant le build)
- **Port exposé** : `3000`
- **Healthcheck** : `GET /health`

## 2. Variables d'Environnement Configurées dans Coolify

- `PORT=3000`
- `NODE_ENV=production`
- `APP_URL` : Domaine HTTPS attribué par Coolify
- `SSO_BASE_URL=https://sso-a.oussamma.tn`
- `SSO_CLIENT_ID=client_cvbuilder_app`
- `SSO_CLIENT_SECRET=<configuré_dans_coolify>`
- `SSO_REDIRECT_URI=<APP_URL>/auth/callback`
- `LITELLM_BASE_URL=https://ai.oussamma.tn/v1`
- `LITELLM_API_KEY=<configuré_dans_coolify>`
- `LITELLM_DEFAULT_MODEL=gemini/gemini-3.1-flash-lite-preview`
- `SESSION_SECRET=<configuré_dans_coolify>`
- `DATA_DIR=/app/data`

## 3. Sauvegardes & Restauration

- **Base PostgreSQL** : Sauvegarde via `pg_dump -U cvbuilder cvbuilder > backup.sql` et restauration via `psql -U cvbuilder cvbuilder < backup.sql`.
- **Export Utilisateur Autonome** : Chaque utilisateur peut exporter l'intégralité de ses CV au format JSON via `/api/account/export`.
