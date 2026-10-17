import { createRequire } from 'module';
import { AIProviderService } from './provider.js';
import { ResumeLanguageService } from './language-service.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

const RESUME_EXTRACTION_SYSTEM_PROMPT = `
Tu es un expert mondial en analyse et extraction multi-pages de CV (ATS & Recrutement International).
Ta mission est d'extraire TOUTES les informations factuelles de TOUTES LES PAGES du CV fourni et de les convertir en un objet JSON strictement structuré selon le schéma suivant.

RÈGLES ABSOLUES :
1. LECTURE MULTI-PAGES EXHAUSTIVE : Lis le document de la première à la toute dernière ligne de la dernière page. Ne t'arrête JAMAIS après la première page. Extrais ABSOLUMENT TOUTES les expériences professionnelles (même s'il y en a 10+ réparties sur plusieurs pages), TOUTES les formations, TOUTES les compétences, TOUTES les langues parlées, TOUTES les certifications et TOUS les projets.
2. NE JAMAIS INVENTER de données (aucun faux diplôme, date inexistante, entreprise inventée).
3. Conserve fidèlement l'intégralité des réalisations, missions, technologies et dates de chaque poste sans tronquer le parcours.
4. Détecte la langue principale de rédaction du CV parmi : "fr", "en", "ar", "es", "de", "it".
5. LECTURE DES LANGUES PARLÉES : Extrais soigneusement toutes les langues mentionnées dans le CV (ex: Français, Anglais, Arabe, Espagnol, Allemand...) ainsi que leur niveau (ex: Langue maternelle, Bilingue, Courant, C2, C1, B2, TOEIC...) dans le tableau "languages" avec les clés "name" et "level".
6. Identifie les champs réellement incertains ou manquants dans le tableau "uncertainOrMissingFields".

SCHÉMA JSON REQUIS :
{
  "language": "fr",
  "uncertainOrMissingFields": ["Ex: Téléphone non mentionné"],
  "personal": {
    "firstName": "Prénom",
    "lastName": "Nom",
    "title": "Titre professionnel ciblé",
    "email": "email@example.com",
    "phone": "+33 6 ...",
    "city": "Ville",
    "country": "Pays",
    "summary": "Paragraphe complet de présentation professionnelle",
    "linkedin": "url ou identifiant",
    "github": "url ou identifiant",
    "website": "url portfolio ou site web"
  },
  "experiences": [
    {
      "id": "exp_1",
      "company": "Nom Entreprise",
      "position": "Intitulé du poste",
      "location": "Ville, Pays",
      "startDate": "YYYY-MM ou YYYY",
      "endDate": "YYYY-MM ou Présent",
      "current": false,
      "summary": "Résumé du rôle et du contexte",
      "highlights": ["Réalisation / mission détaillée 1", "Réalisation / mission détaillée 2"],
      "technologies": ["Tech 1", "Tech 2"]
    }
  ],
  "education": [
    {
      "id": "edu_1",
      "institution": "Nom Établissement / Université",
      "degree": "Diplôme (ex: Master, Licence, Ingénieur)",
      "field": "Domaine d'études",
      "startDate": "YYYY",
      "endDate": "YYYY",
      "summary": "Détails ou mentions"
    }
  ],
  "skills": [
    {
      "id": "sk_1",
      "category": "Technique / Métier",
      "name": "Nom de la compétence",
      "level": "Expert / Avancé / Intermédiaire"
    }
  ],
  "languages": [
    {
      "id": "lang_1",
      "name": "Français",
      "level": "Langue maternelle / Bilingue / C1 / Courant"
    }
  ],
  "certifications": [
    {
      "id": "cert_1",
      "name": "Nom de la certification",
      "issuer": "Organisme émetteur",
      "date": "YYYY",
      "url": "URL de vérification si présente"
    }
  ],
  "projects": [
    {
      "id": "proj_1",
      "name": "Nom du projet",
      "description": "Description détaillée",
      "role": "Rôle tenu",
      "technologies": ["Outil 1", "Outil 2"],
      "url": "Lien du projet"
    }
  ],
  "customSections": []
}
`;

