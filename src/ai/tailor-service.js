import { AIProviderService } from './provider.js';
import { ResumeLanguageService } from './language-service.js';

const TAILOR_SYSTEM_PROMPT = `
Tu es un Architecte de Carrière et Expert ATS / Recrutement Exécutif.
Ta mission est de RÉSUMER, CONDENSER et ORIENTER un CV existant en fonction d'un PROMPT SPÉCIAL (besoin spécifique, offre d'emploi, mission freelance, changement de cap ou contrainte de longueur comme tenir sur 1 page).

RÈGLES D'OR :
1. VÉRACITÉ STRICTE : Ne jamais inventer une entreprise, un diplôme ou une date qui n'existe pas dans le CV d'origine.
2. ORIENTATION CIBLÉE : Reformule le titre professionnel, le résumé (profil), les descriptions et les réalisations (highlights) pour mettre en avant ce qui correspond au prompt spécial de l'utilisateur.
3. GESTION DE LA LONGUEUR :
   - Si targetLength = "1_page" : condense les expériences (2 à 3 bullet points ultra-percutants par poste récent, 1 ligne pour les postes anciens) et synthétise le profil en 3 lignes pour garantir un CV d'une seule page A4 dense et lisible.
   - Si targetLength = "detailed" : développe les réalisations techniques et méthodologiques sur toutes les expériences pertinentes.
   - Si targetLength = "executive" : adopte un ton exécutif/leadership orienté ROI, architecture, stratégie et résultats chiffrés.
4. LANGUE : Rédige l'intégralité du résultat dans la langue cible demandée (targetLanguage).
5. Conserve impérativement toutes les langues parlées du candidat dans le tableau "languages" sous la forme [{"id":"lang_1","name":"...","level":"..."}].

SCHÉMA JSON DE SORTIE OBLIGATOIRE :
{
  "executivePitch": "Synthèse / Pitch percutant de 3 à 5 phrases répondant exactement au prompt spécial (utilisable aussi en message d'accompagnement ou pitch recruteur)",
  "tailoringNotes": [
    "Point 1 expliquant comment le CV a été orienté ou résumé",
    "Point 2..."
  ],
  "tailoredData": {
    "language": "fr",
    "personal": {
      "firstName": "...",
      "lastName": "...",
      "title": "Titre professionnel orienté selon le besoin",
      "email": "...",
      "phone": "...",
      "city": "...",
      "country": "...",
      "summary": "Profil professionnel résumé et orienté selon le prompt spécial",
      "linkedin": "...",
      "github": "...",
      "website": "..."
    },
    "experiences": [
      {
        "id": "exp_1",
        "company": "...",
        "position": "...",
        "location": "...",
        "startDate": "...",
        "endDate": "...",
        "current": false,
        "summary": "...",
        "highlights": ["Réalisation orientée 1", "Réalisation orientée 2"],
        "technologies": ["Tech 1", "Tech 2"]
      }
    ],
    "education": [
      {
        "id": "edu_1",
        "institution": "...",
        "degree": "...",
        "field": "...",
        "startDate": "...",
        "endDate": "...",
        "summary": "..."
      }
    ],
    "skills": [
      {
        "id": "sk_1",
        "category": "...",
        "name": "...",
        "level": "..."
      }
    ],
    "languages": [
      {
        "id": "lang_1",
        "name": "...",
        "level": "..."
      }
    ],
    "certifications": [
      {
        "id": "cert_1",
        "name": "...",
        "issuer": "...",
        "date": "...",
        "url": "..."
      }
    ],
    "projects": [
      {
        "id": "proj_1",
        "name": "...",
        "description": "...",
        "role": "...",
        "technologies": ["..."],
        "url": "..."
      }
    ]
  }
}
`;

export class ResumeTailorService {
  static async summarizeAndOrient({ resumeData, customPrompt, targetLength = 'auto', targetLanguage = 'fr' }) {
    if (!customPrompt || !customPrompt.trim()) {
      throw new Error('Veuillez saisir une instruction ou un prompt spécial pour orienter le CV.');
    }

    const langCfg = ResumeLanguageService.getLanguageConfig(targetLanguage);
    const normalizedLangs = ResumeLanguageService.normalizeSpokenLanguages(resumeData?.languages, langCfg.code);

    const cleanSource = {
      personal: {
        ...(resumeData?.personal || {}),
        photo: undefined, // Do not send base64 photo to LLM
      },
      experiences: resumeData?.experiences || [],
      education: resumeData?.education || [],
      skills: resumeData?.skills || [],
      languages: normalizedLangs,
      certifications: resumeData?.certifications || [],
      projects: resumeData?.projects || [],
      customSections: resumeData?.customSections || [],
    };

    const userPrompt = `
PROMPT SPÉCIAL / BESOIN SPÉCIFIQUE DE L'UTILISATEUR :
"${customPrompt.trim()}"

PARAMÈTRES CIBLES :
- Format / Longueur souhaitée (targetLength) : ${targetLength}
- Langue de rédaction cible (targetLanguage) : ${langCfg.name} ("${langCfg.code}")

DONNÉES ACTUELLES DU CV :
${JSON.stringify(cleanSource)}

Génère l'objet JSON contenant "executivePitch", "tailoringNotes" et "tailoredData" orienté selon ce besoin spécifique.
`;

    const { data } = await AIProviderService.completeJson({
      systemPrompt: TAILOR_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.3,
      maxTokens: 8192,
    });

    const td = data.tailoredData || {};

    const mergedData = {
      ...resumeData,
      language: langCfg.code,
      personal: {
        ...(resumeData?.personal || {}),
        ...(td.personal || {}),
        photo: resumeData?.personal?.photo || '',
      },
      experiences: Array.isArray(td.experiences) ? td.experiences : (resumeData?.experiences || []),
      education: Array.isArray(td.education) ? td.education : (resumeData?.education || []),
      skills: Array.isArray(td.skills) ? td.skills : (resumeData?.skills || []),
      languages: ResumeLanguageService.normalizeSpokenLanguages(
        Array.isArray(td.languages) && td.languages.length > 0 ? td.languages : normalizedLangs,
        langCfg.code
      ),
      certifications: Array.isArray(td.certifications) ? td.certifications : (resumeData?.certifications || []),
      projects: Array.isArray(td.projects) ? td.projects : (resumeData?.projects || []),
      customSections: Array.isArray(td.customSections) ? td.customSections : (resumeData?.customSections || []),
    };

    // If user asked for 1_page, also set compact font/spacing automatically if not already set
    if (targetLength === '1_page') {
      mergedData.style = {
        ...(mergedData.style || {}),
        fontSize: '12.5px',
        spacing: '1.32',
      };
    }

    return {
      executivePitch: data.executivePitch || mergedData.personal?.summary || '',
      tailoringNotes: Array.isArray(data.tailoringNotes) ? data.tailoringNotes : [],
      tailoredData: mergedData,
    };
  }
}
