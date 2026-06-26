/**
 * Génération d'un PDF (1 page) contenant un QR code, sans dépendance externe.
 *
 * On reçoit l'image du QR sous forme de Blob (récupérée via HttpClient, donc
 * même origine → l'URL `blob:` n'altère pas le canvas et `toDataURL` reste
 * autorisé). On dessine le QR (+ un titre) sur un canvas, on l'exporte en JPEG,
 * puis on assemble un PDF minimal embarquant ce JPEG (DCTDecode / DeviceRGB).
 */

/** Charge un Blob image dans un HTMLImageElement. */
function chargerImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = src;
  });
}

/** Convertit une chaîne base64 en octets bruts. */
function base64EnOctets(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Assemble un PDF d'une page embarquant l'image JPEG fournie (largeur×hauteur en points). */
function construirePdf(jpeg: Uint8Array, w: number, h: number): Blob {
  const enc = (s: string) => new TextEncoder().encode(s);
  const parties: Uint8Array[] = [];
  let taille = 0;
  const offsets: number[] = [];
  const push = (u: Uint8Array) => { parties.push(u); taille += u.length; };

  push(enc('%PDF-1.3\n'));

  offsets[1] = taille;
  push(enc('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));

  offsets[2] = taille;
  push(enc('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'));

  offsets[3] = taille;
  push(enc(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] `
    + `/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`));

  const contenu = enc(`q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`);
  offsets[4] = taille;
  push(enc(`4 0 obj\n<< /Length ${contenu.length} >>\nstream\n`));
  push(contenu);
  push(enc('\nendstream\nendobj\n'));

  offsets[5] = taille;
  push(enc(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} `
    + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`));
  push(jpeg);
  push(enc('\nendstream\nendobj\n'));

  const debutXref = taille;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(enc(xref));
  push(enc(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF`));

  const out = new Uint8Array(taille);
  let pos = 0;
  for (const p of parties) { out.set(p, pos); pos += p.length; }
  return new Blob([out], { type: 'application/pdf' });
}

/** Construit un PDF (A4-ish carré) à partir du Blob image d'un QR code. */
export async function blobQrEnPdf(imgBlob: Blob, titre: string): Promise<Blob> {
  const objUrl = URL.createObjectURL(imgBlob);
  try {
    const img = await chargerImage(objUrl);
    const cote = 560;
    const marge = 40;
    const titreH = titre ? 70 : marge;
    const canvas = document.createElement('canvas');
    canvas.width = cote + marge * 2;
    canvas.height = cote + titreH + marge;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponible');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (titre) {
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(titre, canvas.width / 2, marge + 22);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, marge, titreH, cote, cote);

    const jpeg = base64EnOctets(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);
    return construirePdf(jpeg, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}
