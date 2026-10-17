export const TEMPLATES = [
  {
    id: 'modern',
    name: 'Moderne',
    description: 'Design épuré et contemporain avec accents colorés et en-tête dynamique.',
    hasPhoto: true,
    category: 'Moderne',
    defaultColor: '#2563EB',
    defaultFont: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'classic',
    name: 'Classique',
    description: 'Structure chronologique intemporelle, idéale pour tous secteurs traditionnels.',
    hasPhoto: false,
    category: 'Classique',
    defaultColor: '#1E293B',
    defaultFont: 'Georgia, serif',
  },
  {
    id: 'minimalist',
    name: 'Minimaliste',
    description: 'Lignes pures et aérées avec focus maximal sur le contenu et la lisibilité.',
    hasPhoto: false,
    category: 'Minimaliste',
    defaultColor: '#0F172A',
    defaultFont: 'system-ui, -apple-system, sans-serif',
  },
  {
    id: 'professional',
    name: 'Professionnel',
    description: 'Présentation équilibrée et corporate, optimisée pour cadres, ingénieurs et consultants.',
    hasPhoto: true,
    category: 'Professionnel',
    defaultColor: '#0D9488',
    defaultFont: 'Roboto, Arial, sans-serif',
  },
  {
    id: 'creative',
    name: 'Créatif',
    description: 'Touches graphiques distinctives pour profils tech, design, produit et communication.',
    hasPhoto: true,
    category: 'Créatif',
    defaultColor: '#7C3AED',
    defaultFont: 'Montserrat, sans-serif',
  },
  {
    id: 'two-column',
    name: 'Deux colonnes',
    description: 'Organisation visuelle séparant les compétences/coordonnées du parcours détaillé.',
    hasPhoto: true,
    category: 'Deux colonnes',
    defaultColor: '#3B82F6',
    defaultFont: 'Inter, sans-serif',
  },
  {
    id: 'ats',
    name: 'ATS Standard',
    description: 'Format 100% lisible par les robots recruteurs (Workday, Taleo, Greenhouse).',
    hasPhoto: false,
    category: 'ATS',
    defaultColor: '#111827',
    defaultFont: 'Arial, Helvetica, sans-serif',
  },
  {
    id: 'photo',
    name: 'Avec Photo',
    description: 'Mise en valeur élégante du portrait professionnel avec en-tête structuré.',
    hasPhoto: true,
    category: 'Avec photo',
    defaultColor: '#EA580C',
    defaultFont: 'Inter, sans-serif',
  },
  {
    id: 'no-photo',
    name: 'Sans Photo',
    description: 'Présentation sobre et directe sans photo, conforme aux standards internationaux.',
    hasPhoto: false,
    category: 'Sans photo',
    defaultColor: '#334155',
    defaultFont: 'Calibri, Arial, sans-serif',
  },
];

