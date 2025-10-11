const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

// --------------------
// FICHIERS
// --------------------
const TICKET_FILE = "tickets.json";           // Millionnaire
const POF_FILE = "tickets_pof.json";          // Pile ou Face
const JACKPOT_FILE = "tickets_jackpot.json";  // 🎰 Jackpot

// --------------------
// DISTRIBUTIONS
// --------------------

// Millionnaire
const distribution = [
  { gain: "⭐", count: 5 },
  { gain: "50K€", count: 2 },
  { gain: "5K€", count: 10 },
  { gain: "1K€", count: 25 },
  { gain: "500€", count: 40 },
  { gain: "100€", count: 80 },
  { gain: "50€", count: 150 },
  { gain: "10€", count: 163 },
  { gain: "0", count: 525 }
];

// Pile ou Face
const POF_DISTRIBUTION = [
  { gain: "5000€", count: 3 },
  { gain: "200€", count: 5 },
  { gain: "50€", count: 100 },
  { gain: "15€", count: 150 },
  { gain: "5€", count: 300 },
  { gain: "2€", count: 400 },
  { gain: "1€", count: 1000 }
];
const WIN_PROB = 1 / 8;

// 🎰 Jackpot — 1 chance sur 5 de gagner (5000 tickets)
const JACKPOT_DISTRIBUTION = [
  { gain: "💎 30 000€", count: 1 },
  { gain: "💰 500€", count: 5 },
  { gain: "👑 30€", count: 25 },
  { gain: "7️⃣ 7€", count: 120 },
  { gain: "⭐ 3€", count: 849 },
  { gain: "0", count: 4000 }
];
const JACKPOT_WIN_PROB = 1 / 5;

let tickets = [];
let pofTickets = [];
let jackpotTickets = [];

// --------------------
// FONCTIONS UTILITAIRES
// --------------------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// --------------------
// MILLIONNAIRE
// --------------------
function regenerateTickets() {
  let pool = [];
  distribution.forEach(d => {
    for (let i = 0; i < d.count; i++) pool.push(d.gain);
  });
  shuffle(pool);

  tickets = pool.map((gain, index) => ({
    id: String(index + 1).padStart(3, "0"),
    gain,
    sold: false,
    used: false,
    code: null
  }));

  fs.writeFileSync(TICKET_FILE, JSON.stringify(tickets, null, 2));
}

// --------------------
// PILE OU FACE
// --------------------
function regeneratePOFTickets() {
  pofTickets = [];

  for (let i = 0; i < 5000; i++) {
    const ticketType = Math.random() < 0.5 ? "PILE" : "FACE";
    let revealed, gain = "0";

    if (Math.random() < WIN_PROB) {
      revealed = ticketType;
      const pool = [];
      POF_DISTRIBUTION.forEach(d => {
        for (let j = 0; j < d.count; j++) pool.push(d.gain);
      });
      shuffle(pool);
      gain = pool[Math.floor(Math.random() * pool.length)];
    } else {
      revealed = ticketType === "PILE" ? "FACE" : "PILE";
      gain = "0";
    }

    pofTickets.push({
      id: String(i + 1).padStart(4, "0"),
      type: ticketType,
      revealed,
      gain,
      sold: false,
      used: false,
      code: null
    });
  }

  fs.writeFileSync(POF_FILE, JSON.stringify(pofTickets, null, 2));
}

// --------------------
// 🎰 JACKPOT
// --------------------
function regenerateJackpotTickets() {
  let pool = [];
  JACKPOT_DISTRIBUTION.forEach(d => {
    for (let i = 0; i < d.count; i++) pool.push(d.gain);
  });
  shuffle(pool);

  jackpotTickets = pool.map((gain, index) => ({
    id: String(index + 1).padStart(4, "0"),
    gain,
    sold: false,
    used: false,
    code: null
  }));

  fs.writeFileSync(JACKPOT_FILE, JSON.stringify(jackpotTickets, null, 2));
}

// --------------------
// CHARGEMENT
// --------------------
function loadTickets() {
  if (fs.existsSync(TICKET_FILE)) {
    tickets = JSON.parse(fs.readFileSync(TICKET_FILE, "utf8"));
  } else {
    regenerateTickets();
  }

  if (fs.existsSync(POF_FILE)) {
    pofTickets = JSON.parse(fs.readFileSync(POF_FILE, "utf8"));
  } else {
    regeneratePOFTickets();
  }

  if (fs.existsSync(JACKPOT_FILE)) {
    jackpotTickets = JSON.parse(fs.readFileSync(JACKPOT_FILE, "utf8"));
  } else {
    regenerateJackpotTickets();
  }
}

