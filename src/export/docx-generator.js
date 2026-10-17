import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx';
import { ResumeLanguageService } from '../ai/language-service.js';

export class DocxGeneratorService {
  static async generate(resumeData, options = {}) {
    const langCode = options.language || resumeData.language || 'fr';
    const langCfg = ResumeLanguageService.getLanguageConfig(langCode);
    const t = langCfg.labels;
    const isRtl = langCfg.isRtl;

    const personal = resumeData.personal || {};
    const experiences = resumeData.experiences || [];
    const education = resumeData.education || [];
    const skills = resumeData.skills || [];
    const languages = ResumeLanguageService.normalizeSpokenLanguages(resumeData.languages || [], langCfg.code);
    const certifications = resumeData.certifications || [];
    const projects = resumeData.projects || [];
    const customSections = resumeData.customSections || [];
    const accentColor = options.primaryColor ? options.primaryColor.replace('#', '') : '1E3A8A'; // Navy / Blue

    const children = [];

    // 1. Header: Full Name
    const fullName = `${personal.firstName || ''} ${personal.lastName || ''}`.trim() || 'Curriculum Vitae';
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        bidirectional: isRtl,
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({
            text: fullName,
            bold: true,
            size: 36, // 18pt
            color: accentColor,
            font: 'Calibri',
          }),
        ],
      })
    );

    // Subtitle: Professional Title
    const jobTitle = personal.title || personal.jobTitle;
    if (jobTitle) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: isRtl,
          spacing: { after: 150 },
          children: [
            new TextRun({
              text: jobTitle.toUpperCase(),
              bold: true,
              size: 24, // 12pt
              color: '4B5563', // Gray-600
              font: 'Calibri',
            }),
          ],
        })
      );
    }

    // Contact info bar
    const contactParts = [];
    if (personal.email) contactParts.push(personal.email);
    if (personal.phone) contactParts.push(personal.phone);
    if (personal.city || personal.country || personal.location) {
      contactParts.push([personal.city, personal.country].filter(Boolean).join(', ') || personal.location);
    }
    if (personal.linkedin) contactParts.push(`LinkedIn: ${personal.linkedin}`);
    if (personal.github) contactParts.push(`GitHub: ${personal.github}`);
    if (personal.website || personal.portfolio) contactParts.push(personal.website || personal.portfolio);

    if (contactParts.length > 0) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: isRtl,
          spacing: { after: 300 },
          children: [
            new TextRun({
              text: contactParts.join('  •  '),
              size: 18, // 9pt
              color: '6B7280',
              font: 'Calibri',
            }),
          ],
        })
      );
    }

    // Helper for section header
    const addSectionHeader = (title) => {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          bidirectional: isRtl,
          spacing: { before: 300, after: 100 },
          border: {
            bottom: {
              color: accentColor,
              space: 4,
              style: BorderStyle.SINGLE,
              size: 12,
            },
          },
          children: [
            new TextRun({
              text: String(title || '').toUpperCase(),
              bold: true,
              size: 24,
              color: accentColor,
              font: 'Calibri',
            }),
          ],
        })
      );
    };

    // 2. Summary / Profil
    if (personal.summary) {
      addSectionHeader(t.summary);
      children.push(
        new Paragraph({
          bidirectional: isRtl,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: personal.summary,
              size: 21,
              font: 'Calibri',
            }),
          ],
        })
      );
    }

    // 3. Experiences
    if (experiences.length > 0) {
      addSectionHeader(t.experiences);
      for (const exp of experiences) {
        const dateStr = [exp.startDate, exp.current ? t.present : exp.endDate].filter(Boolean).join(' - ');
        
        children.push(
          new Paragraph({
            bidirectional: isRtl,
            spacing: { before: 150, after: 50 },
            children: [
              new TextRun({
                text: exp.position || '',
                bold: true,
                size: 22,
                font: 'Calibri',
              }),
              new TextRun({
                text: dateStr ? `   (${dateStr})` : '',
                italics: true,
                size: 18,
                color: '4B5563',
                font: 'Calibri',
              }),
            ],
          })
        );

        const companyStr = [exp.company, exp.location].filter(Boolean).join(' | ');
        if (companyStr) {
          children.push(
            new Paragraph({
              bidirectional: isRtl,
              spacing: { after: 50 },
              children: [
                new TextRun({
                  text: companyStr,
                  bold: true,
                  size: 20,
                  color: accentColor,
                  font: 'Calibri',
                }),
              ],
            })
          );
        }

        const expSummary = exp.summary || exp.description;
        if (expSummary) {
          children.push(
            new Paragraph({
              bidirectional: isRtl,
              spacing: { after: 50 },
              children: [
                new TextRun({
                  text: expSummary,
                  size: 20,
                  font: 'Calibri',
                }),
              ],
            })
          );
        }

        const highlights = [
          ...(Array.isArray(exp.highlights) ? exp.highlights : []),
          ...(Array.isArray(exp.missions) ? exp.missions : []),
          ...(Array.isArray(exp.achievements) ? exp.achievements : []),
        ].filter(Boolean);

        if (highlights.length > 0) {
          for (const hl of highlights) {
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                bidirectional: isRtl,
                spacing: { after: 30 },
                children: [
                  new TextRun({
                    text: hl,
                    size: 20,
                    font: 'Calibri',
                  }),
                ],
              })
            );
          }
        }

        if (Array.isArray(exp.technologies) && exp.technologies.length > 0) {
          children.push(
            new Paragraph({
              bidirectional: isRtl,
              spacing: { before: 40, after: 120 },
              children: [
                new TextRun({
                  text: `${t.technologies}: `,
                  bold: true,
                  size: 18,
                  color: '4B5563',
                  font: 'Calibri',
                }),
                new TextRun({
                  text: exp.technologies.join(', '),
                  size: 18,
                  color: '374151',
                  font: 'Calibri',
                }),
              ],
            })
          );
        }
      }
    }

    // 4. Formations
    if (education.length > 0) {
      addSectionHeader(t.education);
      for (const edu of education) {
        const eduDate = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
        children.push(
          new Paragraph({
            bidirectional: isRtl,
            spacing: { before: 120, after: 40 },
            children: [
              new TextRun({
                text: [edu.degree, edu.field].filter(Boolean).join(t.degreeIn) || '',
                bold: true,
                size: 22,
                font: 'Calibri',
              }),
              new TextRun({
                text: eduDate ? `   (${eduDate})` : '',
                italics: true,
                size: 18,
                color: '4B5563',
                font: 'Calibri',
              }),
            ],
          })
        );
        if (edu.institution) {
          children.push(
            new Paragraph({
              bidirectional: isRtl,
              spacing: { after: 40 },
              children: [
                new TextRun({
                  text: edu.institution,
                  color: accentColor,
                  bold: true,
                  size: 20,
                  font: 'Calibri',
                }),
              ],
            })
          );
        }
        if (edu.summary) {
          children.push(
            new Paragraph({
              bidirectional: isRtl,
              spacing: { after: 100 },
              children: [
                new TextRun({
                  text: edu.summary,
                  size: 19,
                  font: 'Calibri',
                }),
              ],
            })
          );
        }
      }
    }

    // 5. Compétences
    if (skills.length > 0) {
      addSectionHeader(t.skills);
      const grouped = {};
      for (const sk of skills) {
        const cat = sk.category || t.generalCategory;
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(sk.level ? `${sk.name} (${sk.level})` : sk.name);
      }

      for (const [cat, items] of Object.entries(grouped)) {
        children.push(
          new Paragraph({
            bidirectional: isRtl,
            spacing: { before: 50, after: 50 },
            children: [
              new TextRun({
                text: `• ${cat} : `,
                bold: true,
                color: accentColor,
                size: 20,
                font: 'Calibri',
              }),
              new TextRun({
                text: items.join(', '),
                size: 20,
                font: 'Calibri',
              }),
            ],
          })
        );
      }
    }

    // 6. Langues
    if (languages.length > 0) {
      addSectionHeader(t.languages);
      const langStr = languages.map(l => `${l.name} (${l.level || t.defaultLevel})`).join('  •  ');
      children.push(
        new Paragraph({
          bidirectional: isRtl,
          spacing: { before: 50, after: 100 },
          children: [
            new TextRun({
              text: langStr,
              size: 20,
              font: 'Calibri',
            }),
          ],
        })
      );
    }

    // 7. Certifications
    if (certifications.length > 0) {
      addSectionHeader(t.certifications);
      for (const cert of certifications) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            bidirectional: isRtl,
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: cert.name,
                bold: true,
                size: 20,
                font: 'Calibri',
              }),
              new TextRun({
                text: [cert.issuer, cert.date].filter(Boolean).length > 0 ? ` - ${[cert.issuer, cert.date].filter(Boolean).join(' (')}${cert.date ? ')' : ''}` : '',
                size: 19,
                color: '4B5563',
                font: 'Calibri',
              }),
            ],
          })
        );
      }
    }

    // 8. Projets
    if (projects.length > 0) {
      addSectionHeader(t.projects);
      for (const pr of projects) {
        children.push(
          new Paragraph({
            bidirectional: isRtl,
            spacing: { before: 80, after: 40 },
            children: [
              new TextRun({
                text: pr.name,
                bold: true,
                size: 21,
                font: 'Calibri',
              }),
              new TextRun({
                text: pr.role ? ` — ${t.role}: ${pr.role}` : '',
                italics: true,
                size: 19,
                font: 'Calibri',
              }),
            ],
          })
        );
        if (pr.description) {
          children.push(
            new Paragraph({
              bidirectional: isRtl,
              spacing: { after: 40 },
              children: [
                new TextRun({
                  text: pr.description,
                  size: 19,
                  font: 'Calibri',
                }),
              ],
            })
          );
        }
        if (Array.isArray(pr.technologies) && pr.technologies.length > 0) {
          children.push(
            new Paragraph({
              bidirectional: isRtl,
              spacing: { after: 100 },
              children: [
                new TextRun({
                  text: `${t.technologies}: ${pr.technologies.join(', ')}`,
                  size: 18,
                  color: '6B7280',
                  font: 'Calibri',
                }),
              ],
            })
          );
        }
      }
    }

    // 9. Custom Sections
    if (customSections.length > 0) {
      for (const sec of customSections) {
        if (!sec || !sec.title) continue;
        addSectionHeader(sec.title);
        const items = Array.isArray(sec.items) ? sec.items : [];
        for (const item of items) {
          const itemTitle = item.title || item.name || '';
          const itemDate = item.date || '';
          if (itemTitle || itemDate) {
            children.push(
              new Paragraph({
                bidirectional: isRtl,
                spacing: { before: 80, after: 30 },
                children: [
                  new TextRun({
                    text: itemTitle,
                    bold: true,
                    size: 20,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: itemDate ? `   (${itemDate})` : '',
                    italics: true,
                    size: 18,
                    color: '4B5563',
                    font: 'Calibri',
                  }),
                ],
              })
            );
          }
          if (item.subtitle) {
            children.push(
              new Paragraph({
                bidirectional: isRtl,
                spacing: { after: 30 },
                children: [
                  new TextRun({
                    text: item.subtitle,
                    bold: true,
                    size: 19,
                    color: accentColor,
                    font: 'Calibri',
                  }),
                ],
              })
            );
          }
          if (item.description) {
            children.push(
              new Paragraph({
                bidirectional: isRtl,
                spacing: { after: 80 },
                children: [
                  new TextRun({
                    text: item.description,
                    size: 19,
                    font: 'Calibri',
                  }),
                ],
              })
            );
          }
        }
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1080, // 0.75 inch for better multi-page density
                right: 1080,
                bottom: 1080,
                left: 1080,
              },
            },
          },
          children,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }
}
