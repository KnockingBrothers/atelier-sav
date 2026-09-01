import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Plus, Search, X, Printer, Trash2, Save, ArrowLeft, Lock, Smartphone, ChevronDown, AlertCircle, Loader2, Tag, ArchiveRestore } from "lucide-react";
// jsPDF n'est plus importé ici en statique : il est chargé à la demande
// (voir generateTicketPDF) pour éviter d'alourdir le chargement initial
// de l'application avec une librairie utilisée seulement à l'impression.

const LABEL_PRESETS = [
  { id: "50x30", label: "50 × 30 mm", w: 50, h: 30 },
  { id: "40x30", label: "40 × 30 mm", w: 40, h: 30 },
  { id: "62x29", label: "62 × 29 mm (Brother DK)", w: 62, h: 29 },
  { id: "57x32", label: "57 × 32 mm", w: 57, h: 32 },
  { id: "custom", label: "Personnalisé", w: null, h: null },
];

const ACCESSOIRES = [
  { key: "sacoche", label: "Sacoche" },
  { key: "chargeur", label: "Chargeur" },
  { key: "souris", label: "Souris" },
  { key: "usbWifi", label: "Usb / Wifi" },
];

const ETATS = ["Excellent", "Bon", "Moyen", "Mauvais", "Autres"];

const ETAT_COLOR = {
  Excellent: "#4FB08A",
  Bon: "#7FC7A8",
  Moyen: "#E8A33D",
  Mauvais: "#E2604F",
  Autres: "#8B93A1",
};

const STATUTS = ["Reçu", "En cours", "Attente retour client", "Attente pièces", "Prêt", "Appel/SMS", "Restitué"];

const STATUT_COLOR = {
  "Reçu": "var(--text-muted)",
  "En cours": "var(--amber)",
  "Attente retour client": "var(--red)",
  "Attente pièces": "var(--red)",
  "Prêt": "var(--teal)",
  "Appel/SMS": "#C5F527",
  "Restitué": "var(--teal)",
};

const CHECKUP_ITEMS = [
  { key: "hp", label: "HP" },
  { key: "ecouteur", label: "Écouteur" },
  { key: "mic1", label: "Mic 1" },
  { key: "mic2", label: "Mic 2" },
  { key: "camAv", label: "Cam av." },
  { key: "camArr", label: "Cam arr." },
  { key: "lcd", label: "Lcd" },
  { key: "connecteur", label: "Connecteur" },
  { key: "charge", label: "Charge" },
  { key: "chargeurCk", label: "Chargeur" },
  { key: "antivirus", label: "Antivirus" },
  { key: "nettoyage", label: "Nettoyage" },
  { key: "clone", label: "Clone" },
  { key: "smart", label: "SMART" },
  { key: "w11", label: "Windows" },
];

// Interventions à prévoir (switches "-" / "à faire" / "OK"), affichées
// à côté du schéma de déverrouillage.
const TASK_ITEMS = [
  { key: "nett", label: "Nettoyage" },
  { key: "antivirus", label: "Antivirus" },
  { key: "installOs", label: "Install Os à préciser" },
  { key: "remplacementDisque", label: "Remplacement disque" },
  { key: "clone", label: "Clone" },
  { key: "password", label: "Password" },
  { key: "lcd", label: "Ecran" },
  { key: "batterie", label: "Batterie" },
  { key: "connecteur", label: "Connecteur" },
  { key: "faceArriere", label: "Face arrière" },
  { key: "ecouteurInterne", label: "Ecouteur interne" },
  { key: "reinitialiser", label: "Réinitialiser" },
  { key: "imprimante", label: "Imprimante à préciser" },
];

// Ces 5 items sont regroupés dans une colonne dédiée, la plus à droite,
// dans cet ordre précis du haut vers le bas.
const RIGHT_COL_KEYS = ["lcd", "batterie", "connecteur", "faceArriere", "ecouteurInterne", "reinitialiser"];
const MAIN_TASK_ITEMS = TASK_ITEMS.filter((t) => !RIGHT_COL_KEYS.includes(t.key));
const RIGHT_COL_TASK_ITEMS = RIGHT_COL_KEYS.map((k) => TASK_ITEMS.find((t) => t.key === k));

// Items dont l'activation ("à faire" ou "OK") affiche un champ de
// précision texte juste en dessous de la grille.
const TASK_DETAIL_KEYS = ["installOs", "imprimante"];

