import crypto from 'crypto';
import { AIProviderService } from './provider.js';

export const SUPPORTED_LANGUAGES = {
  fr: {
    code: 'fr',
    name: 'Français',
    isRtl: false,
    labels: {
      summary: 'Profil Professionnel',
      experiences: 'Expériences Professionnelles',
      education: 'Formations & Diplômes',
      skills: 'Compétences',
      languages: 'Langues',
      certifications: 'Certifications',
      projects: 'Projets',
      present: 'Présent',
      role: 'Rôle',
      technologies: 'Technologies',
      defaultLevel: 'Courant',
      generalCategory: 'Général',
      degreeIn: ' en ',
    },
  },
  en: {
    code: 'en',
    name: 'English',
    isRtl: false,
    labels: {
      summary: 'Professional Summary',
      experiences: 'Work Experience',
      education: 'Education',
      skills: 'Skills',
      languages: 'Languages',
      certifications: 'Certifications',
      projects: 'Projects',
      present: 'Present',
      role: 'Role',
      technologies: 'Technologies',
      defaultLevel: 'Fluent',
      generalCategory: 'General',
      degreeIn: ' in ',
    },
  },
  ar: {
    code: 'ar',
    name: 'العربية',
    isRtl: true,
    labels: {
      summary: 'الملف المهني',
      experiences: 'الخبرات المهنية',
      education: 'التعليم والشهادات الأكاديمية',
      skills: 'المهارات',
      languages: 'اللغات',
      certifications: 'الشهادات المهنية',
      projects: 'المشاريع',
      present: 'الحالي',
      role: 'الدور',
      technologies: 'التقنيات',
      defaultLevel: 'بطلاقة',
      generalCategory: 'عام',
      degreeIn: ' في ',
    },
  },
  es: {
    code: 'es',
    name: 'Español',
    isRtl: false,
    labels: {
      summary: 'Perfil Profesional',
      experiences: 'Experiencia Profesional',
      education: 'Educación y Formación',
      skills: 'Competencias',
      languages: 'Idiomas',
      certifications: 'Certificaciones',
      projects: 'Proyectos',
      present: 'Actualidad',
      role: 'Rol',
      technologies: 'Tecnologías',
      defaultLevel: 'Fluido',
      generalCategory: 'General',
      degreeIn: ' en ',
    },
  },
  de: {
    code: 'de',
    name: 'Deutsch',
    isRtl: false,
    labels: {
      summary: 'Berufsprofil',
      experiences: 'Berufserfahrung',
      education: 'Ausbildung & Studium',
      skills: 'Kenntnisse & Fähigkeiten',
      languages: 'Sprachen',
      certifications: 'Zertifizierungen',
      projects: 'Projekte',
      present: 'Heute',
      role: 'Rolle',
      technologies: 'Technologien',
      defaultLevel: 'Fließend',
      generalCategory: 'Allgemein',
      degreeIn: ' in ',
    },
  },
  it: {
    code: 'it',
    name: 'Italiano',
    isRtl: false,
    labels: {
      summary: 'Profilo Professionale',
      experiences: 'Esperienza Professionale',
      education: 'Istruzione e Formazione',
      skills: 'Competenze',
      languages: 'Lingue',
      certifications: 'Certificazioni',
      projects: 'Progetti',
      present: 'Presente',
      role: 'Ruolo',
      technologies: 'Tecnologie',
      defaultLevel: 'Fluente',
      generalCategory: 'Generale',
      degreeIn: ' in ',
    },
  },
};

export class ResumeLanguageService {
  static getLanguageConfig(langCode = 'fr') {
    const clean = String(langCode || 'fr').toLowerCase().slice(0, 2);
    return SUPPORTED_LANGUAGES[clean] || SUPPORTED_LANGUAGES.fr;
  }

  static getLabels(langCode = 'fr') {
    return this.getLanguageConfig(langCode).labels;
  }

