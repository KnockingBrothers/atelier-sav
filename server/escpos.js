// Construction des commandes ESC/POS pour l'étiquette POS80 (imprimante
// thermique 80 mm, ex. Epson TM-T20III), envoyée par le serveur sur le
// port TCP 9100 de l'imprimante.

// Avance de papier AVANT la coupe : 4 cm = 320 points (8 points par mm à
// 203 dpi). ESC J accepte 255 points au maximum par commande : on en
// envoie donc deux de 160. À ajuster ici après un essai réel si besoin.
export const FEED_BEFORE_CUT_DOTS = 320;

// Largeur d'une ligne en caractères (police A, 12 points de large, sur
// 576 points imprimables). Le texte en double largeur en compte moitié moins.
const CHARS_PER_LINE = 48;

// Table de caractères CP858 (Europe de l'Ouest, avec €) : numéro 19 sur
// les Epson TM. Seuls les caractères utiles en français sont convertis.
const CP858 = {
  "é": 0x82, "è": 0x8a, "ê": 0x88, "ë": 0x89, "à": 0x85, "â": 0x83, "ä": 0x84,
  "ç": 0x87, "î": 0x8c, "ï": 0x8b, "ô": 0x93, "ö": 0x94, "ù": 0x97, "û": 0x96,
  "ü": 0x81, "É": 0x90, "È": 0xd4, "Ê": 0xd2, "Ë": 0xd3, "À": 0xb7, "Â": 0xb6,
  "Ä": 0x8e, "Ç": 0x80, "Î": 0xd7, "Ï": 0xd8, "Ô": 0xe2, "Ö": 0x99, "Ù": 0xeb,
  "Û": 0xea, "Ü": 0x9a, "€": 0xd5, "°": 0xf8,
};

// Remplacements simples pour les caractères absents de la table.
const SUBSTITUTES = { "œ": "oe", "Œ": "OE", "’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "...", " ": " " };

// Texte -> octets CP858. Les caractères de contrôle sont supprimés (un
// texte saisi par l'utilisateur ne doit jamais pouvoir injecter de commande
// ESC/POS) et tout caractère inconnu devient "?".
export function encodeText(text) {
  const out = [];
  for (const ch of String(text ?? "")) {
    const sub = SUBSTITUTES[ch];
    const chars = sub !== undefined ? sub : ch;
    for (const c of chars) {
      const code = c.codePointAt(0);
      if (code < 0x20 || code === 0x7f) continue;
      if (code < 0x7f) out.push(code);
      else if (CP858[c] !== undefined) out.push(CP858[c]);
      else out.push(0x3f);
    }
  }
  return Buffer.from(out);
}

// Découpe un texte en lignes de `width` caractères maximum, aux espaces
// quand c'est possible.
export function wrapText(text, width) {
  const words = String(text ?? "").replace(/[\r\n\t]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (let word of words) {
    while (word.length > width) {
      if (line) { lines.push(line); line = ""; }
      lines.push(word.slice(0, width));
      word = word.slice(width);
    }
    if (!line) line = word;
    else if ((line + " " + word).length <= width) line += " " + word;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

const ESC = 0x1b;
const GS = 0x1d;
const LF = Buffer.from([0x0a]);
const bytes = (...b) => Buffer.from(b);

// size : 0x00 normal, 0x01 double hauteur, 0x11 double hauteur et largeur
function textLines(text, { size = 0x00, bold = false, align = 0, maxLines = 3 } = {}) {
  const width = size & 0x10 ? CHARS_PER_LINE / 2 : CHARS_PER_LINE;
  const lines = wrapText(text, width).slice(0, maxLines);
  const parts = [bytes(ESC, 0x61, align), bytes(GS, 0x21, size), bytes(ESC, 0x45, bold ? 1 : 0)];
  for (const l of lines) parts.push(encodeText(l), LF);
  parts.push(bytes(GS, 0x21, 0x00), bytes(ESC, 0x45, 0x00));
  return Buffer.concat(parts);
}

// Étiquette : { code, date, nom, modele, service, ean14 }
export function buildLabel(label) {
  const l = label || {};
  const parts = [];
  parts.push(bytes(ESC, 0x40)); // ESC @ : initialisation
  parts.push(bytes(ESC, 0x74, 19)); // ESC t 19 : table CP858

  parts.push(textLines(l.code, { size: 0x11, bold: true, maxLines: 1 }));
  if (l.date) parts.push(textLines(l.date, { maxLines: 1 }));
  parts.push(LF);
  parts.push(textLines(l.nom || "Sans nom", { size: 0x01, bold: true, maxLines: 2 }));
  const modele = [l.modele, l.service].filter((s) => s && String(s).trim()).join(" - ");
  if (modele) parts.push(textLines(modele, { maxLines: 2 }));

  if (/^\d{14}$/.test(String(l.ean14 || ""))) {
    parts.push(LF);
    parts.push(bytes(ESC, 0x61, 1)); // centré
    parts.push(bytes(GS, 0x68, 80)); // hauteur des barres : 80 points
    parts.push(bytes(GS, 0x77, 3)); // largeur d'un module : 3 points
    parts.push(bytes(GS, 0x48, 2)); // chiffres lisibles sous le code
    parts.push(bytes(GS, 0x66, 0)); // police A pour ces chiffres
    // GS k 5 : ITF (fonction A), chiffres ASCII terminés par NUL
    parts.push(bytes(GS, 0x6b, 5), Buffer.from(l.ean14, "ascii"), bytes(0x00));
    parts.push(LF);
  }

  // Avance de papier (en deux fois, ESC J est limité à 255 points) puis
  // coupe partielle avec avance jusqu'à la lame (GS V 65 3).
  let remaining = FEED_BEFORE_CUT_DOTS;
  while (remaining > 0) {
    const n = Math.min(remaining, 160);
    parts.push(bytes(ESC, 0x4a, n));
    remaining -= n;
  }
  parts.push(bytes(ESC, 0x61, 0));
  parts.push(bytes(GS, 0x56, 0x41, 0x03));
  return Buffer.concat(parts);
}

// Seules les adresses du réseau local sont acceptées (10.x, 172.16-31.x,
// 192.168.x) ainsi que 127.x (essais sur le serveur lui-même), pour que
// la route d'impression ne puisse pas servir à joindre un hôte quelconque.
export function isAllowedPrinterIp(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip || "").trim());
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