export class PDFImporterService {
  static async parsePdfBuffer(buffer) {
    if (!buffer || buffer.length === 0) {
      throw new Error('Buffer PDF vide ou invalide.');
    }

    // Extract text from ALL pages of the PDF (max: 0 = unlimited pages)
    const parsedPdf = await pdfParse(buffer, { max: 0 });
    const rawText = parsedPdf.text ? parsedPdf.text.trim() : '';
    const pageCount = parsedPdf.numpages || 1;

    if (!rawText || rawText.length < 20) {
      throw new Error('Le document PDF semble vide ou est une image scannée non indexée. Veuillez utiliser un PDF avec du texte sélectionnable ou utiliser la méthode manuelle/conversationnelle.');
    }

    // Sanitize against prompt injection inside PDF and support long multi-page CVs (up to 45,000 chars)
    const sanitizedText = rawText
      .replace(/ignore (all )?(previous|above) instructions/gi, '[FILTRÉ]')
      .substring(0, 45000);

    const userPrompt = `Voici le texte intégral extrait des ${pageCount} page(s) du CV PDF (traite l'intégralité du texte du début à la fin sans omettre aucune page ni aucune expérience) :\n\n---\n${sanitizedText}\n---\n\nExtrais et structure l'intégralité de ce CV en JSON selon le schéma défini.`;

    const { data } = await AIProviderService.completeJson({
      systemPrompt: RESUME_EXTRACTION_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.1,
      maxTokens: 8192,
    });

    const normalized = this._normalizeExtractedData(data);
    normalized.detectedPages = pageCount;
    return normalized;
  }

  static _normalizeExtractedData(data = {}) {
    const langCfg = ResumeLanguageService.getLanguageConfig(data.language || 'fr');
    const p = data.personal || data.personalInfo || {};

    return {
      language: langCfg.code,
      uncertainOrMissingFields: Array.isArray(data.uncertainOrMissingFields) ? data.uncertainOrMissingFields : [],
      personal: {
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        title: p.title || p.jobTitle || '',
        email: p.email || '',
        phone: p.phone || '',
        city: p.city || '',
        country: p.country || '',
        summary: p.summary || '',
        linkedin: p.linkedin || '',
        github: p.github || '',
        website: p.website || p.portfolio || '',
        photo: p.photo || '',
      },
      experiences: Array.isArray(data.experiences) ? data.experiences.map((exp, i) => {
        const highlights = Array.isArray(exp.highlights) && exp.highlights.length > 0
          ? exp.highlights
          : [
              ...(Array.isArray(exp.missions) ? exp.missions : []),
              ...(Array.isArray(exp.achievements) ? exp.achievements : []),
            ];
        return {
          id: exp.id || `exp_${i + 1}`,
          company: exp.company || '',
          position: exp.position || exp.title || '',
          location: exp.location || '',
          startDate: exp.startDate || '',
          endDate: exp.endDate || '',
          current: !!exp.current,
          summary: exp.summary || exp.description || '',
          highlights,
          technologies: Array.isArray(exp.technologies) ? exp.technologies : [],
        };
      }) : [],
      education: Array.isArray(data.education) ? data.education.map((edu, i) => ({
        id: edu.id || `edu_${i + 1}`,
        institution: edu.institution || edu.school || '',
        degree: edu.degree || '',
        field: edu.field || '',
        startDate: edu.startDate || '',
        endDate: edu.endDate || '',
        summary: edu.summary || edu.description || '',
      })) : [],
      skills: Array.isArray(data.skills) ? data.skills.map((sk, i) => ({
        id: sk.id || `sk_${i + 1}`,
        category: sk.category || langCfg.labels.generalCategory,
        name: typeof sk === 'string' ? sk : (sk.name || ''),
        level: sk.level || '',
      })) : [],
      languages: ResumeLanguageService.normalizeSpokenLanguages(data.languages, langCfg.code),
      certifications: Array.isArray(data.certifications) ? data.certifications.map((c, i) => ({
        id: c.id || `cert_${i + 1}`,
        name: c.name || '',
        issuer: c.issuer || '',
        date: c.date || '',
        url: c.url || '',
      })) : [],
      projects: Array.isArray(data.projects) ? data.projects.map((pItem, i) => ({
        id: pItem.id || `proj_${i + 1}`,
        name: pItem.name || '',
        description: pItem.description || '',
        role: pItem.role || '',
        technologies: Array.isArray(pItem.technologies) ? pItem.technologies : [],
        url: pItem.url || '',
      })) : [],
      customSections: Array.isArray(data.customSections) ? data.customSections : [],
    };
  }
}
