# CV Builder IA — Plateforme Intelligente de Création et Gestion de CV

Application web autonome de création, d'importation intelligente, d'optimisation par IA et d'export multi-format (PDF A4 & Microsoft Word DOCX modifiable) de CV professionnels, intégrée à l'écosystème souverain (`*.oussamma.tn`).

## Fonctionnalités Principales

1. **Authentification Exclusive SSO (OIDC + PKCE)**
   - Connexion centralisée via `https://sso-a.oussamma.tn`.
   - Aucun mot de passe local : provisionnement automatique du profil local rattaché au `sub` OIDC.
   - Sessions signées cryptographiquement (`HMAC-SHA256`) dans des cookies `HttpOnly`.

2. **Trois Méthodes de Création de CV**
   - **Méthode 1 — Éditeur Manuel Structuré** : Formulaire complet (Informations personnelles, Photo, Expériences, Formations, Compétences, Langues, Certifications, Projets, Sections personnalisées), réorganisation, duplication, annulation (`Undo`/`Redo`), sauvegarde automatique et aperçu A4 en temps réel.
   - **Méthode 2 — Import Intelligent PDF & LinkedIn** : Extraction de texte PDF (`pdf-parse`) couplée à une structuration JSON stricte via LiteLLM, signalement des champs incertains et étape de validation avant enregistrement.
   - **Méthode 3 — Assistant Conversationnel IA** : Discussion interactive intégrée à l'éditeur permettant de bâtir le CV pas à pas, reformuler les réalisations avec des verbes d'action et prévisualiser/appliquer les modifications proposées en un clic.

3. **Galerie de 9 Templates A4 & Personnalisation**
   - Modèles inclus : *Moderne*, *Classique*, *Minimaliste*, *Professionnel*, *Créatif*, *Deux colonnes*, *ATS Standard*, *Avec Photo*, *Sans Photo*.
   - Personnalisation des couleurs d'accentuation, polices (`Inter`, `Roboto`, `Montserrat`, `Georgia`, `Calibri`) et tailles de texte.

4. **Exports Professionnels Doubles**
   - **PDF A4** : Texte sélectionnable, liens cliquables (`mailto:`, `tel:`, `https://`), polices intégrées et respect des sauts de page.
   - **Word DOCX** : Document `.docx` nativement modifiable généré via la bibliothèque open-source `docx` (titres, paragraphes, listes à puces et styles Word structurés).

5. **Multi-CV, Versions, RGPD & Administration**
   - Gestion de plusieurs CV par utilisateur, profil professionnel de référence, archivage et historique des versions avec restauration.
   - Export complet des données personnelles (JSON) et suppression de compte (RGPD).
   - Backoffice administrateur : statistiques agrégées, choix du modèle LiteLLM actif, gestion des rôles et journaux d'audit.

## Démarrage Rapide avec Docker

```bash
# 1. Copier le fichier d'environnement
cp .env.example .env

# 2. Démarrer la pile complète (Application + PostgreSQL)
docker compose up -d --build

# 3. Vérifier l'état de santé
curl http://localhost:3000/health
```

## Documentation Détaillée

- [Architecture & Analyse Open Source (Reactive Resume)](docs/architecture.md)
- [Intégration Authentification SSO OIDC](docs/sso.md)
- [Intégration Passerelle IA LiteLLM](docs/litellm.md)
- [Déploiement Coolify & Sauvegardes](docs/coolify.md)
- [Guide de Développement & Tests](docs/development.md)
