import express from "express";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import net from "net";
import { buildLabel, isAllowedPrinterIp } from "./escpos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const db = new Database(path.join(__dirname, "atelier-sav.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS storage (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

const app = express();
app.use(express.json({ limit: "5mb" }));

// Liste les clés (fiches) qui commencent par un préfixe donné
app.get("/api/storage", (req, res) => {
  const prefix = req.query.prefix || "";
  const rows = db.prepare("SELECT key FROM storage WHERE key LIKE ? ORDER BY key").all(prefix + "%");
  res.json({ keys: rows.map((r) => r.key) });
});

// Lit une fiche
app.get("/api/storage/:key", (req, res) => {
  const row = db.prepare("SELECT value FROM storage WHERE key = ?").get(req.params.key);
  if (!row) return res.status(404).json({ error: "not_found" });
  res.json({ key: req.params.key, value: row.value });
});

// Crée ou met à jour une fiche
app.put("/api/storage/:key", (req, res) => {
  const { value } = req.body || {};
  if (typeof value !== "string") return res.status(400).json({ error: "value_required" });
  db.prepare(
    "INSERT INTO storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(req.params.key, value);
  res.json({ key: req.params.key, value });
});

// Supprime une fiche
app.delete("/api/storage/:key", (req, res) => {
  db.prepare("DELETE FROM storage WHERE key = ?").run(req.params.key);
  res.json({ deleted: true });
});

// Impression directe d'une étiquette POS80 : le serveur envoie les
// commandes ESC/POS à l'imprimante réseau (port TCP 9100, adresse du
// réseau local uniquement), coupe comprise.
app.post("/api/print", (req, res) => {
  const { ip, label } = req.body || {};
  if (!isAllowedPrinterIp(ip)) return res.status(400).json({ error: "ip_invalide" });
  if (!label || typeof label !== "object") return res.status(400).json({ error: "label_requis" });
  const data = buildLabel(label);
  let answered = false;
  const reply = (status, body) => {
    if (answered) return;
    answered = true;
    res.status(status).json(body);
  };
  const socket = net.createConnection({ host: String(ip).trim(), port: 9100 });
  socket.setTimeout(5000);
  socket.on("connect", () => socket.end(data));
  socket.on("close", (hadError) => { if (!hadError) reply(200, { ok: true }); });
  socket.on("timeout", () => { socket.destroy(); reply(504, { error: "imprimante_injoignable" }); });
  socket.on("error", () => reply(502, { error: "imprimante_injoignable" }));
});

// Sert l'application construite (npm run build) pour tous les autres chemins
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Atelier SAV — serveur démarré sur le port ${PORT}`);
});
