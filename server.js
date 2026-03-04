const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const FILE = path.join(__dirname, 'scores.json');

app.use(express.json());
app.use(express.static(__dirname));

// ── PostgreSQL (pokud je DATABASE_URL nastavena) ──────────────
const USE_DB = !!process.env.DATABASE_URL;
let db;

if (USE_DB) {
  const { Pool } = require('pg');
  db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  // Vytvoření tabulky při startu
  db.query(`
    CREATE TABLE IF NOT EXISTS scores (
      id    SERIAL PRIMARY KEY,
      name  VARCHAR(20) NOT NULL,
      score INTEGER     NOT NULL
    )
  `).then(() => console.log('DB: tabulka scores připravena'))
    .catch(err => console.error('DB chyba:', err));
}

// ── helpers: vrací Promise<Array> ────────────────────────────
function loadScores() {
  if (USE_DB) {
    return db.query('SELECT name, score FROM scores ORDER BY score DESC')
             .then(r => r.rows);
  }
  try { return Promise.resolve(JSON.parse(fs.readFileSync(FILE, 'utf8'))); }
  catch { return Promise.resolve([]); }
}

function saveScore(entry) {
  if (USE_DB) {
    return db.query('INSERT INTO scores (name, score) VALUES ($1, $2)', [entry.name, entry.score]);
  }
  // file fallback
  const scores = (() => {
    try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; }
  })();
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  fs.writeFileSync(FILE, JSON.stringify(scores));
  return Promise.resolve();
}

// ── GET /api/leaderboard  →  top 10 ──────────────────────────
app.get('/api/leaderboard', (_, res) => {
  loadScores()
    .then(all => res.json(all.slice(0, 10)))
    .catch(() => res.status(500).end());
});

// ── POST /api/score  →  { rank, top10 } ──────────────────────
app.post('/api/score', (req, res) => {
  const { name, score } = req.body;
  if (!name || !Number.isFinite(score)) return res.status(400).end();

  const entry = { name: String(name).trim().slice(0, 20), score: Math.floor(score) };

  saveScore(entry)
    .then(() => loadScores())
    .then(all => {
      const rank = all.findIndex(e => e.name === entry.name && e.score === entry.score) + 1;
      res.json({ rank, top10: all.slice(0, 10) });
    })
    .catch(() => res.status(500).end());
});

app.listen(PORT, () => {
  console.log(`Final Bosu server → http://localhost:${PORT}`);
  console.log(`Úložiště: ${USE_DB ? 'PostgreSQL (trvalé)' : 'scores.json (dočasné)'}`);
});
