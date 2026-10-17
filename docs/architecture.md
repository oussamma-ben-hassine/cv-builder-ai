# Architecture Générale & Choix Techniques

## 1. Analyse de l'Existant Open Source (Reactive Resume)

Conformément au cahier des charges, une étude approfondie du projet open source **Reactive Resume v4** (`reactive-resume/reactive-resume`, licence MIT) a été menée :

| Critère | Constat sur Reactive Resume v4 | Décision pour CV Builder IA |
| :--- | :--- | :--- |
| **Licence** | MIT (permissive) | Compatible |
| **Empreinte Docker** | Requiert 5 conteneurs lourds : NestJS, PostgreSQL, Redis, MinIO (S3) et Browserless Chrome (~1.5 Go RAM minimum) | Trop lourd pour cohabiter efficacement avec les 12+ applications du VPS Coolify |
| **Authentification** | Couplée aux mots de passe locaux + OAuth GitHub/Google en dur | Remplacée par un flux OIDC + PKCE exclusif vers `sso-a.oussamma.tn` sans mot de passe local |
| **Intégration IA** | Clé OpenAI stockée côté client dans le navigateur | Remplacée par `AIProviderService` côté backend connecté à la passerelle LiteLLM de l'écosystème |
| **Création Conversationnelle** | Absente | Développée sur mesure avec historique par CV et prévisualisation des modifications |
| **Export DOCX** | Simplifié / non structuré nativement | Moteur dédié via la bibliothèque open-source `docx` produisant de vrais styles Word modifiables |

### Conclusion Architecturale
Nous avons retenu une **architecture modulaire légère inspirée du schéma JSON Resume / Reactive Resume**, tout en réutilisant les meilleures bibliothèques open source spécialisées (`docx` MIT, `pdf-parse` MIT, `express` MIT, `pg` MIT) et les conventions éprouvées de l'écosystème (`notes.oussamma.tn`, `recettes.oussamma.tn`).

## 2. Composants Applicatifs

```
cv-builder-ai/
├── src/
│   ├── server.js               # Serveur HTTP Express, middlewares de sécurité & routes API
│   ├── config.js               # Gestion centralisée des variables d'environnement (OIDC_*, SSO_*, LITELLM_*)
│   ├── auth/
│   │   ├── oidc.js             # Client OIDC Authorization Code Flow + PKCE S256
│   │   └── session.js          # Sessions stateless signées HMAC-SHA256
│   ├── ai/
│   │   ├── provider.js         # AIProviderService (LiteLLM, JSON mode, retries, métriques)
│   │   ├── pdf-importer.js     # Extraction texte PDF + structuration JSON via LiteLLM
│   │   ├── linkedin-importer.js# Import PDF LinkedIn + guide d'export légal
│   │   └── chat-assistant.js   # Assistant conversationnel de construction de CV
│   ├── export/
│   │   └── docx-generator.js   # Générateur Word .docx natif et modifiable
│   ├── storage/
│   │   ├── db.js               # Couche d'accès aux données (PostgreSQL + fallback JSON atomique)
│   │   └── schema.sql          # Schéma DDL PostgreSQL complet
│   └── templates/
│       └── registry.js         # Registre des 9 templates A4 + moteur de rendu HTML/CSS imprimable
├── public/                     # Interface SPA responsive (Desktop Split-Screen / Mobile Tabs + PWA)
└── tests/
    └── cv-builder.test.js      # Suite de tests automatisés exécutée à chaque build Docker
```

## 3. Flux de Données et Isolation

- Toutes les routes `/api/resumes/*`, `/api/ai/*` et `/api/export/*` exigent une session OIDC valide (`requireAuth`).
- Chaque requête en base filtre systématiquement par `user_id` (dérivé du `sub` OIDC), garantissant une isolation stricte entre les utilisateurs.
