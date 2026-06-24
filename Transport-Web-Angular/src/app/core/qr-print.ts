import { Article } from './models';

function esc(s: string): string {
  return (s || '').replace(/[<>&"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Ouvre une fenêtre d'impression d'une étiquette QR chauffeur :
 *  - l'image du QR code (générée par le backend)
 *  - en dessous : le prénom et le nom du chauffeur
 */
export function imprimerQrChauffeur(blob: Blob, nom: string, prenom: string, onBlocked: () => void): void {
  const reader = new FileReader();
  reader.onloadend = () => {
    const dataUrl = reader.result as string;
    const w = window.open('', '_blank', 'width=420,height=600');
    if (!w) { onBlocked(); return; }
    const nomComplet = `${prenom || ''} ${nom || ''}`.trim() || 'Chauffeur';
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>QR ${esc(nomComplet)}</title>
      <style>
        * { margin: 0; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
        body { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
        .label { border: 1px solid #ddd; border-radius: 12px; padding: 26px 22px; text-align: center; width: 320px; }
        .label img { width: 250px; height: 250px; }
        .nom { font-size: 22px; font-weight: 700; margin-top: 16px; color: #1f2433; }
        .role { font-size: 13px; color: #0F7A8B; margin-top: 6px; text-transform: uppercase; letter-spacing: 1px; }
        @media print { .label { border: none; } @page { margin: 8mm; } }
      </style></head>
      <body onload="setTimeout(function(){ window.print(); }, 150)">
        <div class="label">
          <img src="${dataUrl}" alt="QR">
          <div class="nom">${esc(nomComplet)}</div>
          <div class="role">Chauffeur</div>
        </div>
      </body></html>`);
    w.document.close();
  };
  reader.readAsDataURL(blob);
}

/**
 * Ouvre une fenêtre d'impression contenant une étiquette QR :
 *  - l'image du QR code (générée par le backend)
 *  - en dessous : le nom de l'article et le chantier de destination
 * L'utilisateur peut imprimer ou « Enregistrer au format PDF ».
 */
export function imprimerEtiquetteQr(blob: Blob, a: Article, onBlocked: () => void): void {
  const reader = new FileReader();
  reader.onloadend = () => {
    const dataUrl = reader.result as string;
    const w = window.open('', '_blank', 'width=420,height=600');
    if (!w) { onBlocked(); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>QR ${esc(a.referenceGap || String(a.id))}</title>
      <style>
        * { margin: 0; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
        body { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
        .label { border: 1px solid #ddd; border-radius: 12px; padding: 26px 22px; text-align: center; width: 320px; }
        .label img { width: 250px; height: 250px; }
        .nom { font-size: 19px; font-weight: 700; margin-top: 16px; color: #1f2433; }
        .chantier { font-size: 14px; color: #555; margin-top: 6px; }
        .chantier b { color: #0F7A8B; }
        .ref { font-size: 12px; color: #999; margin-top: 10px; font-family: monospace; }
        @media print { .label { border: none; } @page { margin: 8mm; } }
      </style></head>
      <body onload="setTimeout(function(){ window.print(); }, 150)">
        <div class="label">
          <img src="${dataUrl}" alt="QR">
          <div class="nom">${esc(a.nom || 'Article')}</div>
          <div class="chantier">Chantier : <b>${esc(a.chantierDestination || '—')}</b></div>
          <div class="ref">${esc(a.referenceGap || '')}</div>
        </div>
      </body></html>`);
    w.document.close();
  };
  reader.readAsDataURL(blob);
}