// --------------------
// API MILLIONNAIRE
// --------------------
app.get("/api/buyTicket", (req, res) => {
  const count = parseInt(req.query.count) || 1;
  tickets = JSON.parse(fs.readFileSync(TICKET_FILE, "utf8"));
  let available = tickets.filter(t => !t.sold);

  if (available.length < count) {
    regenerateTickets();
    available = tickets.filter(t => !t.sold);
  }

  const bought = [];
  for (let i = 0; i < count; i++) {
    if (!available.length) break;
    const idx = Math.floor(Math.random() * available.length);
    const t = available.splice(idx, 1)[0];
    t.sold = true;
    t.code = Math.floor(1000 + Math.random() * 9000).toString();
    bought.push({ id: t.id, code: t.code });
  }

  fs.writeFileSync(TICKET_FILE, JSON.stringify(tickets, null, 2));
  res.json({ tickets: bought });
});

app.get("/api/ticket/:id", (req, res) => {
  const { code } = req.query;
  const t = tickets.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  if (!code || t.code !== code)
    return res.status(403).json({ error: "Code invalide" });
  res.json(t);
});

// --------------------
// API PILE OU FACE
// --------------------
app.get("/api/buyPOF", (req, res) => {
  const count = parseInt(req.query.count) || 1;
  pofTickets = JSON.parse(fs.readFileSync(POF_FILE, "utf8"));
  let available = pofTickets.filter(t => !t.sold);

  if (available.length < count) {
    regeneratePOFTickets();
    available = pofTickets.filter(t => !t.sold);
  }

  const bought = [];
  for (let i = 0; i < count; i++) {
    if (!available.length) break;
    const idx = Math.floor(Math.random() * available.length);
    const t = available.splice(idx, 1)[0];
    t.sold = true;
    t.code = Math.floor(1000 + Math.random() * 9000).toString();
    bought.push({ id: t.id, code: t.code, type: t.type });
  }

  fs.writeFileSync(POF_FILE, JSON.stringify(pofTickets, null, 2));
  res.json({ tickets: bought });
});

// --------------------
// 🎰 API JACKPOT
// --------------------
app.get("/api/buyJackpot", (req, res) => {
  const count = parseInt(req.query.count) || 1;
  jackpotTickets = JSON.parse(fs.readFileSync(JACKPOT_FILE, "utf8"));
  let available = jackpotTickets.filter(t => !t.sold);

  if (available.length < count) {
    regenerateJackpotTickets();
    available = jackpotTickets.filter(t => !t.sold);
  }

  const bought = [];
  for (let i = 0; i < count; i++) {
    if (!available.length) break;
    const idx = Math.floor(Math.random() * available.length);
    const t = available.splice(idx, 1)[0];
    t.sold = true;
    t.code = Math.floor(1000 + Math.random() * 9000).toString();
    bought.push({ id: t.id, code: t.code });
  }

  fs.writeFileSync(JACKPOT_FILE, JSON.stringify(jackpotTickets, null, 2));
  res.json({ tickets: bought });
});

app.get("/api/jackpot/ticket/:id", (req, res) => {
  const { code } = req.query;
  const t = jackpotTickets.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  if (!code || t.code !== code)
    return res.status(403).json({ error: "Code invalide" });

  if (t.used)
    return res.status(403).json({ error: "Ticket déjà utilisé." });

  res.json(t);
});

app.post("/api/jackpot/use/:id", (req, res) => {
  const { code } = req.body;
  const t = jackpotTickets.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  if (t.code !== code) return res.status(403).json({ error: "Code invalide" });

  t.used = true;
  fs.writeFileSync(JACKPOT_FILE, JSON.stringify(jackpotTickets, null, 2));
  res.json({ success: true, message: "Ticket marqué comme utilisé" });
});

// --------------------
// ADMIN
// --------------------
app.get("/api/admin/checkJackpot/:id", (req, res) => {
  const t = jackpotTickets.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  res.json(t);
});

app.post("/api/admin/resetJackpot", (req, res) => {
  regenerateJackpotTickets();
  res.json({ success: true, message: "🎰 Tickets Jackpot réinitialisés." });
});

// --------------------
// STOCKS
// --------------------
app.get("/api/admin/stock", (req, res) => {
  const game = req.query.game;

  try {
    const dataMap = {
      ticket: TICKET_FILE,
      pof: POF_FILE,
      jackpot: JACKPOT_FILE
    };
    if (!dataMap[game]) return res.status(400).json({ error: "Jeu inconnu" });

    const data = JSON.parse(fs.readFileSync(dataMap[game], "utf8"));
    const total = data.length;
    const used = data.filter(t => t.used).length;
    const remaining = total - used;

    res.json({ total, used, remaining });
  } catch (err) {
    console.error("Erreur lecture stock :", err);
    res.status(500).json({ error: "Erreur lecture des fichiers." });
  }
});

// --------------------
loadTickets();
app.listen(PORT, () =>
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`)
);
