import { PDFImporterService } from './pdf-importer.js';

export class LinkedInImporterService {
  static async parseLinkedInPdf(buffer) {
    const extracted = await PDFImporterService.parsePdfBuffer(buffer);
    // LinkedIn PDF exports standard format tweaks
    return {
      ...extracted,
      source: 'linkedin_pdf',
    };
  }

  static explainUrlImportLimitation(linkedinUrl) {
    let cleanUrl = linkedinUrl ? linkedinUrl.trim() : '';
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    return {
      success: false,
      message: 'LinkedIn applique des protections strictes contre le scraping direct automatisé des profils publics sans authentification officielle propriétaire.',
      advice: 'Pour importer votre profil LinkedIn en 10 secondes sans perte de données :',
      steps: [
        '1. Rendez-vous sur votre profil LinkedIn dans votre navigateur.',
        '2. Cliquez sur le bouton "Plus" (à côté de "Ajouter une section").',
        '3. Sélectionnez "Enregistrer au format PDF".',
        '4. Déposez simplement le fichier PDF obtenu sur notre outil d\'import PDF intelligent !',
      ],
      detectedUrl: cleanUrl,
    };
  }
}
