import { config } from '../config.js';
import { db } from '../storage/db.js';

export class AIProviderService {
  static async getActiveModel() {
    const configuredModel = await db.getSetting('litellm_model', null);
    return configuredModel || config.litellm.defaultModel;
  }

  static async complete({ messages, temperature = 0.5, jsonMode = false, maxTokens = null, model = null }) {
    const targetModel = model || (await this.getActiveModel());
    const endpoint = `${config.litellm.baseUrl}/chat/completions`;

    const payload = {
      model: targetModel,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens || config.litellm.maxTokens,
      drop_params: true,
    };

    if (jsonMode) {
      payload.response_format = { type: 'json_object' };
    }

    let attempts = 0;
    const maxAttempts = 2;
    let lastError = null;

    while (attempts < maxAttempts) {
      attempts++;
      const startTime = Date.now();
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.litellm.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(config.litellm.timeout),
        });

        const durationMs = Date.now() - startTime;

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`LiteLLM HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const usage = data.usage || {};

        // Track stats asynchronously in settings
        this._recordUsage(targetModel, usage, durationMs).catch(() => {});

        return {
          content,
          model: targetModel,
          usage,
          durationMs,
        };
      } catch (err) {
        lastError = err;
        console.warn(`[AIProvider] Tentative ${attempts} échouée pour le modèle ${targetModel}:`, err.message);
        if (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    throw new Error(`Échec appel LiteLLM après ${maxAttempts} tentatives: ${lastError?.message}`);
  }

  static async completeJson({ systemPrompt, userPrompt, temperature = 0.2, model = null }) {
    const messages = [
      { role: 'system', content: `${systemPrompt}\n\nIMPORTANT: Tu DOIS répondre exclusivement par un objet JSON valide, sans formatage Markdown, sans balises \`\`\`json.` },
      { role: 'user', content: userPrompt },
    ];

    const result = await this.complete({
      messages,
      temperature,
      jsonMode: true,
      model,
    });

    try {
      let raw = result.content.trim();
      // Strip markdown code fences if LLM ignored instructions
      if (raw.startsWith('```json')) {
        raw = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      } else if (raw.startsWith('```')) {
        raw = raw.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      const parsed = JSON.parse(raw);
      return { data: parsed, meta: result };
    } catch (parseErr) {
      console.error('[AIProvider] Erreur parsing JSON LiteLLM:', result.content);
      throw new Error(`La réponse de l'IA n'est pas un JSON valide: ${parseErr.message}`);
    }
  }

  static async _recordUsage(model, usage, durationMs) {
    try {
      const stats = (await db.getSetting('ai_stats', {})) || {};
      stats.totalRequests = (stats.totalRequests || 0) + 1;
      stats.totalPromptTokens = (stats.totalPromptTokens || 0) + (usage.prompt_tokens || 0);
      stats.totalCompletionTokens = (stats.totalCompletionTokens || 0) + (usage.completion_tokens || 0);
      stats.totalTokens = (stats.totalTokens || 0) + (usage.total_tokens || 0);
      stats.lastLatencyMs = durationMs;
      stats.lastModel = model;
      stats.lastRequestAt = new Date().toISOString();
      await db.setSetting('ai_stats', stats);
    } catch {}
  }
}
