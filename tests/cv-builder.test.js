import test from 'node:test';
import assert from 'node:assert/strict';
import { OIDCAuthService } from '../src/auth/oidc.js';
import { SessionManager } from '../src/auth/session.js';
import { TEMPLATES, renderTemplateHtml } from '../src/templates/registry.js';
import { DocxGeneratorService } from '../src/export/docx-generator.js';
import { ResumeLanguageService } from '../src/ai/language-service.js';
import { db } from '../src/storage/db.js';

const SAMPLE_COMPLEX_RESUME = {
  language: 'fr',
  personal: {
    firstName: 'Hélène',
    lastName: 'Benoît-Dufour',
    title: 'Architecte Cloud & Ingénieure DevOps Senior',
    email: 'helene.benoit@example.tn',
    phone: '+216 22 333 444',
    city: 'Tunis',
    country: 'Tunisie',
    linkedin: 'linkedin.com/in/helene-benoit',
    github: 'github.com/helene-devops',
    website: 'https://helene.oussamma.tn',
    summary: 'Ingénieure avec 10 ans d’expérience dans l’orchestration de conteneurs Docker, la sécurité OIDC et le déploiement continu de systèmes critiques à haute disponibilité.',
  },
  experiences: Array.from({ length: 6 }, (_, i) => ({
    id: `exp_${i + 1}`,
    company: `Entreprise Technologique Méditerranée #${i + 1}`,
    position: `Lead Architecte Infrastructure & Sécurité (Poste ${i + 1})`,
    location: 'Tunis / Paris',
    startDate: `${2015 + i}-01`,
    endDate: i === 0 ? 'Présent' : `${2016 + i}-12`,
    current: i === 0,
    summary: 'Pilotage de la modernisation des infrastructures souveraines et intégration de modèles LLM privés.',
    highlights: [
      'Mise en œuvre de pipelines CI/CD reproductibles et conteneurisés sous Docker et Coolify.',
      'Réduction des coûts d’infrastructure de 35% et amélioration de la résilience multi-zones.',
      'Sécurisation des accès via OpenID Connect (PKCE S256) et passerelle LiteLLM.',
    ],
    technologies: ['Docker', 'PostgreSQL', 'Node.js', 'Coolify', 'LiteLLM', 'Traefik'],
  })),
  education: [
    {
      id: 'edu_1',
      institution: 'École Nationale des Sciences de l’Informatique (ENSI)',
      degree: 'Diplôme National d’Ingénieur',
      field: 'Génie Logiciel & Systèmes Distribués',
      startDate: '2011',
      endDate: '2014',
      summary: 'Mention Très Bien — Projet de fin d’études sur la virtualisation légère.',
    },
  ],
  skills: [
    { id: 'sk_1', category: 'DevOps', name: 'Docker & Compose', level: 'Expert' },
    { id: 'sk_2', category: 'Sécurité', name: 'OpenID Connect / OAuth2 PKCE', level: 'Expert' },
    { id: 'sk_3', category: 'IA', name: 'LiteLLM & Prompt Engineering', level: 'Avancé' },
  ],
  languages: [
    { id: 'l_1', name: 'Français', level: 'Bilingue (C2)' },
    { id: 'l_2', name: 'Arabe', level: 'Langue maternelle' },
    { id: 'l_3', name: 'Anglais', level: 'Courant professionnel (C1)' },
  ],
  certifications: [
    { id: 'c_1', name: 'Certified Kubernetes Administrator (CKA)', issuer: 'CNCF', date: '2024', url: 'https://cncf.io' },
  ],
  projects: [
    {
      id: 'p_1',
      name: 'CV Builder IA Souverain',
      role: 'Architecte Principal',
      description: 'Application autonome de génération et d’analyse de CV par IA.',
      technologies: ['Express', 'DOCX', 'PostgreSQL'],
      url: 'https://github.com/oussamma-ben-hassine/cv-builder-ai',
    },
  ],
  customSections: [
    {
      id: 'cs_1',
      title: 'Conférences & Bénévolat',
      items: [
        { title: 'Speaker DevOps Days', date: '2025', description: 'Présentation sur l’auto-hébergement avec Coolify.' },
      ],
    },
  ],
};

test('1. OIDC PKCE & Signed State verification', () => {
  const { code_verifier, code_challenge } = OIDCAuthService.generatePKCE();
  assert.ok(code_verifier.length >= 40, 'Verifier should have sufficient entropy');
  assert.ok(code_challenge.length >= 40, 'Challenge should be base64url encoded SHA256');

  const state = OIDCAuthService.generateSignedState();
  assert.equal(OIDCAuthService.verifySignedState(state), true, 'Valid state must verify');
  assert.equal(OIDCAuthService.verifySignedState(`${state}tampered`), false, 'Tampered state must fail');
});