function PatternLock({ value, onChange, readOnly, size = 176, monochrome }) {
  const points = value || [];
  const coords = [
    [1, 1], [2, 1], [3, 1],
    [1, 2], [2, 2], [3, 2],
    [1, 3], [2, 3], [3, 3],
  ];
  const unit = size / 4;
  const pos = (n) => {
    const [cx, cy] = coords[n - 1];
    return [cx * unit, cy * unit];
  };
  const handleClick = (n) => {
    if (readOnly) return;
    if (points.includes(n)) return;
    onChange([...points, n]);
  };
  const pathD = points
    .map((n, i) => {
      const [x, y] = pos(n);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const lineColor = monochrome ? "#000" : "var(--amber)";
  const usedFill = monochrome ? "#000" : "var(--amber)";
  const unusedFill = monochrome ? "#fff" : "var(--graphite-800)";
  const unusedStroke = monochrome ? "#000" : "var(--line)";
  const usedTextFill = monochrome ? "#fff" : "#2A1B04";
  return (
    <div style={{ display: "inline-block" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ touchAction: "none", display: "block" }}>
        {pathD && (
          <path d={pathD} stroke={lineColor} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {coords.map((c, i) => {
          const n = i + 1;
          const [x, y] = pos(n);
          const used = points.includes(n);
          const order = points.indexOf(n);
          return (
            <g key={n} onClick={() => handleClick(n)} style={{ cursor: readOnly ? "default" : "pointer" }}>
              <circle
                cx={x}
                cy={y}
                r={unit * 0.32}
                fill={used ? usedFill : unusedFill}
                stroke={used ? usedFill : unusedStroke}
                strokeWidth="1.5"
              />
              {used && (
                <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fill={usedTextFill} fontWeight="600">
                  {order + 1}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {!readOnly && points.length > 0 && (
        <button
          type="button"
          className="sav-btn"
          style={{ marginTop: 10, padding: "6px 12px", fontSize: 12 }}
          onClick={() => onChange([])}
        >
          Effacer le schéma
        </button>
      )}
    </div>
  );
}

function blankTicket() {
  return {
    id: null,
    numero: "",
    statut: "Reçu",
    createdAt: null,
    updatedAt: null,
    restituedAt: null,
    archived: false,
    archivedAt: null,
    nom: "",
    telephone: "",
    email: "",
    motDePasse: "",
    codeDeverrouillage: "",
    schema: [],
    ean14: "",
    marqueModele: "",
    imei: "",
    panne: "",
    diagnostic: "",
    accessoires: { sacoche: false, chargeur: false, souris: false, usbWifi: false, autres: false, autresTexte: "" },
    etat: "",
    etatAutresTexte: "",
    remarque: "",
    total: "",
    priseEnCharge: "",
    checkup: {},
    taches: {},
    imprimanteDetail: "",
    installOsDetail: "",
  };
}

const ARCHIVE_DELAY_MS = 24 * 60 * 60 * 1000; // 24h avant archivage automatique

async function loadCounter() {
  try {
    const r = await window.storage.get("sav:counter");
    return r ? parseInt(r.value, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildNumero(n) {
  const now = new Date();
  const year = now.getFullYear();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(year).slice(-2);
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `T-${year}-${String(n).padStart(4, "0")}-${dd}${mm}${yy}-${hh}${min}`;
}

// Découpe le numéro long (T-2026-0001-100826-0821) en un code court
// et une date/heure lisible, pour tenir sur une petite étiquette.
function splitNumeroForLabel(numero) {
  const m = /^T-(\d{4})-(\d{4})-(\d{2})(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(numero || "");
  if (!m) return { code: numero || "", date: "" };
  const [, year, seq, dd, mm, yy, hh, min] = m;
  return {
    code: `T-${year}-${seq}`,
    date: `${dd}/${mm}/${yy} ${hh}:${min}`,
  };
}

// ── Code-barres EAN-14 (GTIN-14 / ITF-14) ──────────────────────────
function computeGtin14CheckDigit(digits13) {
  let sum = 0;
  for (let i = 0; i < digits13.length; i++) {
    const d = parseInt(digits13[i], 10);
    const posFromRight = digits13.length - 1 - i;
    const weight = posFromRight % 2 === 0 ? 3 : 1;
    sum += d * weight;
  }
  return (10 - (sum % 10)) % 10;
}

function buildEan14(n) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const seq = String(n).padStart(6, "0").slice(-6);
  const payload13 = `0${yy}${mm}${dd}${seq}`;
  const check = computeGtin14CheckDigit(payload13);
  return payload13 + String(check);
}

const ITF_PATTERNS = {
  "0": "NNWWN", "1": "WNNNW", "2": "NWNNW", "3": "WWNNN", "4": "NNWNW",
  "5": "WNWNN", "6": "NWWNN", "7": "NNNWW", "8": "WNNWN", "9": "NWNWN",
};

function computeItf14Bars(digits14) {
  const WIDE = 2.5;
  const bars = [];
  bars.push({ color: "black", w: 1 });
  bars.push({ color: "white", w: 1 });
  bars.push({ color: "black", w: 1 });
  bars.push({ color: "white", w: 1 });
  for (let i = 0; i < digits14.length; i += 2) {
    const barPattern = ITF_PATTERNS[digits14[i]];
    const spacePattern = ITF_PATTERNS[digits14[i + 1]];
    if (!barPattern || !spacePattern) continue;
    for (let j = 0; j < 5; j++) {
      bars.push({ color: "black", w: barPattern[j] === "W" ? WIDE : 1 });
      bars.push({ color: "white", w: spacePattern[j] === "W" ? WIDE : 1 });
    }
  }
  bars.push({ color: "black", w: WIDE });
  bars.push({ color: "white", w: 1 });
  bars.push({ color: "black", w: 1 });
  return bars;
}

function Barcode({ digits, widthMm = 40, heightMm = 12 }) {
  if (!digits || digits.length !== 14) return null;
  const bars = computeItf14Bars(digits);
  const totalUnits = bars.reduce((s, b) => s + b.w, 0);
  let x = 0;
  const rects = [];
  bars.forEach((b, i) => {
    if (b.color === "black") {
      rects.push(<rect key={i} x={x} y={0} width={b.w} height={100} fill="#000" />);
    }
    x += b.w;
  });
  return (
    <svg
      width={`${widthMm}mm`}
      height={`${heightMm}mm`}
      viewBox={`0 0 ${totalUnits} 100`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      <rect x="0" y="0" width={totalUnits} height="100" fill="#fff" />
      {rects}
    </svg>
  );
}

// Dessine le code-barres ITF-14 directement dans le PDF (jsPDF), en
// réutilisant le même calcul de barres que le composant SVG Barcode.
function drawBarcodePDF(doc, digits14, x, y, widthMm, heightMm) {
  const bars = computeItf14Bars(digits14);
  const totalUnits = bars.reduce((s, b) => s + b.w, 0);
  const scale = widthMm / totalUnits;
  let cx = x;
  doc.setFillColor(0, 0, 0);
  bars.forEach((b) => {
    const w = b.w * scale;
    if (b.color === "black") {
      doc.rect(cx, y, w, heightMm, "F");
    }
    cx += w;
  });
}

// Génère un vrai fichier PDF téléchargeable pour la fiche : format B5
// (176 × 250 mm), fond transparent, texte entièrement en noir.
// jsPDF est importé dynamiquement ici (au moment de l'impression),
// pas au chargement de l'app, pour garder le bundle initial léger.
async function generateTicketPDF(ticket) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: [176, 250] }); // B5
  const marginX = 14;
  const pageWidth = 176;
  const contentWidth = pageWidth - marginX * 2;
  let y = 16;

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  if (ticket.ean14) {
    const barcodeWidthMm = 55;
    const barcodeHeightMm = 14;
    const barcodeX = pageWidth / 2 - barcodeWidthMm / 2;
    const barcodeY = 8;
    drawBarcodePDF(doc, ticket.ean14, barcodeX, barcodeY, barcodeWidthMm, barcodeHeightMm);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(ticket.ean14, pageWidth / 2, barcodeY + barcodeHeightMm + 4, { align: "center" });
    y = barcodeY + barcodeHeightMm + 11;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`Fiche de prise en charge - ${ticket.numero}`, marginX, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Date : ${new Date(ticket.createdAt || Date.now()).toLocaleDateString("fr-FR")}`, marginX, y);
  y += 8;

  const isFilled = (v) => v !== undefined && v !== null && String(v).trim() !== "";
  const fields = [
    ["Nom", ticket.nom],
    ["Téléphone", ticket.telephone],
    isFilled(ticket.email) ? ["Email", ticket.email] : null,
    isFilled(ticket.motDePasse) ? ["Mot de passe", ticket.motDePasse] : null,
    isFilled(ticket.codeDeverrouillage) ? ["Code déverrouillage", ticket.codeDeverrouillage] : null,
    ["Marque / modèle", ticket.marqueModele],
    ["N° IMEI / Série", ticket.imei],
    ["État du matériel", (ticket.etat || "") + (ticket.etat === "Autres" ? ` (${ticket.etatAutresTexte})` : "")],
    isFilled(ticket.total) ? ["Total", ticket.total] : null,
    isFilled(ticket.priseEnCharge) ? ["Prise en charge à déduire", ticket.priseEnCharge] : null,
  ].filter(Boolean);
  const colWidth = contentWidth / 2;
  doc.setFontSize(9.5);
  fields.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = marginX + col * colWidth;
    const fy = y + row * 9;
    doc.setFont("helvetica", "bold");
    doc.text(`${label} :`, x, fy);
    doc.setFont("helvetica", "normal");
    doc.text(String(value || "-"), x, fy + 4.2);
  });
  y += Math.ceil(fields.length / 2) * 9 + 4;

  if (ticket.schema && ticket.schema.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Schéma de déverrouillage :", marginX, y);
    y += 4;
    const gridSize = 22;
    const dotR = 1.6;
    const coords = [
      [1, 1], [2, 1], [3, 1],
      [1, 2], [2, 2], [3, 2],
      [1, 3], [2, 3], [3, 3],
    ];
    const unit = gridSize / 4;
    const originX = marginX;
    const originY = y;
    const pos = (n) => {
      const [cx, cy] = coords[n - 1];
      return [originX + cx * unit, originY + cy * unit];
    };
    doc.setLineWidth(0.6);
    for (let i = 0; i < ticket.schema.length - 1; i++) {
      const [x1, y1] = pos(ticket.schema[i]);
      const [x2, y2] = pos(ticket.schema[i + 1]);
      doc.line(x1, y1, x2, y2);
    }
    doc.setLineWidth(0.3);
    coords.forEach((c, i) => {
      const n = i + 1;
      const [px, py] = pos(n);
      const used = ticket.schema.includes(n);
      doc.setFillColor(used ? 0 : 255, used ? 0 : 255, used ? 0 : 255);
      doc.circle(px, py, dotR, used ? "FD" : "D");
    });
    y += gridSize + 6;
  }

  const drawBox = (title, text, startY) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(title, marginX, startY);
    const lines = doc.splitTextToSize(text || "-", contentWidth - 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const boxHeight = Math.max(10, lines.length * 4.2 + 6);
    doc.rect(marginX, startY + 2, contentWidth, boxHeight);
    doc.text(lines, marginX + 3, startY + 7);
    return startY + boxHeight + 8;
  };

  const colW = contentWidth / 3;
  const hasTaches = ticket.taches && Object.keys(ticket.taches).length > 0;
  const hasPanne = ticket.panne && ticket.panne.trim();
  const hasDiagnostic = ticket.diagnostic && ticket.diagnostic.trim();
  const hasAccessoires = ACCESSOIRES.some((a) => ticket.accessoires[a.key]) || ticket.accessoires.autres;
  const hasRemarque = ticket.remarque && ticket.remarque.trim();
  const hasCheckup = ticket.checkup && Object.keys(ticket.checkup).length > 0;

  if (hasTaches) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Interventions à prévoir :", marginX, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    TASK_ITEMS.forEach((t, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = marginX + col * colW;
      const fy = y + row * 5;
      doc.text(`${t.label} : ${ticket.taches[t.key] || "-"}`, x, fy);
    });
    y += Math.ceil(TASK_ITEMS.length / 3) * 5 + 4;

    if (ticket.taches.installOs && ticket.installOsDetail) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(`Install Os - précision : ${ticket.installOsDetail}`, contentWidth);
      doc.text(lines, marginX, y);
      y += lines.length * 3.2 + 2;
    }
    if (ticket.taches.imprimante && ticket.imprimanteDetail) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(`Imprimante - précision : ${ticket.imprimanteDetail}`, contentWidth);
      doc.text(lines, marginX, y);
      y += lines.length * 3.2 + 2;
    }
    y += 4;
  }

  if (hasPanne) {
    y = drawBox("Panne constatée", ticket.panne, y);
  }

  if (hasDiagnostic) {
    y = drawBox("Diagnostic / Intervention", ticket.diagnostic, y);
  }

  if (hasAccessoires) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Accessoires :", marginX, y);
    doc.setFont("helvetica", "normal");
    const accessoiresText =
      [
        ...ACCESSOIRES.filter((a) => ticket.accessoires[a.key]).map((a) => a.label),
        ticket.accessoires.autres ? `Autres (${ticket.accessoires.autresTexte})` : null,
      ]
        .filter(Boolean)
        .join(", ") || "-";
    doc.text(doc.splitTextToSize(accessoiresText, contentWidth - 30), marginX + 26, y);
    y += 8;
  }

  if (hasRemarque) {
    y = drawBox("Remarque précision", ticket.remarque, y);
  }

  if (hasCheckup) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Check-up SAV :", marginX, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    CHECKUP_ITEMS.forEach((c, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = marginX + col * colW;
      const fy = y + row * 5;
      doc.text(`${c.label} : ${ticket.checkup[c.key] || "-"}`, x, fy);
    });
    y += Math.ceil(CHECKUP_ITEMS.length / 3) * 5 + 6;
  }

  // ── Pied de page (mentions légales / conditions) ──────────────────
  const footerLines = [
    "Devis et prise en charge : le montant du devis ou des frais de prise en charge sera déduit du montant total de la réparation si celle-ci est effectuée par nos soins.",
    "Données personnelles : nous déclinons toute responsabilité en cas de perte, d'altération ou d'inaccessibilité des données présentes sur l'appareil. Le client est invité à effectuer, dans la mesure du possible, une sauvegarde complète de ses données sur un support externe avant tout dépôt ou envoi de matériel.",
    "Éléments endommagés : lors du démontage, des éléments préalablement fragilisés, usés ou endommagés peuvent être découverts. Nous ne saurions être tenus responsables des dommages ou dysfonctionnements résultant de cet état préexistant. Toute réparation supplémentaire rendue nécessaire fera l'objet d'un devis complémentaire avant intervention.",
    "Imprimantes et consommables compatibles : en cas d'utilisation de consommables compatibles, un jeu de consommables d'origine pourra être installé afin d'effectuer les tests et/ou le diagnostic de l'imprimante. Le coût de ces consommables reste entièrement à la charge du client, quel que soit le résultat des tests ou de la réparation.",
  ];
  doc.setLineWidth(0.3);
  doc.line(marginX, y, marginX + contentWidth, y);
  y += 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.8);
  footerLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, contentWidth);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 3 + 1.5;
  });

  doc.save(`${ticket.numero}.pdf`);
}

function formatAgo(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "à l'instant";
  if (s < 60) return `il y a ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  return `il y a ${h} h`;
}

// Numéro de version basé sur la date/heure de compilation (injectée par
// vite.config.js au moment de npm run build). Repli sur "dev" si cette
// variable n'existe pas (ex. aperçu hors build Vite).
function getBuildVersion() {
  try {
    // eslint-disable-next-line no-undef
    if (typeof __BUILD_DATE__ !== "undefined") {
      // eslint-disable-next-line no-undef
      const d = new Date(__BUILD_DATE__);
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    }
  } catch {}
  return "dev";
}

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("list");
  const [current, setCurrent] = useState(null);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("Toutes");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [nomTouched, setNomTouched] = useState(false);
  const [telephoneTouched, setTelephoneTouched] = useState(false);
  const [printMode, setPrintMode] = useState("ticket");
  const [labelPreset, setLabelPreset] = useState("50x30");
  const [labelSize, setLabelSize] = useState({ w: 50, h: 30 });
  const [lastSync, setLastSync] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncTick, setSyncTick] = useState(0);

  const loadTickets = useCallback(async (opts = {}) => {
    const { silent = false } = opts;
    if (silent) setSyncing(true);
    try {
      const list = await window.storage.list("sav:ticket:");
      const keys = list && list.keys ? list.keys : [];
      const loaded = [];
      for (const k of keys) {
        try {
          const r = await window.storage.get(k);
          if (r && r.value) loaded.push(JSON.parse(r.value));
        } catch {}
      }
      loaded.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      // Archive automatiquement les fiches "Restitué" non supprimées dont
      // le délai de 48h est écoulé depuis le passage à ce statut.
      const now = Date.now();
      const toArchive = loaded.filter(
        (t) => t.statut === "Restitué" && !t.archived && t.restituedAt && now - t.restituedAt >= ARCHIVE_DELAY_MS
      );
      if (toArchive.length > 0) {
        for (const t of toArchive) {
          t.archived = true;
          t.archivedAt = now;
          try {
            await window.storage.set(`sav:ticket:${t.id}`, JSON.stringify(t));
          } catch {}
        }
      }

      setTickets(loaded);
      setLastSync(Date.now());
      if (!silent) setError("");
    } catch (e) {
      if (!silent) setError("Impossible de charger vos fiches. Réessayez.");
    }
    if (silent) setSyncing(false);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadTickets();
      try {
        const saved = await window.storage.get("sav:labelsize");
        if (saved && saved.value) {
          const parsed = JSON.parse(saved.value);
          if (parsed && parsed.w && parsed.h) {
            setLabelSize({ w: parsed.w, h: parsed.h });
            setLabelPreset(parsed.preset || "custom");
          }
        }
      } catch {}
      setLoading(false);
    })();
  }, [loadTickets]);

  // Synchronisation automatique de la liste toutes les 8 secondes,
  // et à chaque fois que l'onglet reprend le focus — pour que les
  // fiches créées ou modifiées sur un autre poste apparaissent sans
  // avoir à recharger la page manuellement.
  useEffect(() => {
    if (view !== "list") return;
    const interval = setInterval(() => {
      loadTickets({ silent: true });
      setSyncTick((t) => t + 1);
    }, 8000);
    const onFocus = () => loadTickets({ silent: true });
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") loadTickets({ silent: true });
    });
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [view, loadTickets]);

  // Force un re-rendu léger toutes les 20s pour rafraîchir le texte
  // "il y a X" sans avoir besoin d'une vraie resynchronisation.
  useEffect(() => {
    const t = setInterval(() => setSyncTick((v) => v + 1), 20000);
    return () => clearInterval(t);
  }, []);

  // Ouverture d'une fiche par lecteur de code-barres : une douchette USB
  // "tape" les chiffres du code très rapidement puis envoie Entrée. On
  // détecte cette frappe rafale (peu importe le champ actif) et on ouvre
  // directement la fiche correspondante si le code EAN-14 est reconnu.
  useEffect(() => {
    if (view !== "list") return;
    let buffer = "";
    let lastTime = 0;
    const handler = (e) => {
      const now = Date.now();
      if (now - lastTime > 300) buffer = "";
      lastTime = now;
      if (e.key === "Enter") {
        const code = buffer.trim();
        buffer = "";
        if (/^\d{14}$/.test(code)) {
          const match = tickets.find((t) => t.ean14 === code);
          if (match) {
            e.preventDefault();
            openEdit(match);
          } else {
            setError(`Aucune fiche ne correspond au code scanné (${code}).`);
          }
        }
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, tickets]);

  const filtered = useMemo(() => {
    let list;
    if (statutFilter === "Archivées") {
      // Les fiches archivées sont classées par ordre alphabétique du nom
      // du client, et non par date comme le reste de la liste.
      list = tickets
        .filter((t) => t.archived)
        .slice()
        .sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr", { sensitivity: "base" }));
    } else {
      list = tickets.filter((t) => !t.archived);
      if (statutFilter !== "Toutes") list = list.filter((t) => t.statut === statutFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((t) =>
        [t.nom, t.marqueModele, t.telephone, t.imei, t.numero].filter(Boolean).some((f) => f.toLowerCase().includes(q))
      );
    }
    return list;
  }, [tickets, search, statutFilter]);

  const counts = useMemo(() => {
    const active = tickets.filter((t) => !t.archived);
    const c = { Toutes: active.length };
    STATUTS.forEach((s) => (c[s] = active.filter((t) => t.statut === s).length));
    c["Archivées"] = tickets.filter((t) => t.archived).length;
    return c;
  }, [tickets]);

  const openNew = useCallback(async () => {
    const n = (await loadCounter()) + 1;
    const t = blankTicket();
    t.numero = buildNumero(n);
    t.ean14 = buildEan14(n);
    t._counterVal = n;
    setCurrent(t);
    setNomTouched(false);
    setTelephoneTouched(false);
    setView("edit");
  }, []);

  const openEdit = (ticket) => {
    setCurrent(JSON.parse(JSON.stringify(ticket)));
    setNomTouched(false);
    setTelephoneTouched(false);
    setView("edit");
  };

  const backToList = () => {
    setView("list");
    setCurrent(null);
    setNomTouched(false);
    setTelephoneTouched(false);
  };

  // Logique de sauvegarde partagée entre l'enregistrement manuel et la
  // sauvegarde automatique silencieuse. Ne dépend pas du state `current`
  // pour éviter les problèmes de fermeture obsolète (closure) dans
  // l'intervalle de sauvegarde automatique.
  const persistTicket = useCallback(async (ticketData) => {
    const isNew = !ticketData.id;
    const id = ticketData.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const toSave = { ...ticketData, id, updatedAt: now, createdAt: ticketData.createdAt || now };
    // Horodate le passage au statut "Restitué" (point de départ du délai
    // de 48h avant archivage automatique). Si le statut change à nouveau,
    // on annule l'archivage programmé.
    if (toSave.statut === "Restitué") {
      if (!toSave.restituedAt) toSave.restituedAt = now;
    } else {
      toSave.restituedAt = null;
      toSave.archived = false;
      toSave.archivedAt = null;
    }
    delete toSave._counterVal;
    await window.storage.set(`sav:ticket:${id}`, JSON.stringify(toSave));
    if (isNew && ticketData._counterVal) {
      await window.storage.set("sav:counter", String(ticketData._counterVal));
    }
    setTickets((prev) => {
      const others = prev.filter((t) => t.id !== id);
      return [toSave, ...others].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    });
    return toSave;
  }, []);

  const saveTicket = async () => {
    if (!current) return;
    if (!current.nom.trim()) {
      setNomTouched(true);
      setError("Le nom du client est requis.");
      return;
    }
    if (!current.telephone.trim()) {
      setTelephoneTouched(true);
      setError("Le téléphone du client est requis.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await persistTicket(current);
      backToList();
    } catch (e) {
      setError("Échec de l'enregistrement. Réessayez.");
    }
    setSaving(false);
  };

  // Sauvegarde automatique silencieuse toutes les 20 secondes pendant
  // l'édition d'une fiche — uniquement si les champs obligatoires (Nom,
  // Téléphone) sont remplis. Sinon, ne rien faire (pas d'enregistrement,
  // pas d'erreur affichée).
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    if (view !== "edit") return;
    const interval = setInterval(async () => {
      const c = currentRef.current;
      if (!c) return;
      const nomOk = c.nom && c.nom.trim();
      const telOk = c.telephone && c.telephone.trim();
      if (!nomOk || !telOk) return; // champs obligatoires manquants : on ne fait rien
      try {
        const saved = await persistTicket(c);
        // Si c'était une nouvelle fiche (pas encore d'id), on reporte l'id
        // généré sur `current` pour que les sauvegardes suivantes mettent
        // à jour la même fiche au lieu d'en créer une nouvelle à chaque fois.
        if (!c.id) {
          setCurrent((prevCur) =>
            prevCur && !prevCur.id ? { ...prevCur, id: saved.id, createdAt: saved.createdAt } : prevCur
          );
        }
      } catch {
        // Sauvegarde automatique silencieuse : on ignore l'échec ici,
        // l'enregistrement manuel restera disponible et affichera l'erreur.
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [view, persistTicket]);

  const deleteTicket = async (id) => {
    try {
      await window.storage.delete(`sav:ticket:${id}`);
      setTickets((prev) => prev.filter((t) => t.id !== id));
      setConfirmDelete(null);
      if (current && current.id === id) backToList();
    } catch (e) {
      setError("Échec de la suppression. Réessayez.");
    }
  };

  const unarchiveTicket = async (ticket) => {
    try {
      const now = Date.now();
      // Réinitialise le délai de 48h : la fiche ne se ré-archivera pas
      // immédiatement, mais reprendra le compte à rebours si elle reste
      // au statut "Restitué".
      const updated = { ...ticket, archived: false, archivedAt: null, restituedAt: now };
      await window.storage.set(`sav:ticket:${ticket.id}`, JSON.stringify(updated));
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? updated : t)));
      if (current && current.id === ticket.id) setCurrent(updated);
    } catch (e) {
      setError("Échec de la désarchivation. Réessayez.");
    }
  };

  const update = (patch) => setCurrent((c) => ({ ...c, ...patch }));
  const updateAcc = (patch) => setCurrent((c) => ({ ...c, accessoires: { ...c.accessoires, ...patch } }));
  const nomInvalid = nomTouched && current && !current.nom.trim();
  const telephoneInvalid = telephoneTouched && current && !current.telephone.trim();
  const cycleCheck = (key) => {
    setCurrent((c) => {
      const cur = c.checkup[key];
      const next = cur === undefined ? "OK" : cur === "OK" ? "KO" : undefined;
      const checkup = { ...c.checkup };
      if (next === undefined) delete checkup[key];
      else checkup[key] = next;
      return { ...c, checkup };
    });
  };

  const cycleTache = (key) => {
    setCurrent((c) => {
      const cur = c.taches[key];
      const next = cur === undefined ? "à faire" : cur === "à faire" ? "OK" : undefined;
      const taches = { ...c.taches };
      if (next === undefined) delete taches[key];
      else taches[key] = next;
      return { ...c, taches };
    });
  };

  const doPrint = async (ticket) => {
    try {
      await generateTicketPDF(ticket);
    } catch (e) {
      console.error("Erreur génération PDF :", e);
      setError(`Échec de la génération du PDF : ${e.message || e}`);
    }
  };

  const doPrintLabel = (ticket) => {
    setCurrent(ticket);
    setPrintMode("label");
    setTimeout(() => window.print(), 60);
  };

  const applyLabelPreset = (id) => {
    setLabelPreset(id);
    const preset = LABEL_PRESETS.find((p) => p.id === id);
    if (preset && preset.w) {
      const size = { w: preset.w, h: preset.h };
      setLabelSize(size);
      window.storage.set("sav:labelsize", JSON.stringify({ ...size, preset: id })).catch(() => {});
    }
  };

  const applyCustomLabelSize = (dims) => {
    setLabelSize(dims);
    window.storage.set("sav:labelsize", JSON.stringify({ ...dims, preset: "custom" })).catch(() => {});
  };

  return (
    <div className="sav-root">
      <style>{`
        .sav-root { --graphite-950:#14171B; --graphite-900:#1D2126; --graphite-800:#262B32; --graphite-700:#2F353D; --line:#383F48; --amber:#E8A33D; --amber-dim:#C98A2E; --teal:#4FB08A; --red:#E2604F; --text:#EDEFF2; --text-muted:#8B93A1; font-family:'IBM Plex Sans',-apple-system,sans-serif; background:var(--graphite-950); color:var(--text); min-height:100vh; max-width:980px; margin:0 auto; }
        .sav-root * { box-sizing:border-box; }
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .sav-mono { font-family:'IBM Plex Mono',monospace; }
        .sav-display { font-family:'Oswald',sans-serif; text-transform:uppercase; letter-spacing:0.03em; }
        .sav-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:20px 24px; border-bottom:1px solid var(--line); flex-wrap:wrap; }
        .sav-brand { display:flex; align-items:center; gap:10px; }
        .sav-brand .dot { width:10px; height:10px; border-radius:50%; background:var(--amber); }
        .sav-brand h1 { font-size:19px; font-weight:600; margin:0; }
        .sav-brand p { font-size:12px; color:var(--text-muted); margin:2px 0 0; }
        .sav-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 16px; border-radius:8px; border:1px solid var(--line); background:var(--graphite-800); color:var(--text); font-size:13px; font-weight:500; cursor:pointer; transition:background 0.15s, border-color 0.15s; }
        .sav-btn:hover { background:var(--graphite-700); border-color:#4A525C; }
        .sav-btn.primary { background:var(--amber); border-color:var(--amber); color:#2A1B04; }
        .sav-btn.primary:hover { background:#F0AF4E; }
        .sav-btn.danger { background:transparent; border-color:var(--red); color:var(--red); }
        .sav-btn.danger:hover { background:rgba(226,96,79,0.12); }
        .sav-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .sav-header-right { display:flex; align-items:center; gap:14px; }
        .sav-header-barcode { display:flex; flex-direction:column; align-items:center; gap:3px; background:#fff; padding:6px 10px; border-radius:6px; }
        .sav-header-barcode span { font-size:9px; color:#000; letter-spacing:0.06em; }
        .sav-sync { display:flex; align-items:center; gap:7px; font-size:12px; color:var(--text-muted); white-space:nowrap; }
        .sav-sync-dot { width:7px; height:7px; border-radius:50%; background:var(--teal); flex-shrink:0; }
        .sav-sync-dot.spinning { background:var(--amber); animation:sav-pulse 0.9s ease-in-out infinite; }
        @keyframes sav-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.7); } }
        .sav-toolbar { display:flex; align-items:center; gap:10px; padding:16px 24px; flex-wrap:wrap; border-bottom:1px solid var(--line); }
        .sav-search { flex:1; min-width:180px; display:flex; align-items:center; gap:8px; background:var(--graphite-900); border:1px solid var(--line); border-radius:8px; padding:8px 12px; }
        .sav-search input { flex:1; background:transparent; border:none; outline:none; color:var(--text); font-size:13px; }
        .sav-search input::placeholder { color:var(--text-muted); }
        .sav-tabs { display:flex; gap:6px; flex-wrap:wrap; }
        .sav-archive-hint { padding:8px 24px; font-size:11.5px; color:var(--text-muted); background:var(--graphite-900); border-bottom:1px solid var(--line); }
        .sav-tab { padding:7px 12px; border-radius:6px; font-size:12px; font-weight:500; cursor:pointer; border:1px solid transparent; color:var(--text-muted); white-space:nowrap; }
        .sav-tab.active { background:var(--graphite-800); border-color:var(--line); color:var(--text); }
        .sav-tab .n { opacity:0.6; margin-left:4px; }
        .sav-body { padding:20px 24px; min-height:200px; }
        .sav-empty { text-align:center; padding:60px 20px; color:var(--text-muted); }
        .sav-empty .ic { font-size:32px; margin-bottom:10px; opacity:0.5; }
        .sav-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:14px; }
        .sav-card { position:relative; background:var(--graphite-900); border:1px solid var(--line); border-radius:10px; padding:16px 16px 14px; cursor:pointer; transition:border-color 0.15s, transform 0.1s; overflow:hidden; }
        .sav-card:hover { border-color:#4A525C; transform:translateY(-1px); }
        .sav-card .notch { position:absolute; top:-8px; left:18px; width:16px; height:16px; border-radius:50%; background:var(--graphite-950); border:1px solid var(--line); }
        .sav-card-tag-btn { position:absolute; top:12px; right:12px; width:26px; height:26px; border-radius:6px; border:1px solid var(--line); background:var(--graphite-800); color:var(--text-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; }
        .sav-card-tag-btn:hover { color:var(--amber); border-color:var(--amber); }
        .sav-card-del-btn { right:44px; }
        .sav-card-del-btn:hover { color:var(--red); border-color:var(--red); }
        .sav-card-unarchive-btn { right:76px; }
        .sav-card-unarchive-btn:hover { color:var(--teal); border-color:var(--teal); }
        .sav-card .stripe { position:absolute; top:0; right:0; bottom:0; width:5px; border-radius:0; }
        .sav-card .num { font-size:11px; color:var(--text-muted); margin:6px 92px 8px 0; }
        .sav-card .nom { font-size:15px; font-weight:600; margin:0 0 4px; }
        .sav-card .modele { font-size:12.5px; color:var(--text-muted); display:flex; align-items:center; gap:5px; margin-bottom:10px; }
        .sav-card .foot { display:flex; align-items:center; justify-content:space-between; margin-top:10px; padding-top:10px; border-top:1px solid var(--line); }
        .sav-badge { font-size:10.5px; font-weight:600; padding:3px 8px; border-radius:5px; text-transform:uppercase; letter-spacing:0.02em; }
        .sav-card .date { font-size:11px; color:var(--text-muted); }
        .sav-form-section { background:var(--graphite-900); border:1px solid var(--line); border-radius:10px; padding:18px 20px; margin-bottom:14px; }
        .sav-form-section h3 { font-size:12px; text-transform:uppercase; letter-spacing:0.06em; color:var(--amber); margin:0 0 14px; font-weight:600; }
        .sav-field-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:12px; }
        .sav-field-row:last-child { margin-bottom:0; }
        .sav-field label { display:block; font-size:11.5px; color:var(--text-muted); margin-bottom:5px; }
        .sav-field input, .sav-field select, .sav-field textarea { width:100%; background:var(--graphite-800); border:1px solid var(--line); border-radius:7px; padding:9px 10px; color:var(--text); font-size:13.5px; outline:none; font-family:inherit; }
        .sav-field input:focus, .sav-field select:focus, .sav-field textarea:focus { border-color:var(--amber); }
        .sav-field textarea { resize:vertical; min-height:60px; }
        .sav-checks { display:flex; flex-wrap:wrap; gap:14px; }
        .sav-check { display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; color:var(--text); }
        .sav-check input { accent-color:var(--amber); width:15px; height:15px; }
        .sav-etats { display:flex; flex-wrap:wrap; gap:8px; }
        .sav-etat-pill { padding:7px 14px; border-radius:20px; font-size:12.5px; font-weight:500; cursor:pointer; border:1px solid var(--line); background:var(--graphite-800); color:var(--text-muted); }
        .sav-etat-pill.sel { color:#14171B; border-color:transparent; }
        .sav-ck-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:8px; }
        .sav-schema-tasks-row { display:flex; gap:28px; flex-wrap:wrap; align-items:flex-start; margin-top:6px; }
        .sav-schema-col { flex:0 0 auto; }
        .sav-tasks-col { flex:1 1 280px; min-width:240px; }
        .sav-switch-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(118px,1fr)); gap:6px; }
        .sav-switch-item { display:flex; align-items:center; justify-content:space-between; gap:6px; background:var(--graphite-800); border:1px solid var(--line); border-radius:7px; padding:6px 8px 6px 10px; cursor:pointer; user-select:none; }
        .sav-switch-item .lbl { font-size:11px; line-height:1.2; }
        .sav-switch-badge { font-size:9.5px; font-weight:700; padding:2px 6px; border-radius:5px; min-width:38px; text-align:center; white-space:nowrap; flex-shrink:0; }
        .sav-tasks-detail-input { margin-top:8px; width:100%; background:var(--graphite-800); border:1px solid var(--line); border-radius:7px; padding:8px 10px; color:var(--text); font-size:13px; font-family:inherit; }
        .sav-tasks-columns-wrap { display:flex; gap:10px; align-items:flex-start; }
        .sav-tasks-columns-wrap .sav-switch-grid { flex:1; }
        .sav-switch-column { display:flex; flex-direction:column; gap:6px; flex:0 0 150px; }
        .sav-ck-item { display:flex; align-items:center; justify-content:space-between; background:var(--graphite-800); border:1px solid var(--line); border-radius:7px; padding:8px 10px 8px 12px; cursor:pointer; user-select:none; }
        .sav-ck-item span.lbl { font-size:12.5px; }
        .sav-ck-status { font-size:10.5px; font-weight:700; padding:3px 8px; border-radius:5px; min-width:34px; text-align:center; }
        .sav-actions-bar { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:16px 24px; border-top:1px solid var(--line); flex-wrap:wrap; }
        .sav-actions-left, .sav-actions-right { display:flex; gap:8px; flex-wrap:wrap; }
        .sav-error { display:flex; align-items:center; gap:8px; background:rgba(226,96,79,0.12); border:1px solid var(--red); color:#F5B8B0; padding:10px 14px; border-radius:8px; font-size:13px; margin:0 24px 12px; }
        .sav-confirm { position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:50; border-radius:14px; }
        .sav-confirm-box { background:var(--graphite-900); border:1px solid var(--line); border-radius:12px; padding:20px 22px; max-width:320px; }
        .sav-confirm-box p { font-size:14px; margin:0 0 16px; }
        .sav-confirm-box .row { display:flex; gap:8px; justify-content:flex-end; }
        .sav-loading { display:flex; align-items:center; justify-content:center; gap:8px; padding:60px; color:var(--text-muted); }
        .sav-spin { animation:sav-spin 0.8s linear infinite; }
        @keyframes sav-spin { to { transform:rotate(360deg); } }
        .sav-footnote { padding:12px 24px; font-size:11px; color:var(--text-muted); border-top:1px solid var(--line); }
        .sav-legal-footer p { margin:0 0 4px; font-size:10.5px; font-style:italic; line-height:1.4; }
        .sav-credit { margin:8px 0 0; padding-top:8px; border-top:1px solid var(--line); font-size:10px; color:var(--text-muted); }
        .sav-print-only { display:none; }
        .sav-label-controls { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .sav-label-controls select { background:var(--graphite-800); border:1px solid var(--line); border-radius:7px; padding:8px 10px; color:var(--text); font-size:12.5px; }
        .sav-label-controls input[type=number] { width:64px; background:var(--graphite-800); border:1px solid var(--line); border-radius:7px; padding:8px 8px; color:var(--text); font-size:12.5px; }
        @media print {
          .sav-root > *:not(.sav-print-sheet):not(.sav-print-label) { display:none !important; }
          .sav-print-sheet { display:block !important; background:transparent; color:#000; padding:14mm; page:ticket; }
          .sav-print-sheet h2 { font-size:18px; margin:0 0 4px; }
          .sav-print-sheet .psheet-barcode { display:flex; flex-direction:column; align-items:center; margin-bottom:10px; }
          .sav-print-sheet .psheet-ean-digits { font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:0.08em; margin-top:2px; color:#000; }
          .sav-print-sheet .pgrid { display:grid; grid-template-columns:1fr 1fr; gap:6px 24px; font-size:13px; margin:14px 0; }
          .sav-print-sheet .pgrid div span.k { color:#000; font-weight:600; display:inline-block; min-width:140px; }
          .sav-print-sheet .pck { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; font-size:12px; margin-top:10px; }
          .sav-print-sheet .pfooter { margin-top:14px; padding-top:8px; border-top:1px solid #000; }
          .sav-print-sheet .pfooter p { font-size:8.5px; font-style:italic; color:#000; margin:0 0 3px; line-height:1.3; }
          .sav-print-label { display:flex !important; page:label; width:100%; height:100%; background:#fff; color:#111; box-sizing:border-box; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:1.2mm; overflow:hidden; }
          .sav-print-label .lbl-num { font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:12pt; letter-spacing:0.02em; line-height:1.1; max-width:100%; white-space:nowrap; }
          .sav-print-label .lbl-date { font-family:'IBM Plex Mono',monospace; font-size:6.5pt; color:#333; margin-top:0.4mm; line-height:1; }
          .sav-print-label .lbl-nom { font-size:8pt; margin-top:0.8mm; font-weight:600; line-height:1.1; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
          .sav-print-label .lbl-modele { font-size:7pt; color:#333; margin-top:0.3mm; line-height:1.1; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
          .sav-print-label .lbl-barcode { margin-top:1mm; display:flex; flex-direction:column; align-items:center; }
          .sav-print-label .lbl-ean-digits { font-family:'IBM Plex Mono',monospace; font-size:5.5pt; letter-spacing:0.05em; margin-top:0.4mm; line-height:1; }
        }
        @page ticket { size:176mm 250mm; margin:0; }
        @page label { size:${labelSize.w}mm ${labelSize.h}mm; margin:2mm; }
      `}</style>

      {error && (
        <div className="sav-error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {view === "list" && (
        <>
          <div className="sav-header">
            <div className="sav-brand">
              <span className="dot" />
              <div>
                <h1 className="sav-display">Atelier — Prise en charge</h1>
                <p>{tickets.length} fiche{tickets.length !== 1 ? "s" : ""} enregistrée{tickets.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="sav-header-right">
              <div className="sav-sync" title="Les fiches se resynchronisent automatiquement toutes les 8 secondes">
                <span className={`sav-sync-dot ${syncing ? "spinning" : ""}`} />
                {syncing ? "Synchronisation..." : `Synchronisé ${formatAgo(lastSync)}`}
              </div>
              <button className="sav-btn primary" onClick={openNew}>
                <Plus size={16} /> Nouvelle fiche
              </button>
            </div>
          </div>

          <div className="sav-toolbar">
            <div className="sav-search">
              <Search size={15} color="var(--text-muted)" />
              <input placeholder="Rechercher un nom, un modèle, un IMEI..." value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && (
                <X size={14} style={{ cursor: "pointer", color: "var(--text-muted)" }} onClick={() => setSearch("")} />
              )}
            </div>
            <div className="sav-tabs">
              {["Toutes", ...STATUTS, "Archivées"].map((s) => (
                <div key={s} className={`sav-tab ${statutFilter === s ? "active" : ""}`} onClick={() => setStatutFilter(s)}>
                  {s} <span className="n">{counts[s] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {statutFilter === "Archivées" && (
            <div className="sav-archive-hint">
              Fiches restituées, archivées automatiquement 48h après restitution — classées par ordre alphabétique.
            </div>
          )}

          <div className="sav-body">
            {loading ? (
              <div className="sav-loading">
                <Loader2 size={18} className="sav-spin" /> Chargement des fiches...
              </div>
            ) : filtered.length === 0 ? (
              <div className="sav-empty">
                <div className="ic"><Smartphone size={32} /></div>
                {tickets.length === 0 ? (
                  <>
                    <p style={{ marginBottom: 6 }}>Aucune fiche pour l'instant.</p>
                    <p style={{ fontSize: 12.5 }}>Créez la première prise en charge avec le bouton ci-dessus.</p>
                  </>
                ) : (
                  <p>Aucune fiche ne correspond à cette recherche.</p>
                )}
              </div>
            ) : (
              <div className="sav-grid">
                {filtered.map((t) => (
                  <div key={t.id} className="sav-card" onClick={() => openEdit(t)}>
                    <div className="notch" />
                    <div className="stripe" style={{ background: ETAT_COLOR[t.etat] || "var(--line)" }} />
                    <button
                      className="sav-card-tag-btn"
                      title="Imprimer l'étiquette"
                      onClick={(e) => {
                        e.stopPropagation();
                        doPrintLabel(t);
                      }}
                    >
                      <Tag size={13} />
                    </button>
                    <button
                      className="sav-card-tag-btn sav-card-del-btn"
                      title="Supprimer la fiche"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(t.id);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                    {t.archived && (
                      <button
                        className="sav-card-tag-btn sav-card-unarchive-btn"
                        title="Désarchiver la fiche"
                        onClick={(e) => {
                          e.stopPropagation();
                          unarchiveTicket(t);
                        }}
                      >
                        <ArchiveRestore size={13} />
                      </button>
                    )}
                    <div className="num sav-mono">{t.numero}</div>
                    <div className="nom">{t.nom || "Sans nom"}</div>
                    <div className="modele"><Smartphone size={13} /> {t.marqueModele || "Modèle non précisé"}</div>
                    <div className="foot">
                      <span
                        className="sav-badge"
                        style={{
                          background: "var(--graphite-800)",
                          color: STATUT_COLOR[t.statut] || "var(--text-muted)",
                        }}
                      >
                        {t.statut}
                      </span>
                      <span className="date">{formatDate(t.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sav-footnote">
            <p style={{ margin: "0 0 8px" }}>Les fiches sont enregistrées dans votre compte et visibles uniquement par vous.</p>
            <div className="sav-legal-footer">
              <p><strong>Devis et prise en charge :</strong> le montant du devis ou des frais de prise en charge sera déduit du montant total de la réparation si celle-ci est effectuée par nos soins.</p>
              <p><strong>Données personnelles :</strong> nous déclinons toute responsabilité en cas de perte, d'altération ou d'inaccessibilité des données présentes sur l'appareil. Le client est invité à effectuer, dans la mesure du possible, une sauvegarde complète de ses données sur un support externe avant tout dépôt ou envoi de matériel.</p>
              <p><strong>Éléments endommagés :</strong> lors du démontage, des éléments préalablement fragilisés, usés ou endommagés peuvent être découverts. Nous ne saurions être tenus responsables des dommages ou dysfonctionnements résultant de cet état préexistant. Toute réparation supplémentaire rendue nécessaire fera l'objet d'un devis complémentaire avant intervention.</p>
              <p><strong>Imprimantes et consommables compatibles :</strong> en cas d'utilisation de consommables compatibles, un jeu de consommables d'origine pourra être installé afin d'effectuer les tests et/ou le diagnostic de l'imprimante. Le coût de ces consommables reste entièrement à la charge du client, quel que soit le résultat des tests ou de la réparation.</p>
            </div>
            <p className="sav-credit">Créé par Serge Mata avec Claude AI — V: {getBuildVersion()}</p>
          </div>
        </>
      )}

      {view === "edit" && current && (
        <>
          <div className="sav-header">
            <div className="sav-brand">
              <button className="sav-btn" onClick={backToList} style={{ padding: "8px 10px" }}>
                <ArrowLeft size={16} />
              </button>
              <div>
                <h1 className="sav-display" style={{ fontSize: 16 }}>{current.id ? "Modifier la fiche" : "Nouvelle fiche"}</h1>
                <p className="sav-mono">{current.numero}</p>
              </div>
            </div>
            {current.ean14 && (
              <div className="sav-header-barcode" title={`Code EAN-14 : ${current.ean14}`}>
                <Barcode digits={current.ean14} widthMm={34} heightMm={8} />
                <span className="sav-mono">{current.ean14}</span>
              </div>
            )}
          </div>

          <div className="sav-body">
            <div className="sav-form-section">
              <h3>Informations client</h3>
              <div className="sav-field-row">
                <div className="sav-field">
                  <label>Nom <span style={{ color: "var(--red)" }}>*</span></label>
                  <input
                    value={current.nom}
                    onChange={(e) => update({ nom: e.target.value })}
                    onBlur={() => setNomTouched(true)}
                    placeholder="Nom du client"
                    required
                    style={nomInvalid ? { borderColor: "var(--red)" } : undefined}
                  />
                  {nomInvalid && (
                    <span style={{ display: "block", marginTop: 4, fontSize: 11, color: "var(--red)" }}>
                      Le nom est obligatoire.
                    </span>
                  )}
                </div>
                <div className="sav-field">
                  <label>Téléphone <span style={{ color: "var(--red)" }}>*</span></label>
                  <input
                    value={current.telephone}
                    onChange={(e) => update({ telephone: e.target.value })}
                    onBlur={() => setTelephoneTouched(true)}
                    placeholder="06 12 34 56 78"
                    required
                    style={telephoneInvalid ? { borderColor: "var(--red)" } : undefined}
                  />
                  {telephoneInvalid && (
                    <span style={{ display: "block", marginTop: 4, fontSize: 11, color: "var(--red)" }}>
                      Le téléphone est obligatoire.
                    </span>
                  )}
                </div>
                <div className="sav-field">
                  <label>Email</label>
                  <input value={current.email} onChange={(e) => update({ email: e.target.value })} placeholder="client@email.com" />
                </div>
              </div>
              <div className="sav-field-row">
                <div className="sav-field">
                  <label><Lock size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Mot de passe</label>
                  <input value={current.motDePasse} onChange={(e) => update({ motDePasse: e.target.value })} placeholder="Mot de passe appareil" />
                </div>
                <div className="sav-field">
                  <label><Lock size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Code déverrouillage</label>
                  <input value={current.codeDeverrouillage} onChange={(e) => update({ codeDeverrouillage: e.target.value })} placeholder="Code PIN, si applicable" />
                </div>
                <div className="sav-field">
                  <label>Statut</label>
                  <select value={current.statut} onChange={(e) => update({ statut: e.target.value })}>
                    {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="sav-schema-tasks-row">
                <div className="sav-schema-col">
                  <label style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8 }}>
                    Schéma de déverrouillage (facultatif) — cliquez les points dans l'ordre
                  </label>
                  <PatternLock value={current.schema} onChange={(schema) => update({ schema })} />
                </div>
                <div className="sav-tasks-col">
                  <label style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8 }}>
                    Interventions à prévoir
                  </label>
                  <div className="sav-tasks-columns-wrap">
                    <div className="sav-switch-grid">
                      {MAIN_TASK_ITEMS.map((t) => {
                        const state = current.taches[t.key];
                        return (
                          <div key={t.key} className="sav-switch-item" onClick={() => cycleTache(t.key)}>
                            <span className="lbl">{t.label}</span>
                            <span
                              className="sav-switch-badge"
                              style={{
                                background: state === "OK" ? "rgba(79,176,138,0.18)" : state === "à faire" ? "rgba(232,163,61,0.18)" : "var(--graphite-700)",
                                color: state === "OK" ? "var(--teal)" : state === "à faire" ? "var(--amber)" : "var(--text-muted)",
                              }}
                            >
                              {state || "-"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="sav-switch-column">
                      {RIGHT_COL_TASK_ITEMS.map((t) => {
                        const state = current.taches[t.key];
                        return (
                          <div key={t.key} className="sav-switch-item" onClick={() => cycleTache(t.key)}>
                            <span className="lbl">{t.label}</span>
                            <span
                              className="sav-switch-badge"
                              style={{
                                background: state === "OK" ? "rgba(79,176,138,0.18)" : state === "à faire" ? "rgba(232,163,61,0.18)" : "var(--graphite-700)",
                                color: state === "OK" ? "var(--teal)" : state === "à faire" ? "var(--amber)" : "var(--text-muted)",
                              }}
                            >
                              {state || "-"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {current.taches.installOs && (
                    <input
                      className="sav-tasks-detail-input"
                      value={current.installOsDetail}
                      onChange={(e) => update({ installOsDetail: e.target.value })}
                      placeholder="Préciser l'intervention Install Os"
                    />
                  )}
                  {current.taches.imprimante && (
                    <input
                      className="sav-tasks-detail-input"
                      value={current.imprimanteDetail}
                      onChange={(e) => update({ imprimanteDetail: e.target.value })}
                      placeholder="Préciser l'intervention imprimante"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="sav-form-section">
              <h3>Appareil</h3>
              <div className="sav-field-row">
                <div className="sav-field">
                  <label>Marque / modèle</label>
                  <input value={current.marqueModele} onChange={(e) => update({ marqueModele: e.target.value })} placeholder="iPhone 13, Dell XPS..." />
                </div>
                <div className="sav-field">
                  <label>N° IMEI / Série</label>
                  <input className="sav-mono" value={current.imei} onChange={(e) => update({ imei: e.target.value })} placeholder="IMEI ou n° série" />
                </div>
              </div>
              <div className="sav-field">
                <label>Panne constatée</label>
                <textarea value={current.panne} onChange={(e) => update({ panne: e.target.value })} placeholder="Description de la panne" />
              </div>
              <div className="sav-field">
                <label>Diagnostic / Intervention</label>
                <textarea
                  value={current.diagnostic}
                  onChange={(e) => update({ diagnostic: e.target.value })}
                  placeholder="Diagnostic posé et intervention réalisée"
                  style={{ color: "#FF0000" }}
                />
              </div>
            </div>

            <div className="sav-form-section">
              <h3>Accessoires laissés</h3>
              <div className="sav-checks">
                {ACCESSOIRES.map((a) => (
                  <label key={a.key} className="sav-check">
                    <input type="checkbox" checked={!!current.accessoires[a.key]} onChange={(e) => updateAcc({ [a.key]: e.target.checked })} />
                    {a.label}
                  </label>
                ))}
                <label className="sav-check">
                  <input type="checkbox" checked={!!current.accessoires.autres} onChange={(e) => updateAcc({ autres: e.target.checked })} />
                  Autres
                </label>
                {current.accessoires.autres && (
                  <input
                    style={{ maxWidth: 200, background: "var(--graphite-800)", border: "1px solid var(--line)", borderRadius: 7, padding: "6px 10px", color: "var(--text)", fontSize: 13 }}
                    value={current.accessoires.autresTexte}
                    onChange={(e) => updateAcc({ autresTexte: e.target.value })}
                    placeholder="Préciser"
                  />
                )}
              </div>
            </div>

            <div className="sav-form-section">
              <h3>État du matériel</h3>
              <div className="sav-etats">
                {ETATS.map((e) => (
                  <div
                    key={e}
                    className={`sav-etat-pill ${current.etat === e ? "sel" : ""}`}
                    style={current.etat === e ? { background: ETAT_COLOR[e], borderColor: ETAT_COLOR[e] } : {}}
                    onClick={() => update({ etat: e })}
                  >
                    {e}
                  </div>
                ))}
              </div>
              {current.etat === "Autres" && (
                <input
                  style={{ marginTop: 10, maxWidth: 260, background: "var(--graphite-800)", border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px", color: "var(--text)", fontSize: 13 }}
                  value={current.etatAutresTexte}
                  onChange={(e) => update({ etatAutresTexte: e.target.value })}
                  placeholder="Préciser l'état"
                />
              )}
            </div>

            <div className="sav-form-section">
              <h3>Check-up SAV</h3>
              <div className="sav-ck-grid">
                {CHECKUP_ITEMS.map((c) => {
                  const st = current.checkup[c.key];
                  return (
                    <div key={c.key} className="sav-ck-item" onClick={() => cycleCheck(c.key)}>
                      <span className="lbl">{c.label}</span>
                      <span
                        className="sav-ck-status"
                        style={{
                          background: st === "OK" ? "rgba(79,176,138,0.18)" : st === "KO" ? "rgba(226,96,79,0.18)" : "var(--graphite-700)",
                          color: st === "OK" ? "var(--teal)" : st === "KO" ? "var(--red)" : "var(--text-muted)",
                        }}
                      >
                        {st || "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="sav-form-section">
              <h3>Tarification</h3>
              <div className="sav-field-row">
                <div className="sav-field">
                  <label>Total (€)</label>
                  <input value={current.total} onChange={(e) => update({ total: e.target.value })} placeholder="0.00" />
                </div>
                <div className="sav-field">
                  <label>Prise en charge à déduire (€)</label>
                  <input value={current.priseEnCharge} onChange={(e) => update({ priseEnCharge: e.target.value })} placeholder="0.00" />
                </div>
              </div>
            </div>

            <div className="sav-form-section">
              <h3>Remarque précision</h3>
              <div className="sav-field">
                <label>Remarque précision</label>
                <textarea value={current.remarque} onChange={(e) => update({ remarque: e.target.value })} placeholder="Remarque additionnelle" />
              </div>
            </div>
          </div>

          <div className="sav-actions-bar">
            <div className="sav-actions-left">
              {current.id && (
                <button className="sav-btn danger" onClick={() => setConfirmDelete(current.id)}>
                  <Trash2 size={15} /> Supprimer
                </button>
              )}
              <button className="sav-btn" onClick={() => doPrint(current)} title="Télécharge un fichier PDF de la fiche">
                <Printer size={15} /> Imprimer (PDF)
              </button>
              <button className="sav-btn" onClick={() => doPrintLabel(current)}>
                <Tag size={15} /> Étiquette
              </button>
              {current.archived && (
                <button className="sav-btn" onClick={() => unarchiveTicket(current)} title="Retire la fiche des archives">
                  <ArchiveRestore size={15} /> Désarchiver
                </button>
              )}
              <div className="sav-label-controls">
                <select value={labelPreset} onChange={(e) => applyLabelPreset(e.target.value)}>
                  {LABEL_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                {labelPreset === "custom" && (
                  <>
                    <input
                      type="number"
                      min="20"
                      max="150"
                      value={labelSize.w}
                      onChange={(e) => applyCustomLabelSize({ ...labelSize, w: parseInt(e.target.value, 10) || labelSize.w })}
                    />
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>×</span>
                    <input
                      type="number"
                      min="15"
                      max="150"
                      value={labelSize.h}
                      onChange={(e) => applyCustomLabelSize({ ...labelSize, h: parseInt(e.target.value, 10) || labelSize.h })}
                    />
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>mm</span>
                  </>
                )}
              </div>
            </div>
            <div className="sav-actions-right">
              <button className="sav-btn" onClick={backToList}>Annuler</button>
              <button className="sav-btn primary" onClick={saveTicket} disabled={saving || !current.nom.trim() || !current.telephone.trim()}>
                <Save size={15} /> {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </>
      )}

      {confirmDelete && (
        <div className="sav-confirm">
          <div className="sav-confirm-box">
            <p>Supprimer définitivement cette fiche ? Cette action est irréversible.</p>
            <div className="row">
              <button className="sav-btn" onClick={() => setConfirmDelete(null)}>Annuler</button>
              <button className="sav-btn danger" onClick={() => deleteTicket(confirmDelete)}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {current && printMode === "ticket" && (
        <div className="sav-print-sheet sav-print-only">
          {current.ean14 && (
            <div className="psheet-barcode">
              <Barcode digits={current.ean14} widthMm={55} heightMm={14} />
              <div className="psheet-ean-digits">{current.ean14}</div>
            </div>
          )}
          <h2>Fiche de prise en charge — {current.numero}</h2>
          <p style={{ fontSize: 12, color: "#000" }}>Date : {formatDate(current.createdAt || Date.now())}</p>
          <div className="pgrid">
            <div><span className="k">Nom</span>{current.nom}</div>
            <div><span className="k">Téléphone</span>{current.telephone}</div>
            {current.email && current.email.trim() && (
              <div><span className="k">Email</span>{current.email}</div>
            )}
            {current.motDePasse && current.motDePasse.trim() && (
              <div><span className="k">Mot de passe</span>{current.motDePasse}</div>
            )}
            {current.codeDeverrouillage && current.codeDeverrouillage.trim() && (
              <div><span className="k">Code déverrouillage</span>{current.codeDeverrouillage}</div>
            )}
            <div><span className="k">Marque / modèle</span>{current.marqueModele}</div>
            <div><span className="k">N° IMEI / Série</span>{current.imei}</div>
            <div><span className="k">État du matériel</span>{current.etat}{current.etat === "Autres" ? ` (${current.etatAutresTexte})` : ""}</div>
            {current.total && String(current.total).trim() && (
              <div><span className="k">Total</span>{current.total}</div>
            )}
            {current.priseEnCharge && String(current.priseEnCharge).trim() && (
              <div><span className="k">Prise en charge à déduire</span>{current.priseEnCharge}</div>
            )}
          </div>
          {current.schema && current.schema.length > 0 && (
            <div style={{ margin: "10px 0" }}>
              <span style={{ color: "#000", fontSize: 13, fontWeight: 600 }}>Schéma de déverrouillage :</span>
              <div style={{ marginTop: 6 }}>
                <PatternLock value={current.schema} readOnly size={110} monochrome />
              </div>
            </div>
          )}
          {current.taches && Object.keys(current.taches).length > 0 && (
            <div style={{ margin: "12px 0" }}>
              <span style={{ color: "#000", fontSize: 13, fontWeight: 600 }}>Interventions à prévoir :</span>
              <div className="pck" style={{ marginTop: 6 }}>
                {TASK_ITEMS.map((t) => (
                  <div key={t.key}>{t.label} : {current.taches[t.key] || "-"}</div>
                ))}
              </div>
              {current.taches.installOs && current.installOsDetail && (
                <p style={{ fontSize: 12, fontStyle: "italic", margin: "6px 0 0" }}>
                  Install Os - précision : {current.installOsDetail}
                </p>
              )}
              {current.taches.imprimante && current.imprimanteDetail && (
                <p style={{ fontSize: 12, fontStyle: "italic", margin: "6px 0 0" }}>
                  Imprimante - précision : {current.imprimanteDetail}
                </p>
              )}
            </div>
          )}
          {current.panne && current.panne.trim() && (
            <div style={{ border: "1px solid #000", borderRadius: 4, padding: "8px 10px", margin: "10px 0" }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Panne constatée</div>
              <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}>{current.panne}</div>
            </div>
          )}
          {current.diagnostic && current.diagnostic.trim() && (
            <div style={{ border: "1px solid #000", borderRadius: 4, padding: "8px 10px", margin: "10px 0" }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Diagnostic / Intervention</div>
              <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}>{current.diagnostic}</div>
            </div>
          )}
          {(ACCESSOIRES.some((a) => current.accessoires[a.key]) || current.accessoires.autres) && (
            <p><span style={{ color: "#000", fontWeight: 600 }}>Accessoires : </span>
              {ACCESSOIRES.filter((a) => current.accessoires[a.key]).map((a) => a.label).join(", ")}
              {current.accessoires.autres ? `, Autres (${current.accessoires.autresTexte})` : ""}
            </p>
          )}
          {current.remarque && current.remarque.trim() && (
            <div style={{ border: "1px solid #000", borderRadius: 4, padding: "8px 10px", margin: "10px 0" }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Remarque précision</div>
              <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}>{current.remarque}</div>
            </div>
          )}
          {current.checkup && Object.keys(current.checkup).length > 0 && (
            <div className="pck">
              {CHECKUP_ITEMS.map((c) => (
                <div key={c.key}>{c.label} : {current.checkup[c.key] || "—"}</div>
              ))}
            </div>
          )}
          <div className="pfooter">
            <p><strong>Devis et prise en charge :</strong> le montant du devis ou des frais de prise en charge sera déduit du montant total de la réparation si celle-ci est effectuée par nos soins.</p>
            <p><strong>Données personnelles :</strong> nous déclinons toute responsabilité en cas de perte, d'altération ou d'inaccessibilité des données présentes sur l'appareil. Le client est invité à effectuer, dans la mesure du possible, une sauvegarde complète de ses données sur un support externe avant tout dépôt ou envoi de matériel.</p>
            <p><strong>Éléments endommagés :</strong> lors du démontage, des éléments préalablement fragilisés, usés ou endommagés peuvent être découverts. Nous ne saurions être tenus responsables des dommages ou dysfonctionnements résultant de cet état préexistant. Toute réparation supplémentaire rendue nécessaire fera l'objet d'un devis complémentaire avant intervention.</p>
            <p><strong>Imprimantes et consommables compatibles :</strong> en cas d'utilisation de consommables compatibles, un jeu de consommables d'origine pourra être installé afin d'effectuer les tests et/ou le diagnostic de l'imprimante. Le coût de ces consommables reste entièrement à la charge du client, quel que soit le résultat des tests ou de la réparation.</p>
          </div>
        </div>
      )}

      {current && printMode === "label" && (
        <div className="sav-print-label sav-print-only">
          {(() => {
            const { code, date } = splitNumeroForLabel(current.numero);
            return (
              <>
                <div className="lbl-num">{code}</div>
                {date && <div className="lbl-date">{date}</div>}
              </>
            );
          })()}
          <div className="lbl-nom">{current.nom || "Sans nom"}</div>
          <div className="lbl-modele">{current.marqueModele}</div>
          {current.ean14 && (
            <div className="lbl-barcode">
              <Barcode digits={current.ean14} widthMm={32} heightMm={7} />
              <div className="lbl-ean-digits">{current.ean14}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