function formatUrl(u) {
  if (!u) return '';
  const trimmed = u.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderTemplateHtml(templateId, resumeData = {}, options = {}) {
  const tmpl = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
  const styleOpts = resumeData?.style || {};
  const primaryColor = options.primaryColor || styleOpts.primaryColor || tmpl.defaultColor;
  const fontFamily = options.fontFamily || styleOpts.fontFamily || tmpl.defaultFont;
  const fontSize = options.fontSize || styleOpts.fontSize || '13.5px';
  const spacing = options.spacing || styleOpts.spacing || '1.45';
  const hiddenSections = Array.isArray(resumeData?.hiddenSections) ? resumeData.hiddenSections : [];

  const personal = resumeData?.personal || {};
  const experiences = hiddenSections.includes('experiences') ? [] : (resumeData?.experiences || []);
  const education = hiddenSections.includes('education') ? [] : (resumeData?.education || []);
  const skills = hiddenSections.includes('skills') ? [] : (resumeData?.skills || []);
  const languages = hiddenSections.includes('languages') ? [] : (resumeData?.languages || []);
  const certifications = hiddenSections.includes('certifications') ? [] : (resumeData?.certifications || []);
  const projects = hiddenSections.includes('projects') ? [] : (resumeData?.projects || []);
  const customSections = hiddenSections.includes('custom') ? [] : (resumeData?.customSections || []);

  const isEn = resumeData?.language === 'en';
  const labels = {
    summary: isEn ? 'Professional Summary' : 'Profil Professionnel',
    experiences: isEn ? 'Work Experience' : 'Expériences Professionnelles',
    education: isEn ? 'Education' : 'Formations & Diplômes',
    skills: isEn ? 'Skills' : 'Compétences',
    languages: isEn ? 'Languages' : 'Langues',
    certifications: isEn ? 'Certifications' : 'Certifications',
    projects: isEn ? 'Notable Projects' : 'Projets',
    present: isEn ? 'Present' : 'Présent',
  };

  const fullName = `${personal.firstName || ''} ${personal.lastName || ''}`.trim() || (isEn ? 'Your Name' : 'Votre Nom');
  const showPhoto = personal.photo && tmpl.hasPhoto && templateId !== 'no-photo' && templateId !== 'ats' && templateId !== 'classic' && templateId !== 'minimalist';

  const baseCss = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@500;600;700;800&family=Roboto:wght@400;500;700&display=swap');
    @page {
      size: A4;
      margin: 12mm 14mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: ${fontFamily};
      font-size: ${fontSize};
      line-height: ${spacing};
      color: #1f2937;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    a {
      color: inherit;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .cv-page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #ffffff;
      padding: 14mm 16mm;
      position: relative;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .cv-page {
        width: 100%;
        min-height: auto;
        padding: 0;
        box-shadow: none;
      }
    }
    @media screen {
      body {
        background: #f1f5f9;
        padding: 16px 0;
      }
      .cv-page {
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
        border-radius: 4px;
      }
    }
    .section-title {
      font-size: 1.1em;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${primaryColor};
      border-bottom: ${templateId === 'minimalist' ? '1px solid #cbd5e1' : `2px solid ${primaryColor}`};
      padding-bottom: 4px;
      margin-top: 16px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }
    .item-block {
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-weight: 700;
      gap: 12px;
    }
    .item-sub {
      font-size: 0.92em;
      color: #4b5563;
      margin-bottom: 4px;
      font-weight: 600;
    }
    .item-date {
      font-size: 0.85em;
      color: #6b7280;
      font-weight: 500;
      white-space: nowrap;
    }
    .item-desc {
      font-size: 0.94em;
      color: #374151;
      margin-bottom: 5px;
    }
    .item-bullets {
      margin-left: 18px;
      margin-bottom: 6px;
      font-size: 0.92em;
      color: #374151;
    }
    .item-bullets li {
      margin-bottom: 2px;
    }
    .tech-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }
    .tech-tag {
      font-size: 0.76em;
      background: #f3f4f6;
      color: #374151;
      padding: 1px 6px;
      border-radius: 3px;
      border: 1px solid #e5e7eb;
    }
    .contact-line {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 0.86em;
      color: #4b5563;
      margin-top: 6px;
    }
    .contact-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  `;

  let templateContent = '';

  const renderCustomSections = () => {
    if (!customSections.length) return '';
    return customSections.map(sec => `
      <section>
        <h2 class="section-title">${escapeHtml(sec.title || 'Section')}</h2>
        ${Array.isArray(sec.items) ? sec.items.map(it => `
          <div class="item-block">
            <div class="item-header">
              <span>${escapeHtml(it.title || '')}</span>
              ${it.date ? `<span class="item-date">${escapeHtml(it.date)}</span>` : ''}
            </div>
            ${it.subtitle ? `<div class="item-sub" style="color: ${primaryColor};">${escapeHtml(it.subtitle)}</div>` : ''}
            ${it.description ? `<div class="item-desc">${escapeHtml(it.description)}</div>` : ''}
          </div>
        `).join('') : ''}
      </section>
    `).join('');
  };

  if (templateId === 'two-column') {
    templateContent = `
      <div style="display: grid; grid-template-columns: 64mm 1fr; gap: 18px;">
        <aside style="background: #f8fafc; padding: 14px; border-radius: 6px; border-top: 4px solid ${primaryColor};">
          ${showPhoto ? `<img src="${personal.photo}" alt="${escapeHtml(fullName)}" style="width: 96px; height: 96px; border-radius: 50%; object-fit: cover; margin: 0 auto 12px; display: block; border: 2px solid ${primaryColor};">` : ''}
          <div style="font-size: 1.15em; font-weight: 800; color: #1e293b; text-align: center; margin-bottom: 3px;">${escapeHtml(fullName)}</div>
          <div style="font-size: 0.88em; font-weight: 600; color: ${primaryColor}; text-align: center; margin-bottom: 14px;">${escapeHtml(personal.title || '')}</div>
          
          <div style="font-size: 0.84em; color: #475569; display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; word-break: break-word;">
            ${personal.email ? `<a href="mailto:${escapeHtml(personal.email)}">✉️ ${escapeHtml(personal.email)}</a>` : ''}
            ${personal.phone ? `<a href="tel:${escapeHtml(personal.phone)}">📞 ${escapeHtml(personal.phone)}</a>` : ''}
            ${personal.city ? `<div>📍 ${escapeHtml(personal.city)}${personal.country ? ', ' + escapeHtml(personal.country) : ''}</div>` : ''}
            ${personal.linkedin ? `<a href="${formatUrl(personal.linkedin)}" target="_blank">🔗 ${escapeHtml(personal.linkedin)}</a>` : ''}
            ${personal.github ? `<a href="${formatUrl(personal.github)}" target="_blank">💻 ${escapeHtml(personal.github)}</a>` : ''}
            ${personal.website ? `<a href="${formatUrl(personal.website)}" target="_blank">🌐 ${escapeHtml(personal.website)}</a>` : ''}
          </div>

          ${skills.length > 0 ? `
            <div style="font-weight: 700; font-size: 0.9em; text-transform: uppercase; color: ${primaryColor}; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">${labels.skills}</div>
            <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 18px;">
              ${skills.map(s => `
                <div style="font-size: 0.85em; display: flex; justify-content: space-between;">
                  <strong>${escapeHtml(s.name)}</strong>
                  <span style="color: #64748b; font-size: 0.85em;">${escapeHtml(s.level || '')}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${languages.length > 0 ? `
            <div style="font-weight: 700; font-size: 0.9em; text-transform: uppercase; color: ${primaryColor}; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">${labels.languages}</div>
            <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.85em; margin-bottom: 18px;">
              ${languages.map(l => `<div><strong>${escapeHtml(l.name)}</strong> : ${escapeHtml(l.level || 'Courant')}</div>`).join('')}
            </div>
          ` : ''}

          ${certifications.length > 0 ? `
            <div style="font-weight: 700; font-size: 0.9em; text-transform: uppercase; color: ${primaryColor}; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">${labels.certifications}</div>
            <div style="display: flex; flex-direction: column; gap: 5px; font-size: 0.84em;">
              ${certifications.map(c => `
                <div>
                  <strong>${c.url ? `<a href="${formatUrl(c.url)}" target="_blank">${escapeHtml(c.name)}</a>` : escapeHtml(c.name)}</strong>
                  ${c.issuer ? `<div style="color: #64748b; font-size: 0.9em;">${escapeHtml(c.issuer)}${c.date ? ' • ' + escapeHtml(c.date) : ''}</div>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </aside>

        <main>
          ${personal.summary && !hiddenSections.includes('summary') ? `
            <div class="section-title" style="margin-top: 0;">${labels.summary}</div>
            <div class="item-desc">${escapeHtml(personal.summary)}</div>
          ` : ''}

          ${experiences.length > 0 ? `
            <div class="section-title">${labels.experiences}</div>
            ${experiences.map(exp => `
              <div class="item-block">
                <div class="item-header">
                  <span style="color: #111827;">${escapeHtml(exp.position)}</span>
                  <span class="item-date">${escapeHtml(exp.startDate)} - ${exp.current ? labels.present : escapeHtml(exp.endDate)}</span>
                </div>
                <div class="item-sub" style="color: ${primaryColor};">${escapeHtml(exp.company)}${exp.location ? ' • ' + escapeHtml(exp.location) : ''}</div>
                ${exp.summary ? `<div class="item-desc">${escapeHtml(exp.summary)}</div>` : ''}
                ${Array.isArray(exp.highlights) && exp.highlights.length > 0 ? `
                  <ul class="item-bullets">
                    ${exp.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}
                  </ul>
                ` : ''}
                ${Array.isArray(exp.technologies) && exp.technologies.length > 0 ? `
                  <div class="tech-tags">${exp.technologies.map(t => `<span class="tech-tag">${escapeHtml(t)}</span>`).join('')}</div>
                ` : ''}
              </div>
            `).join('')}
          ` : ''}

          ${education.length > 0 ? `
            <div class="section-title">${labels.education}</div>
            ${education.map(edu => `
              <div class="item-block">
                <div class="item-header">
                  <span>${escapeHtml([edu.degree, edu.field].filter(Boolean).join(' - '))}</span>
                  <span class="item-date">${escapeHtml([edu.startDate, edu.endDate].filter(Boolean).join(' - '))}</span>
                </div>
                <div class="item-sub" style="color: ${primaryColor};">${escapeHtml(edu.institution)}</div>
                ${edu.summary ? `<div class="item-desc">${escapeHtml(edu.summary)}</div>` : ''}
              </div>
            `).join('')}
          ` : ''}

          ${projects.length > 0 ? `
            <div class="section-title">${labels.projects}</div>
            ${projects.map(p => `
              <div class="item-block">
                <div class="item-header">
                  <span>${p.url ? `<a href="${formatUrl(p.url)}" target="_blank">${escapeHtml(p.name)} ↗</a>` : escapeHtml(p.name)}</span>
                  ${p.role ? `<span class="item-date">${escapeHtml(p.role)}</span>` : ''}
                </div>
                ${p.description ? `<div class="item-desc">${escapeHtml(p.description)}</div>` : ''}
                ${Array.isArray(p.technologies) && p.technologies.length > 0 ? `
                  <div class="tech-tags">${p.technologies.map(t => `<span class="tech-tag">${escapeHtml(t)}</span>`).join('')}</div>
                ` : ''}
              </div>
            `).join('')}
          ` : ''}

          ${renderCustomSections()}
        </main>
      </div>
    `;
  } else {
    const isCentered = templateId === 'classic' || templateId === 'ats';
    const isCreativeBanner = templateId === 'creative' || templateId === 'professional';

    templateContent = `
      <header style="margin-bottom: 16px; ${isCentered ? 'text-align: center;' : ''} ${isCreativeBanner ? `background: ${primaryColor}10; padding: 14px 16px; border-radius: 8px; border-left: 5px solid ${primaryColor};` : ''}">
        <div style="display: flex; align-items: center; justify-content: ${isCentered ? 'center' : 'space-between'}; gap: 18px;">
          <div>
            <h1 style="font-size: 1.95em; font-weight: 800; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 0.02em;">${escapeHtml(fullName)}</h1>
            ${personal.title ? `<div style="font-size: 1.12em; font-weight: 600; color: #374151; margin-top: 2px;">${escapeHtml(personal.title)}</div>` : ''}
          </div>
          ${showPhoto ? `
            <img src="${personal.photo}" alt="${escapeHtml(fullName)}" style="width: 78px; height: 78px; border-radius: 50%; object-fit: cover; border: 3px solid ${primaryColor}; shrink: 0;">
          ` : ''}
        </div>

        <div class="contact-line" style="${isCentered ? 'justify-content: center;' : ''}">
          ${personal.email ? `<a href="mailto:${escapeHtml(personal.email)}" class="contact-item">✉️ ${escapeHtml(personal.email)}</a>` : ''}
          ${personal.phone ? `<a href="tel:${escapeHtml(personal.phone)}" class="contact-item">📞 ${escapeHtml(personal.phone)}</a>` : ''}
          ${personal.city ? `<span class="contact-item">📍 ${escapeHtml(personal.city)}${personal.country ? ', ' + escapeHtml(personal.country) : ''}</span>` : ''}
          ${personal.linkedin ? `<a href="${formatUrl(personal.linkedin)}" target="_blank" class="contact-item">🔗 ${escapeHtml(personal.linkedin)}</a>` : ''}
          ${personal.github ? `<a href="${formatUrl(personal.github)}" target="_blank" class="contact-item">💻 ${escapeHtml(personal.github)}</a>` : ''}
          ${personal.website ? `<a href="${formatUrl(personal.website)}" target="_blank" class="contact-item">🌐 ${escapeHtml(personal.website)}</a>` : ''}
        </div>
      </header>

      ${personal.summary && !hiddenSections.includes('summary') ? `
        <section>
          <h2 class="section-title">${labels.summary}</h2>
          <p class="item-desc" style="text-align: justify;">${escapeHtml(personal.summary)}</p>
        </section>
      ` : ''}

      ${experiences.length > 0 ? `
        <section>
          <h2 class="section-title">${labels.experiences}</h2>
          ${experiences.map(exp => `
            <div class="item-block">
              <div class="item-header">
                <span style="font-size: 1.03em; color: #111827;">${escapeHtml(exp.position)}</span>
                <span class="item-date">${escapeHtml(exp.startDate)} - ${exp.current ? labels.present : escapeHtml(exp.endDate)}</span>
              </div>
              <div class="item-sub" style="color: ${primaryColor};">${escapeHtml(exp.company)}${exp.location ? ' • ' + escapeHtml(exp.location) : ''}</div>
              ${exp.summary ? `<div class="item-desc">${escapeHtml(exp.summary)}</div>` : ''}
              ${Array.isArray(exp.highlights) && exp.highlights.length > 0 ? `
                <ul class="item-bullets">
                  ${exp.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}
                </ul>
              ` : ''}
              ${Array.isArray(exp.technologies) && exp.technologies.length > 0 ? `
                <div class="tech-tags">${exp.technologies.map(t => `<span class="tech-tag">${escapeHtml(t)}</span>`).join('')}</div>
              ` : ''}
            </div>
          `).join('')}
        </section>
      ` : ''}

      ${education.length > 0 ? `
        <section>
          <h2 class="section-title">${labels.education}</h2>
          ${education.map(edu => `
            <div class="item-block">
              <div class="item-header">
                <span>${escapeHtml([edu.degree, edu.field].filter(Boolean).join(' - '))}</span>
                <span class="item-date">${escapeHtml([edu.startDate, edu.endDate].filter(Boolean).join(' - '))}</span>
              </div>
              <div class="item-sub" style="color: ${primaryColor};">${escapeHtml(edu.institution)}</div>
              ${edu.summary ? `<div class="item-desc">${escapeHtml(edu.summary)}</div>` : ''}
            </div>
          `).join('')}
        </section>
      ` : ''}

      ${skills.length > 0 ? `
        <section>
          <h2 class="section-title">${labels.skills}</h2>
          <div style="display: flex; flex-wrap: wrap; gap: 7px;">
            ${skills.map(s => `
              <span style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid ${primaryColor}; padding: 3px 9px; border-radius: 4px; font-size: 0.88em;">
                <strong>${escapeHtml(s.name)}</strong>${s.level ? ` <span style="color: #64748b; font-size: 0.85em;">(${escapeHtml(s.level)})</span>` : ''}
              </span>
            `).join('')}
          </div>
        </section>
      ` : ''}

      ${languages.length > 0 || certifications.length > 0 ? `
        <div style="display: grid; grid-template-columns: ${languages.length > 0 && certifications.length > 0 ? '1fr 1fr' : '1fr'}; gap: 18px; page-break-inside: avoid;">
          ${languages.length > 0 ? `
            <div>
              <h2 class="section-title">${labels.languages}</h2>
              <ul style="list-style: none; font-size: 0.9em;">
                ${languages.map(l => `<li style="margin-bottom: 3px;"><strong>${escapeHtml(l.name)}</strong> : ${escapeHtml(l.level || 'Courant')}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${certifications.length > 0 ? `
            <div>
              <h2 class="section-title">${labels.certifications}</h2>
              <ul style="list-style: none; font-size: 0.9em;">
                ${certifications.map(c => `<li style="margin-bottom: 3px;"><strong>${c.url ? `<a href="${formatUrl(c.url)}" target="_blank">${escapeHtml(c.name)} ↗</a>` : escapeHtml(c.name)}</strong>${c.issuer ? ` (${escapeHtml(c.issuer)}${c.date ? ', ' + escapeHtml(c.date) : ''})` : ''}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${projects.length > 0 ? `
        <section>
          <h2 class="section-title">${labels.projects}</h2>
          ${projects.map(p => `
            <div class="item-block">
              <div class="item-header">
                <span>${p.url ? `<a href="${formatUrl(p.url)}" target="_blank">${escapeHtml(p.name)} ↗</a>` : escapeHtml(p.name)}</span>
                ${p.role ? `<span class="item-date">${escapeHtml(p.role)}</span>` : ''}
              </div>
              ${p.description ? `<div class="item-desc">${escapeHtml(p.description)}</div>` : ''}
              ${Array.isArray(p.technologies) && p.technologies.length > 0 ? `
                <div class="tech-tags">${p.technologies.map(t => `<span class="tech-tag">${escapeHtml(t)}</span>`).join('')}</div>
              ` : ''}
            </div>
          `).join('')}
        </section>
      ` : ''}

      ${renderCustomSections()}
    `;
  }

  return `<!DOCTYPE html>
<html lang="${resumeData.language || 'fr'}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(fullName)} - CV</title>
  <style>${baseCss}</style>
</head>
<body>
  <div class="cv-page">
    ${templateContent}
  </div>
</body>
</html>`;
}
