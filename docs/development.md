# Guide de Développement, Tests & Livraison

## 1. Commandes Standard (Docker)

Conformément aux principes de l'écosystème, toutes les opérations de construction et de test s'exécutent dans Docker :

```bash
# Construire l'image et exécuter la suite de tests automatisés
docker build -t cvbuilder-app:latest .

# Démarrer l'environnement complet avec PostgreSQL
docker compose up -d

# Consulter les logs
docker compose logs -f cvbuilder-app
```

## 2. Suite de Tests Automatisés

Le fichier `tests/cv-builder.test.js` vérifie systématiquement :
1. La génération et la vérification cryptographique OIDC PKCE (`S256`) et du paramètre `state`.
2. La signature et la résistance à la falsification des cookies de session (`HMAC-SHA256`).
3. Le rendu HTML A4 des 9 templates avec caractères accentués, liens cliquables et expériences longues multipages.
4. La génération d'un fichier Microsoft Word `.docx` nativement modifiable (`DocxGeneratorService`).
5. L'isolation stricte des données entre utilisateurs dans la couche de persistance.

## 3. Procédure de Livraison

1. Développer sur une branche dédiée ou valider localement.
2. Vérifier que les tests passent lors du build Docker.
3. Pousser sur `main` (`https://github.com/oussamma-ben-hassine/cv-builder-ai`).
4. Déclencher ou vérifier le déploiement automatique dans Coolify et contrôler `GET /health`.
