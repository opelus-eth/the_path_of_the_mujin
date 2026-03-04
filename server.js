const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const FILE = path.join(__dirname, 'scores.json');

app.use(express.json());
app.use(express.static(__dirname));

// ── helpers ──────────────────────────────────────────────────
function loadScores() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; }
}
function saveScores(arr) {
  fs.writeFileSync(FILE, JSON.stringify(arr));
}

// ── GET /api/leaderboard  →  top 10 ──────────────────────────
app.get('/api/leaderboard', (_, res) => {
  res.json(loadScores().slice(0, 10));
});

// ── POST /api/score  →  { rank, top10 } ──────────────────────
app.post('/api/score', (req, res) => {
  const { name, score } = req.body;
  if (!name || !Number.isFinite(score)) return res.status(400).end();

  const scores = loadScores();
  const entry  = { name: String(name).trim().slice(0, 20), score: Math.floor(score) };
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  saveScores(scores);

  const rank = scores.indexOf(entry) + 1;   // 1-based
  res.json({ rank, top10: scores.slice(0, 10) });
});

app.listen(PORT, () => console.log(`Final Bosu server → http://localhost:${PORT}`));
