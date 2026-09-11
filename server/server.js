import express from "express";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

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
