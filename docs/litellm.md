# Intégration Passerelle IA LiteLLM

Toutes les fonctionnalités d'intelligence artificielle passent exclusivement par le service centralisé `AIProviderService` (`src/ai/provider.js`) connecté à l'instance LiteLLM de l'écosystème (`https://ai.oussamma.tn/v1`).

## 1. Configuration

- `LITELLM_BASE_URL` : `https://ai.oussamma.tn/v1`
- `LITELLM_API_KEY` : Clé API de la passerelle (configurée uniquement côté backend dans Coolify)
- `LITELLM_MODEL` / `LITELLM_DEFAULT_MODEL` : `gemini/gemini-3.1-flash-lite-preview` (modifiable à chaud depuis le backoffice administrateur)
- `LITELLM_TIMEOUT` : `60000` (ms)
- `LITELLM_MAX_TOKENS` : `4096`

## 2. Fonctionnalités Centralisées dans `AIProviderService`

- **Sorties JSON Structurées** : Utilisation de `response_format: { type: 'json_object' }` et nettoyage défensif des balises Markdown éventuelles.
- **Tolérance aux Pannes** : Tentatives de reprise automatiques (retries) et timeout strict (`AbortSignal.timeout`).
- **Protection contre l'Injection de Prompt** : Filtrage des instructions impératives cachées dans les PDF importés.
- **Suivi de Consommation** : Comptabilisation des requêtes, tokens (`prompt_tokens`, `completion_tokens`) et latence consultables dans le backoffice Admin.
