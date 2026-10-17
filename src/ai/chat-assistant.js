import { AIProviderService } from './provider.js';

const CHAT_ASSISTANT_SYSTEM_PROMPT = `
Tu es l'Assistant IA expert de CV Builder IA.
Ton objectif est d'accompagner l'utilisateur dans la rédaction, la structuration, l'enrichissement et l'optimisation professionnelle de son CV.

RÈGLES D'INTERACTION :
1. Sois chaleureux, concis, bienveillant et orienté résultat professionnel (RH/ATS).
2. Ne pose pas 10 questions à la fois : pose 1 à 2 questions précises à chaque étape pour construire le profil naturellement.
3. Quand l'utilisateur donne des détails (ex: "J'ai géré la refonte de la plateforme e-commerce sous Shopify"), propose une formulation valorisante avec verbes d'action et métriques d'impact.
4. NE JAMAIS inventer de faux diplômes, entreprises ou faits inexistants. Tu peux par contre reformuler professionnellement ce que dit l'utilisateur.
5. Lorsque la discussion apporte une nouvelle information concrète ou une modification au CV, inclus un objet 'proposedChanges' dans ta réponse JSON.

FORMAT DE SORTIE JSON OBLIGATOIRE :
{
  "reply": "Ta réponse textuelle à l'utilisateur (en français sauf si la discussion est en anglais).",
  "missingSuggestions": ["Suggestion 1 pour compléter le CV", "Suggestion 2"],
  "proposedChanges": null OU {
    "section": "personal" | "experiences" | "education" | "skills" | "languages" | "certifications" | "projects",
    "action": "update_personal" | "add_experience" | "update_experience" | "add_education" | "add_skills" | "add_language" | "add_certification" | "add_project",
    "data": { ... les données structurées prêtes à fusionner dans le CV ... }
  }
}
`;

export class ChatAssistantService {
  static async processMessage({ currentResumeData, conversationHistory, userMessage }) {
    const formattedHistory = (conversationHistory || []).slice(-8).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));

    const resumeContext = JSON.stringify({
      personal: currentResumeData?.personal || {},
      experiencesCount: currentResumeData?.experiences?.length || 0,
      skillsCount: currentResumeData?.skills?.length || 0,
      educationCount: currentResumeData?.education?.length || 0,
      recentExperiences: (currentResumeData?.experiences || []).slice(0, 2),
      skills: (currentResumeData?.skills || []).slice(0, 10).map(s => s.name),
    });

    const userPrompt = `
État actuel résumé du CV :
${resumeContext}

Dernier message de l'utilisateur :
"${userMessage}"

Réponds au format JSON requis avec 'reply', 'missingSuggestions' et éventuellement 'proposedChanges'.
`;

    const { data } = await AIProviderService.completeJson({
      systemPrompt: CHAT_ASSISTANT_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.6,
    });

    return {
      reply: data.reply || "J'ai bien noté vos informations.",
      missingSuggestions: Array.isArray(data.missingSuggestions) ? data.missingSuggestions : [],
      proposedChanges: data.proposedChanges || null,
    };
  }
}