  /**
   * Normalizes spoken languages array regardless of whether items use
   * { name, level }, { language, level }, { langue, niveau }, or plain strings.
   */
  static normalizeSpokenLanguages(languages, langCode = 'fr') {
    if (!Array.isArray(languages)) return [];
    const defaultLevel = this.getLabels(langCode).defaultLevel;

    return languages
      .map((item, idx) => {
        if (!item) return null;
        if (typeof item === 'string') {
          const match = item.match(/^([^(:–-]+?)(?:[\s(:–-]+([^)]+)\)?$)?$/);
          const name = (match?.[1] || item).trim();
          const level = (match?.[2] || defaultLevel).trim();
          return name ? { id: `lang_${idx + 1}`, name, level } : null;
        }
        const name = String(item.name || item.language || item.langue || item.title || item.label || '').trim();
        const level = String(item.level || item.niveau || item.proficiency || item.fluency || defaultLevel).trim();
        if (!name) return null;
        return {
          id: item.id || `lang_${idx + 1}`,
          name,
          level: level || defaultLevel,
        };
      })
      .filter(Boolean);
  }

  static computeContentHash(data) {
    const core = {
      personal: {
        title: data?.personal?.title || data?.personal?.jobTitle || '',
        summary: data?.personal?.summary || '',
      },
      experiences: (data?.experiences || []).map(e => ({
        position: e.position,
        summary: e.summary || e.description,
        highlights: e.highlights || e.missions,
      })),
      education: (data?.education || []).map(e => ({
        degree: e.degree,
        field: e.field,
        summary: e.summary,
      })),
      skills: (data?.skills || []).map(s => ({
        category: s.category,
        name: s.name,
        level: s.level,
      })),
      languages: this.normalizeSpokenLanguages(data?.languages),
      projects: (data?.projects || []).map(p => ({
        name: p.name,
        description: p.description,
        role: p.role,
      })),
    };
    return crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex').slice(0, 16);
  }

