import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';

export class DocxGeneratorService {
  static async generate(resumeData, options = {}) {
    const personal = resumeData.personal || {};
    const experiences = resumeData.experiences || [];
    const education = resumeData.education || [];
    const skills = resumeData.skills || [];
    const languages = resumeData.languages || [];
    const certifications = resumeData.certifications || [];
    const projects = resumeData.projects || [];
    const accentColor = options.primaryColor ? options.primaryColor.replace('#', '') : '1E3A8A'; // Navy / Blue

    const children = [];

    // 1. Header: Full Name
    const fullName = `${personal.firstName || ''} ${personal.lastName || ''}`.trim() || 'Curriculum Vitae';
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
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
    if (personal.title) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 150 },
          children: [
            new TextRun({
              text: personal.title.toUpperCase(),
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
    if (personal.city || personal.country) {
      contactParts.push([personal.city, personal.country].filter(Boolean).join(', '));
    }
    if (personal.linkedin) contactParts.push(`LinkedIn: ${personal.linkedin}`);
    if (personal.github) contactParts.push(`GitHub: ${personal.github}`);
    if (personal.website) contactParts.push(personal.website);

    if (contactParts.length > 0) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
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
              text: title.toUpperCase(),
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
      addSectionHeader('Profil Professionnel');
      children.push(
        new Paragraph({
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
      addSectionHeader('Expériences Professionnelles');
      for (const exp of experiences) {
        // Job Title & Dates
        const dateStr = [exp.startDate, exp.current ? 'Présent' : exp.endDate].filter(Boolean).join(' - ');
        
        children.push(
          new Paragraph({
            spacing: { before: 150, after: 50 },
            children: [
              new TextRun({
                text: exp.position || 'Poste',
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

        // Company & Location
        const companyStr = [exp.company, exp.location].filter(Boolean).join(' | ');
        if (companyStr) {
          children.push(
            new Paragraph({
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

        // Summary
        if (exp.summary) {
          children.push(
            new Paragraph({
              spacing: { after: 50 },
              children: [
                new TextRun({
                  text: exp.summary,
                  size: 20,
                  font: 'Calibri',
                }),
              ],
            })
          );
        }

        // Highlights bullets
        if (Array.isArray(exp.highlights) && exp.highlights.length > 0) {
          for (const hl of exp.highlights) {
            if (!hl) continue;
            children.push(
              new Paragraph({
                bullet: { level: 0 },
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

        // Technologies used
        if (Array.isArray(exp.technologies) && exp.technologies.length > 0) {
          children.push(
            new Paragraph({
              spacing: { before: 40, after: 120 },
              children: [
                new TextRun({
                  text: 'Technologies: ',
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
      addSectionHeader('Formations & Diplômes');
      for (const edu of education) {
        const eduDate = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 40 },
            children: [
              new TextRun({
                text: [edu.degree, edu.field].filter(Boolean).join(' en ') || 'Formation',
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
      addSectionHeader('Compétences Clés');
      const grouped = {};
      for (const sk of skills) {
        const cat = sk.category || 'Général';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(sk.level ? `${sk.name} (${sk.level})` : sk.name);
      }

      for (const [cat, items] of Object.entries(grouped)) {
        children.push(
          new Paragraph({
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
      addSectionHeader('Langues');
      const langStr = languages.map(l => `${l.name} (${l.level || 'Courant'})`).join('  •  ');
      children.push(
        new Paragraph({
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
      addSectionHeader('Certifications');
      for (const cert of certifications) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: cert.name,
                bold: true,
                size: 20,
                font: 'Calibri',
              }),
              new TextRun({
                text: [cert.issuer, cert.date].filter(Boolean).length > 0 ? ` - ${[cert.issuer, cert.date].filter(Boolean).join(' (')} ${cert.date ? ')' : ''}` : '',
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
      addSectionHeader('Projets Notables');
      for (const pr of projects) {
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 40 },
            children: [
              new TextRun({
                text: pr.name,
                bold: true,
                size: 21,
                font: 'Calibri',
              }),
              new TextRun({
                text: pr.role ? ` — Rôle: ${pr.role}` : '',
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
              spacing: { after: 100 },
              children: [
                new TextRun({
                  text: `Technologies: ${pr.technologies.join(', ')}`,
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

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch
                right: 1440,
                bottom: 1440,
                left: 1440,
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
