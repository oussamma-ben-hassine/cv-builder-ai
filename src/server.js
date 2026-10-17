import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config.js';
import { db } from './storage/db.js';
import { SessionManager } from './auth/session.js';
import { OIDCAuthService, authenticateUser, requireAuth, requireAdmin } from './auth/oidc.js';
import { AIProviderService } from './ai/provider.js';
import { PDFImporterService } from './ai/pdf-importer.js';
import { LinkedInImporterService } from './ai/linkedin-importer.js';
import { ChatAssistantService } from './ai/chat-assistant.js';
import { ResumeLanguageService, SUPPORTED_LANGUAGES } from './ai/language-service.js';
import { ResumeTailorService } from './ai/tailor-service.js';
import { DocxGeneratorService } from './export/docx-generator.js';
import { TEMPLATES, renderTemplateHtml } from './templates/registry.js';
import { trackCvEvent } from './supervisor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

// Security and middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In-memory PKCE state cache (short-lived)
const pkceStates = new Map();

// Simple in-memory rate limiter for AI endpoints
const aiRateMap = new Map();
function rateLimitAI(req, res, next) {
  const key = req.user?.id || req.ip || 'anon';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxReqs = 25;

  const entry = aiRateMap.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  aiRateMap.set(key, entry);

  if (entry.count > maxReqs) {
    return res.status(429).json({ error: 'Limite de requêtes IA atteinte. Veuillez patienter une minute.' });
  }
  next();
}

// Multer upload config for PDF
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier non supporté. Veuillez importer un document PDF valide.'));
    }
  },
});

// User session middleware
app.use(authenticateUser);

// ==========================================
// HEALTHCHECK
// ==========================================
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    app: 'cv-builder-ai',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    database: db.isPg ? 'postgresql' : 'local_json',
    sso: config.sso.baseUrl,
  });
});

// ==========================================
// AUTH & OIDC SSO
// ==========================================
function resolveRedirectUri(req) {
  const host = req.get('host');
  if (host && (host.endsWith('.oussamma.tn') || host.startsWith('localhost'))) {
    const proto = host.startsWith('localhost') ? 'http' : 'https';
    return `${proto}://${host}/auth/callback`;
  }
  return config.sso.redirectUri;
}