  /**
   * Translates all translatable fields of a CV into targetLang transparently via LiteLLM.
   */
  static async translateResumeData(resumeData, targetLang = 'en') {
    const langCfg = this.getLanguageConfig(targetLang);
    const normalizedLangs = this.normalizeSpokenLanguages(resumeData?.languages, targetLang);

    const payloadToTranslate = {
      personal: {
        title: resumeData?.personal?.title || resumeData?.personal?.jobTitle || '',
        summary: resumeData?.personal?.summary || '',
        city: resumeData?.personal?.city || '',
        country: resumeData?.personal?.country || '',
      },
      experiences: (resumeData?.experiences || []).map(e => ({
        id: e.id,
        position: e.position || '',
        location: e.location || '',
        endDate: e.endDate || '',
        summary: e.summary || e.description || '',
        highlights: Array.isArray(e.highlights)
          ? e.highlights
          : [
              ...(Array.isArray(e.missions) ? e.missions : []),
              ...(Array.isArray(e.achievements) ? e.achievements : []),
            ],
      })),
      education: (resumeData?.education || []).map(e => ({
        id: e.id,
        degree: e.degree || '',
        field: e.field || '',
        summary: e.summary || e.description || '',
      })),
      skills: (resumeData?.skills || []).map(s => ({
        id: s.id,
        category: s.category || '',
        name: s.name || '',
        level: s.level || '',
      })),
      languages: normalizedLangs,
      certifications: (resumeData?.certifications || []).map(c => ({
        id: c.id,
        name: c.name || '',
        issuer: c.issuer || '',
      })),
      projects: (resumeData?.projects || []).map(p => ({
        id: p.id,
        name: p.name || '',
        role: p.role || '',
        description: p.description || '',
      })),
      customSections: Array.isArray(resumeData?.customSections) ? resumeData.customSections : [],
    };

    const hasContent =
      payloadToTranslate.personal.title ||
      payloadToTranslate.personal.summary ||
      payloadToTranslate.experiences.length > 0 ||
      payloadToTranslate.education.length > 0 ||
      payloadToTranslate.skills.length > 0 ||
      payloadToTranslate.languages.length > 0;

    if (!hasContent) {
      return {
        ...resumeData,
        language: langCfg.code,
        languages: normalizedLangs,
      };
    }

    const systemPrompt = `
Tu es un traducteur et expert RH international spécialisé dans l'adaptation multilingue de CV professionnels.
Ta mission est de traduire intégralement et fidèlement le contenu du CV fourni vers la langue cible : ${langCfg.name} (code ISO: "${langCfg.code}").

RÈGLES STRICTES :
1. Traduis tous les textes (titre professionnel, résumé, intitulés de postes, résumés d'expériences, réalisations/highlights, diplômes, domaines d'études, catégories et niveaux de compétences, noms et niveaux des langues parlées, rôles et descriptions de projets, sections personnalisées) en ${langCfg.name} avec un vocabulaire RH/ATS naturel et professionnel dans cette langue.
2. Ne supprime AUCUNE expérience, AUCUNE formation, AUCUNE compétence, AUCUNE langue parlée et AUCUN point de réalisation.
3. Conserve la structure JSON exacte fournie en entrée.
`;

    const userPrompt = `Traduis cet objet JSON de CV en ${langCfg.name} ("${langCfg.code}") :\n\n${JSON.stringify(payloadToTranslate)}`;

    const { data: translated } = await AIProviderService.completeJson({
      systemPrompt,
      userPrompt,
      temperature: 0.15,
      maxTokens: 8192,
    });

    const mergedExperiences = (resumeData?.experiences || []).map((orig, idx) => {
      const tr = (translated.experiences || []).find(x => x.id && x.id === orig.id) || translated.experiences?.[idx] || {};
      return {
        ...orig,
        position: tr.position || orig.position,
        location: tr.location || orig.location,
        endDate: tr.endDate || orig.endDate,
        summary: tr.summary !== undefined ? tr.summary : (orig.summary || orig.description || ''),
        highlights: Array.isArray(tr.highlights) && tr.highlights.length > 0
          ? tr.highlights
          : (orig.highlights || orig.missions || []),
      };
    });

    const mergedEducation = (resumeData?.education || []).map((orig, idx) => {
      const tr = (translated.education || []).find(x => x.id && x.id === orig.id) || translated.education?.[idx] || {};
      return {
        ...orig,
        degree: tr.degree || orig.degree,
        field: tr.field || orig.field,
        summary: tr.summary !== undefined ? tr.summary : (orig.summary || ''),
      };
    });

    const mergedSkills = (resumeData?.skills || []).map((orig, idx) => {
      const tr = (translated.skills || []).find(x => x.id && x.id === orig.id) || translated.skills?.[idx] || {};
      return {
        ...orig,
        category: tr.category || orig.category,
        name: tr.name || orig.name,
        level: tr.level || orig.level,
      };
    });

    const mergedLanguages = this.normalizeSpokenLanguages(
      Array.isArray(translated.languages) && translated.languages.length > 0
        ? translated.languages
        : normalizedLangs,
      langCfg.code
    );

    const mergedProjects = (resumeData?.projects || []).map((orig, idx) => {
      const tr = (translated.projects || []).find(x => x.id && x.id === orig.id) || translated.projects?.[idx] || {};
      return {
        ...orig,
        name: tr.name || orig.name,
        role: tr.role || orig.role,
        description: tr.description || orig.description,
      };
    });

    return {
      ...resumeData,
      language: langCfg.code,
      personal: {
        ...(resumeData?.personal || {}),
        title: translated.personal?.title || resumeData?.personal?.title || resumeData?.personal?.jobTitle || '',
        summary: translated.personal?.summary || resumeData?.personal?.summary || '',
        city: translated.personal?.city || resumeData?.personal?.city || '',
        country: translated.personal?.country || resumeData?.personal?.country || '',
      },
      experiences: mergedExperiences,
      education: mergedEducation,
      skills: mergedSkills,
      languages: mergedLanguages,
      projects: mergedProjects,
      customSections: Array.isArray(translated.customSections) ? translated.customSections : (resumeData?.customSections || []),
    };
  }
}