test('2. SessionManager cryptographic token signing and verification', () => {
  const token = SessionManager.signToken({ id: 'usr_123', email: 'test@oussamma.tn', role: 'user', exp: Date.now() + 60000 });
  const verified = SessionManager.verifyToken(token);
  assert.equal(verified.id, 'usr_123');
  assert.equal(verified.email, 'test@oussamma.tn');

  const tampered = token.slice(0, -3) + 'abc';
  assert.equal(SessionManager.verifyToken(tampered), null, 'Tampered token must return null');
});

test('3. All 9 templates render valid A4 HTML with accented characters and long experiences', () => {
  assert.ok(TEMPLATES.length >= 9, 'At least 9 templates must be registered');
  for (const tmpl of TEMPLATES) {
    const html = renderTemplateHtml(tmpl.id, SAMPLE_COMPLEX_RESUME, { primaryColor: '#1E40AF' });
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('Hélène Benoît-Dufour'), `Template ${tmpl.id} must preserve accented characters`);
    assert.ok(html.includes('Entreprise Technologique Méditerranée #6'), `Template ${tmpl.id} must render all 6 long experiences`);
    assert.ok(html.includes('mailto:helene.benoit@example.tn'), `Template ${tmpl.id} must include clickable mailto link`);
  }
});

test('4. Native DOCX generation produces valid editable OpenXML buffer', async () => {
  const buffer = await DocxGeneratorService.generate(SAMPLE_COMPLEX_RESUME, { primaryColor: '#2563EB' });
  assert.ok(Buffer.isBuffer(buffer), 'Output must be a Buffer');
  assert.ok(buffer.length > 3000, 'DOCX buffer must have substantial structured content');
  // Check ZIP/DOCX magic bytes PK\x03\x04
  assert.equal(buffer[0], 0x50); // 'P'
  assert.equal(buffer[1], 0x4b); // 'K'
});

test('5. Multi-user data isolation in storage layer', async () => {
  await db.init();
  const userA = await db.upsertUser({ sub: 'sub_test_a', email: 'a@test.tn', name: 'Alice' });
  const userB = await db.upsertUser({ sub: 'sub_test_b', email: 'b@test.tn', name: 'Bob' });

  const cvA = await db.createResume(userA.id, {
    title: 'CV Secret Alice',
    template_id: 'modern',
    data: SAMPLE_COMPLEX_RESUME,
  });

  // User A can read their CV
  const fetchedByA = await db.getResume(userA.id, cvA.id, false);
  assert.ok(fetchedByA);
  assert.equal(fetchedByA.title, 'CV Secret Alice');

  // User B cannot read User A's CV
  const fetchedByB = await db.getResume(userB.id, cvA.id, false);
  assert.equal(fetchedByB, null, 'User B must not be able to read User A resume');

  // Cleanup test resumes
  await db.deleteResume(userA.id, cvA.id);
});

test('6. Spoken languages normalization & 6-language / RTL HTML and DOCX rendering', async () => {
  const heterogeneousLangs = [
    { language: 'Anglais', proficiency: 'C1' },
    { langue: 'Arabe', niveau: 'Langue maternelle' },
    'Espagnol (B2)',
  ];
  const normalized = ResumeLanguageService.normalizeSpokenLanguages(heterogeneousLangs, 'fr');
  assert.equal(normalized.length, 3);
  assert.equal(normalized[0].name, 'Anglais');
  assert.equal(normalized[0].level, 'C1');
  assert.equal(normalized[1].name, 'Arabe');
  assert.equal(normalized[1].level, 'Langue maternelle');
  assert.equal(normalized[2].name, 'Espagnol');
  assert.equal(normalized[2].level, 'B2');

  // Test Arabic RTL HTML rendering
  const htmlAr = renderTemplateHtml('modern', { ...SAMPLE_COMPLEX_RESUME, languages: heterogeneousLangs }, { language: 'ar' });
  assert.ok(htmlAr.includes('dir="rtl"'), 'Arabic CV must render with dir="rtl"');
  assert.ok(htmlAr.includes('الخبرات المهنية'), 'Arabic CV must include localized Arabic section headers');
  assert.ok(htmlAr.includes('Anglais'), 'Normalized spoken languages must appear in HTML');

  // Test English DOCX generation
  const docxEn = await DocxGeneratorService.generate(SAMPLE_COMPLEX_RESUME, { language: 'en' });
  assert.ok(Buffer.isBuffer(docxEn) && docxEn.length > 3000, 'English DOCX must generate valid buffer');
});