app.get('/auth/login', (req, res) => {
  const { code_verifier, code_challenge } = OIDCAuthService.generatePKCE();
  const state = OIDCAuthService.generateSignedState();
  const redirectUri = resolveRedirectUri(req);

  pkceStates.set(state, {
    verifier: code_verifier,
    redirectUri,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  for (const [k, v] of pkceStates.entries()) {
    if (Date.now() > v.expiresAt) pkceStates.delete(k);
  }

  const authUrl = OIDCAuthService.getAuthorizationUrl(redirectUri, state, code_challenge);
  res.redirect(authUrl);
});

app.get(['/auth/callback', '/api/auth/callback'], async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.warn('[SSO] Erreur retournée:', error, error_description);
    return res.redirect(`/?auth_error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code || !state) {
    return res.redirect('/?auth_error=code_ou_state_manquant');
  }

  if (!OIDCAuthService.verifySignedState(state)) {
    return res.redirect('/?auth_error=state_invalide');
  }

  const stateData = pkceStates.get(state);
  const code_verifier = stateData?.verifier || '';
  const redirectUri = stateData?.redirectUri || resolveRedirectUri(req);
  pkceStates.delete(state);

  try {
    const tokenRes = await OIDCAuthService.exchangeCodeForToken(code, code_verifier, redirectUri);
    const userInfo = await OIDCAuthService.fetchUserInfo(tokenRes.access_token);

    const sub = userInfo.sub || userInfo.id;
    const email = userInfo.email || `${sub}@sso.local`;
    const name = userInfo.name || userInfo.preferred_username || email.split('@')[0];
    const picture = userInfo.picture || userInfo.avatar_url || '';
    const roleHint = Array.isArray(userInfo.roles) && (userInfo.roles.includes('admin') || userInfo.roles.includes('super_admin')) ? 'admin' : undefined;

    const user = await db.upsertUser({ sub, email, name, picture, roleHint });

    SessionManager.createSessionCookie(res, user);
    await db.addAuditLog(user.id, 'user_login_sso', { email, sub }, req.ip);

    res.redirect('/');
  } catch (err) {
    console.error('[SSO] Échec authentification OIDC:', err.message);
    res.redirect(`/?auth_error=${encodeURIComponent(err.message)}`);
  }
});

app.get('/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ authenticated: false, user: null });
  }
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      sub: req.user.sub,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
    },
  });
});

app.get('/auth/logout', (req, res) => {
  if (req.user) {
    db.addAuditLog(req.user.id, 'user_logout', {}, req.ip).catch(() => {});
  }
  SessionManager.clearSessionCookie(res);
  res.redirect('/');
});

// ==========================================
// ACCOUNT & GDPR PERSONAL DATA
// ==========================================
app.get('/api/account/export', requireAuth, async (req, res) => {
  try {
    const dump = await db.exportUserData(req.user.id);
    await db.addAuditLog(req.user.id, 'account_export_gdpr', {}, req.ip);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="mes-donnees-cvbuilder-${req.user.id}.json"`);
    res.send(JSON.stringify(dump, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/account', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id;
    await db.deleteUserAccount(uid);
    SessionManager.clearSessionCookie(res);
    res.json({ success: true, message: 'Compte et données personnelles supprimés définitivement.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// RESUMES API (PROTECTED & ISOLATED PER USER)
// ==========================================
app.get('/api/resumes', requireAuth, async (req, res) => {
  try {
    const resumes = await db.listResumes(req.user.id);
    res.json(resumes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/resumes', requireAuth, async (req, res) => {
  try {
    const { title, template_id, language, is_master, fromMaster, data } = req.body;
    let initialData = data;

    if (!initialData && fromMaster) {
      const master = await db.getMasterResume(req.user.id);
      if (master && master.data) {
        initialData = JSON.parse(JSON.stringify(master.data));
      }
    }

    const newCv = await db.createResume(req.user.id, {
      title: title || 'Mon Nouveau CV',
      template_id: template_id || 'modern',
      language: language || 'fr',
      is_master: !!is_master,
      data: initialData || {
        personal: {
          firstName: req.user.name?.split(' ')[0] || '',
          lastName: req.user.name?.split(' ').slice(1).join(' ') || '',
          email: req.user.email || '',
        },
        experiences: [],
        education: [],
        skills: [],
        languages: [{ id: 'lang_1', name: 'Français', level: 'Langue maternelle' }],
        certifications: [],
        projects: [],
        customSections: [],
      },
    });

    await db.addAuditLog(req.user.id, 'resume_create', { id: newCv.id, title: newCv.title }, req.ip);
    trackCvEvent({
      eventType: 'cv.created',
      actorSub: req.user.id,
      actorEmail: req.user.email,
      resourceId: newCv.id,
      resourceName: newCv.title,
      metadata: { template: newCv.template_id, language: newCv.language },
    });
    res.status(201).json(newCv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/resumes/:id', requireAuth, async (req, res) => {
  try {
    const resume = await db.getResume(req.user.id, req.params.id, false);
    if (!resume) return res.status(404).json({ error: 'CV non trouvé ou accès interdit' });
    res.json(resume);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/resumes/:id', requireAuth, async (req, res) => {
  try {
    const { title, template_id, language, is_archived, is_master, data, saveVersion, versionNote } = req.body;
    const updated = await db.updateResume(
      req.user.id,
      req.params.id,
      { title, template_id, language, is_archived, is_master, data },
      !!saveVersion,
      versionNote
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/resumes/:id', requireAuth, async (req, res) => {
  try {
    await db.deleteResume(req.user.id, req.params.id);
    await db.addAuditLog(req.user.id, 'resume_delete', { id: req.params.id }, req.ip);
    trackCvEvent({
      eventType: 'cv.deleted',
      actorSub: req.user.id,
      actorEmail: req.user.email,
      resourceId: req.params.id,
    });
    res.json({ success: true, message: 'CV supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/resumes/:id/duplicate', requireAuth, async (req, res) => {
  try {
    const duplicated = await db.duplicateResume(req.user.id, req.params.id);
    await db.addAuditLog(req.user.id, 'resume_duplicate', { originalId: req.params.id, newId: duplicated.id }, req.ip);
    res.status(201).json(duplicated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Versions
app.get('/api/resumes/:id/versions', requireAuth, async (req, res) => {
  try {
    const resume = await db.getResume(req.user.id, req.params.id, false);
    if (!resume) return res.status(404).json({ error: 'CV non trouvé' });
    const versions = await db.getVersions(req.params.id);
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/resumes/:id/versions/:verId/restore', requireAuth, async (req, res) => {
  try {
    const resume = await db.getResume(req.user.id, req.params.id, false);
    if (!resume) return res.status(404).json({ error: 'CV non trouvé' });

    const verData = await db.getVersionData(req.params.id, req.params.verId);
    if (!verData) return res.status(404).json({ error: 'Version non trouvée' });

    const updated = await db.updateResume(req.user.id, req.params.id, { data: verData }, true, 'Restauration version');
    res.json({ success: true, resume: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// AI IMPORT & CONVERSATIONAL ASSISTANT
// ==========================================
app.post('/api/ai/import-pdf', requireAuth, rateLimitAI, upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Fichier PDF manquant.' });
    }

    const extractedResume = await PDFImporterService.parsePdfBuffer(req.file.buffer);
    await db.addAuditLog(req.user.id, 'ai_import_pdf', { filename: req.file.originalname, size: req.file.size }, req.ip);

    res.json({
      success: true,
      extractedData: extractedResume,
      message: 'Données extraites avec succès via LiteLLM.',
    });
  } catch (err) {
    console.error('[AI Import PDF Error]:', err.message);
    res.status(500).json({ error: `Erreur lors de l'extraction par IA : ${err.message}` });
  }
});

app.post('/api/ai/import-linkedin-url', requireAuth, (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL manquante.' });
  const result = LinkedInImporterService.explainUrlImportLimitation(url);
  res.json(result);
});

// Conversational AI Chat
app.get('/api/ai/chat/:resumeId', requireAuth, async (req, res) => {
  try {
    const resume = await db.getResume(req.user.id, req.params.resumeId, false);
    if (!resume) return res.status(404).json({ error: 'CV non trouvé.' });
    const conv = await db.getAIConversation(req.params.resumeId, req.user.id);
    res.json(conv.messages || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/chat/:resumeId', requireAuth, rateLimitAI, async (req, res) => {
  try {
    const { message, resumeData } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message vide.' });
    }

    const resume = await db.getResume(req.user.id, req.params.resumeId, false);
    if (!resume) return res.status(404).json({ error: 'CV non trouvé.' });

    const activeResumeData = resumeData || resume.data || {};
    const conv = await db.getAIConversation(req.params.resumeId, req.user.id);

    await db.saveAIMessage(req.params.resumeId, req.user.id, {
      role: 'user',
      content: message,
    });

    const assistantResult = await ChatAssistantService.processMessage({
      currentResumeData: activeResumeData,
      conversationHistory: conv.messages,
      userMessage: message,
    });

    await db.saveAIMessage(req.params.resumeId, req.user.id, {
      role: 'assistant',
      content: assistantResult.reply,
      proposedChanges: assistantResult.proposedChanges,
      missingSuggestions: assistantResult.missingSuggestions,
    });

    res.json(assistantResult);
  } catch (err) {
    console.error('[AI Chat Error]:', err.message);
    res.status(500).json({ error: `Erreur Assistant IA : ${err.message}` });
  }
});

// Transparent helper to ensure CV data and spoken languages are normalized and translated if a target language is requested
async function resolveResumeDataForLanguage(userId, resume, requestedLang) {
  const baseData = resume.data || {};
  const targetLang = ResumeLanguageService.getLanguageConfig(requestedLang || resume.language || baseData.language || 'fr').code;
  const currentDataLang = ResumeLanguageService.getLanguageConfig(baseData.language || resume.language || 'fr').code;

  // Always normalize spoken languages array
  baseData.languages = ResumeLanguageService.normalizeSpokenLanguages(baseData.languages, targetLang);

  // If target language matches current data language, return directly
  if (!requestedLang || targetLang === currentDataLang) {
    return {
      ...baseData,
      language: targetLang,
    };
  }

  // Check cached invisible translation in baseData._translations
  const hash = ResumeLanguageService.computeContentHash(baseData);
  const cached = baseData._translations?.[targetLang];
  if (cached && cached.hash === hash && cached.data) {
    return {
      ...cached.data,
      language: targetLang,
      personal: {
        ...(cached.data.personal || {}),
        photo: baseData.personal?.photo || '',
      },
    };
  }

  // Otherwise translate invisibly via LiteLLM and cache
  try {
    const translatedData = await ResumeLanguageService.translateResumeData(baseData, targetLang);
    const updatedTranslations = {
      ...(baseData._translations || {}),
      [targetLang]: {
        hash,
        updatedAt: new Date().toISOString(),
        data: {
          ...translatedData,
          _translations: undefined,
          personal: {
            ...(translatedData.personal || {}),
            photo: undefined,
          },
        },
      },
    };
    await db.updateResume(userId, resume.id, {
      data: {
        ...baseData,
        _translations: updatedTranslations,
      },
    }, false);
    return translatedData;
  } catch (err) {
    console.warn(`[LanguageService] Fallback sans traduction IA vers ${targetLang}:`, err.message);
    return {
      ...baseData,
      language: targetLang,
    };
  }
}

// Seamless CV Language Translation endpoint (invoked automatically when changing CV language or exporting)
app.post('/api/ai/translate/:resumeId', requireAuth, rateLimitAI, async (req, res) => {
  try {
    const { targetLanguage, resumeData } = req.body;
    const resume = await db.getResume(req.user.id, req.params.resumeId, false);
    if (!resume) return res.status(404).json({ error: 'CV non trouvé.' });

    const langCfg = ResumeLanguageService.getLanguageConfig(targetLanguage || 'fr');
    const sourceData = resumeData || resume.data || {};
    const translatedData = await ResumeLanguageService.translateResumeData(sourceData, langCfg.code);

    const updated = await db.updateResume(
      req.user.id,
      resume.id,
      {
        language: langCfg.code,
        data: translatedData,
      },
      true,
      `Traduction automatique (${langCfg.name})`
    );

    await db.addAuditLog(req.user.id, 'ai_translate_resume', { resumeId: resume.id, targetLanguage: langCfg.code }, req.ip);

    res.json({
      success: true,
      language: langCfg.code,
      languageName: langCfg.name,
      resume: updated,
    });
  } catch (err) {
    console.error('[AI Translate Error]:', err.message);
    res.status(500).json({ error: `Erreur traduction IA : ${err.message}` });
  }
});

// Custom Prompt CV Summarizer & Orientation endpoint
app.post('/api/ai/tailor/:resumeId', requireAuth, rateLimitAI, async (req, res) => {
  try {
    const { customPrompt, targetLength = 'auto', targetLanguage, mode = 'update', resumeData } = req.body;
    if (!customPrompt || !customPrompt.trim()) {
      return res.status(400).json({ error: 'Veuillez fournir un prompt ou besoin spécifique.' });
    }

    const resume = await db.getResume(req.user.id, req.params.resumeId, false);
    if (!resume) return res.status(404).json({ error: 'CV non trouvé.' });

    const sourceData = resumeData || resume.data || {};
    const langCode = ResumeLanguageService.getLanguageConfig(targetLanguage || resume.language || sourceData.language || 'fr').code;

    const result = await ResumeTailorService.summarizeAndOrient({
      resumeData: sourceData,
      customPrompt,
      targetLength,
      targetLanguage: langCode,
    });

    let savedResume;
    if (mode === 'duplicate') {
      savedResume = await db.createResume(req.user.id, {
        title: `${resume.title} (Orienté IA)`,
        template_id: resume.template_id || 'modern',
        language: langCode,
        is_master: false,
        data: result.tailoredData,
      });
    } else {
      savedResume = await db.updateResume(
        req.user.id,
        resume.id,
        {
          language: langCode,
          data: result.tailoredData,
        },
        true,
        `Résumé/Orienté IA : ${customPrompt.trim().slice(0, 45)}`
      );
    }

    await db.addAuditLog(req.user.id, 'ai_tailor_resume', {
      resumeId: savedResume.id,
      targetLength,
      targetLanguage: langCode,
      mode,
    }, req.ip);

    res.json({
      success: true,
      mode,
      executivePitch: result.executivePitch,
      tailoringNotes: result.tailoringNotes,
      resume: savedResume,
    });
  } catch (err) {
    console.error('[AI Tailor Error]:', err.message);
    res.status(500).json({ error: `Erreur lors du résumé/orientation par IA : ${err.message}` });
  }
});

// ==========================================
// EXPORTS & TEMPLATES
// ==========================================
app.get('/api/templates', (req, res) => {
  res.json(TEMPLATES);
});

app.get('/api/languages', (req, res) => {
  res.json(Object.values(SUPPORTED_LANGUAGES));
});

app.get('/api/render/:resumeId', requireAuth, async (req, res) => {
  try {
    const resume = await db.getResume(req.user.id, req.params.resumeId, false);
    if (!resume) return res.status(404).send('CV introuvable ou accès non autorisé.');

    const templateId = req.query.template || resume.template_id || 'modern';
    const primaryColor = req.query.color || undefined;
    const fontFamily = req.query.font || undefined;
    const requestedLang = req.query.lang || undefined;

    const dataToRender = await resolveResumeDataForLanguage(req.user.id, resume, requestedLang);
    const html = renderTemplateHtml(templateId, dataToRender, {
      primaryColor,
      fontFamily,
      language: dataToRender.language || resume.language || 'fr',
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send(`Erreur de prévisualisation: ${err.message}`);
  }
});

app.post('/api/render/preview', requireAuth, (req, res) => {
  const { template_id, data, options } = req.body;
  const safeData = data || {};
  const langCode = options?.language || safeData.language || 'fr';
  safeData.languages = ResumeLanguageService.normalizeSpokenLanguages(safeData.languages, langCode);
  const html = renderTemplateHtml(template_id || 'modern', safeData, { ...(options || {}), language: langCode });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

app.get('/api/export/:resumeId/docx', requireAuth, async (req, res) => {
  try {
    const resume = await db.getResume(req.user.id, req.params.resumeId, false);
    if (!resume) return res.status(404).json({ error: 'CV non trouvé.' });

    const requestedLang = req.query.lang || resume.language || resume.data?.language || 'fr';
    const dataToExport = await resolveResumeDataForLanguage(req.user.id, resume, requestedLang);

    const primaryColor = req.query.color || dataToExport?.style?.primaryColor || undefined;
    const buffer = await DocxGeneratorService.generate(dataToExport, {
      primaryColor,
      language: dataToExport.language || requestedLang,
    });

    const safeTitle = (resume.title || 'CV').replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, '_');
    const langSuffix = req.query.lang ? `_${req.query.lang.toUpperCase()}` : '';
    const filename = `${safeTitle}${langSuffix}.docx`;

    await db.addAuditLog(req.user.id, 'export_docx', { resumeId: resume.id, lang: requestedLang }, req.ip);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[Export DOCX Error]:', err.message);
    res.status(500).json({ error: `Erreur génération DOCX: ${err.message}` });
  }
});

app.get('/api/export/:resumeId/pdf', requireAuth, async (req, res) => {
  try {
    const resume = await db.getResume(req.user.id, req.params.resumeId, false);
    if (!resume) return res.status(404).send('CV non trouvé.');

    const requestedLang = req.query.lang || resume.language || resume.data?.language || 'fr';
    const dataToExport = await resolveResumeDataForLanguage(req.user.id, resume, requestedLang);

    const templateId = req.query.template || resume.template_id || 'modern';
    const primaryColor = req.query.color || dataToExport?.style?.primaryColor || undefined;
    const fontFamily = req.query.font || dataToExport?.style?.fontFamily || undefined;

    await db.addAuditLog(req.user.id, 'export_pdf', { resumeId: resume.id, lang: requestedLang }, req.ip);
    trackCvEvent({
      eventType: 'cv.exported_pdf',
      actorSub: req.user.id,
      actorEmail: req.user.email,
      resourceId: resume.id,
      resourceName: resume.title,
      metadata: { template: templateId, language: requestedLang },
    });

    const html = renderTemplateHtml(templateId, dataToExport, {
      primaryColor,
      fontFamily,
      language: dataToExport.language || requestedLang,
    });
    const printHtml = html.replace('</body>', '<script>window.addEventListener("load", () => { setTimeout(() => window.print(), 250); });</script></body>');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(printHtml);
  } catch (err) {
    res.status(500).send(`Erreur export PDF: ${err.message}`);
  }
});

// ==========================================
// ADMINISTRATION BACKOFFICE (ADMIN ONLY)
// ==========================================
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await db.getAggregatedStats();
    const aiStats = (await db.getSetting('ai_stats', {})) || {};
    const activeModel = await AIProviderService.getActiveModel();
    res.json({
      ...stats,
      aiStats,
      activeModel,
      litellmBaseUrl: config.litellm.baseUrl,
      databaseType: db.isPg ? 'PostgreSQL' : 'Stockage Persistant JSON',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await db.listUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide.' });
    }
    const updated = await db.updateUserRole(req.params.id, role);
    await db.addAuditLog(req.user.id, 'admin_update_user_role', { targetId: req.params.id, role }, req.ip);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const model = await db.getSetting('litellm_model', config.litellm.defaultModel);
    const appName = await db.getSetting('app_name', 'CV Builder IA');
    res.json({
      litellm_model: model,
      app_name: appName,
      available_models: [
        'gemini/gemini-3.1-flash-lite-preview',
        'gpt-4o-mini',
        'gpt-4o',
        'gpt-5.6-sol',
        'gpt-6-astra',
        'chatgpt',
      ],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const { litellm_model, app_name } = req.body;
    if (litellm_model) await db.setSetting('litellm_model', litellm_model);
    if (app_name) await db.setSetting('app_name', app_name);

    await db.addAuditLog(req.user.id, 'admin_update_settings', { litellm_model, app_name }, req.ip);
    res.json({ success: true, message: 'Paramètres mis à jour avec succès.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/audit', requireAdmin, async (req, res) => {
  try {
    const logs = await db.listAuditLogs(50);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// FRONTEND STATIC ASSETS & SPA ROUTING
// ==========================================
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

async function start() {
  await db.init();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  CV Builder IA prêt et en écoute sur le port ${config.port}`);
    console.log(`  URL: ${config.appUrl}`);
    console.log(`  SSO: ${config.sso.baseUrl}`);
    console.log(`  LiteLLM: ${config.litellm.baseUrl}`);
    console.log(`=======================================================`);
  });
}

start().catch(err => {
  console.error('[FATAL] Impossible de démarrer le serveur:', err);
  process.exit(1);
});
