const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public")); // sert les fichiers HTML/CSS/JS

// --------------------
// Millionnaire
// --------------------
const TICKET_FILE = "tickets.json";
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

// --------------------
// Pile ou Face
// --------------------
const POF_FILE = "tickets_pof.json";
const POF_DISTRIBUTION = [
  { gain: "5000€", count: 3 },
  { gain: "200€", count: 5 },
  { gain: "50€", count: 100 },
  { gain: "15€", count: 150 },
  { gain: "5€", count: 300 },
  { gain: "2€", count: 400 },
  { gain: "1€", count: 1000 }
];

const WIN_PROB = 1 / 8; // ✅ 1 chance sur 8 de gagner

let tickets = [];
let pofTickets = [];

// --------------------
// JACKPOT (Nouveau jeu)
// --------------------
const JACKPOT_FILE = "tickets_jackpot.json";
const JACKPOT_PRICE = 3;
const JACKPOT_DISTRIBUTION = [
  { symbol: "💎", gain: "30 000€", count: 1 },
  { symbol: "💰", gain: "500€", count: 9 },
  { symbol: "👑", gain: "30€", count: 40 },
  { symbol: "7️⃣", gain: "7€", count: 150 },
  { symbol: "⭐", gain: "3€", count: 800 },
  { symbol: "❌", gain: "0", count: 4000 }
];
let jackpotTickets = [];

// --------------------
// Fonctions utilitaires
// --------------------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// --------------------
// Millionnaire
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
// Pile ou Face
// --------------------
function regeneratePOFTickets() {
  pofTickets = [];

  for (let i = 0; i < 5000; i++) {
    const ticketType = Math.random() < 0.5 ? "PILE" : "FACE";
    let revealed, gain = "0";

    if (Math.random() < WIN_PROB) {
      const pool = [];
      POF_DISTRIBUTION.forEach(d => {
        for (let j = 0; j < d.count; j++) pool.push(d.gain);
      });
      shuffle(pool);
      gain = pool[Math.floor(Math.random() * pool.length)];
      revealed = ticketType;
    } else {
      revealed = ticketType === "PILE" ? "FACE" : "PILE";
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
// JACKPOT
// --------------------
function regenerateJackpotTickets() {
  let pool = [];
  JACKPOT_DISTRIBUTION.forEach(d => {
    for (let i = 0; i < d.count; i++) pool.push({ symbol: d.symbol, gain: d.gain });
  });
  shuffle(pool);

  jackpotTickets = pool.map((item, i) => {
    const machines = [];
    const allSymbols = ["💰", "💎", "👑", "7️⃣", "⭐", "❌"];

    for (let m = 0; m < 3; m++) {
      let row;
      if (item.gain !== "0" && Math.random() < 0.33) {
        row = [item.symbol, item.symbol, item.symbol];
      } else {
        row = [];
        for (let j = 0; j < 3; j++) {
          const rand = allSymbols[Math.floor(Math.random() * allSymbols.length)];
          row.push(rand);
        }
      }
      machines.push(row);
    }

    if (!machines.some(r => r[0] === r[1] && r[1] === r[2]) && item.gain !== "0") {
      const idx = Math.floor(Math.random() * 3);
      machines[idx] = [item.symbol, item.symbol, item.symbol];
    }

    return {
      id: String(i + 1).padStart(4, "0"),
      machines,
      gain: item.gain,
      symbol: item.symbol,
      sold: false,
      used: false,
      code: null
    };
  });

  fs.writeFileSync(JACKPOT_FILE, JSON.stringify(jackpotTickets, null, 2));
}

// --------------------
// Chargement
// --------------------
function loadTickets() {
  if (fs.existsSync(TICKET_FILE)) tickets = JSON.parse(fs.readFileSync(TICKET_FILE, "utf8"));
  else regenerateTickets();

  if (fs.existsSync(POF_FILE)) pofTickets = JSON.parse(fs.readFileSync(POF_FILE, "utf8"));
  else regeneratePOFTickets();

  if (fs.existsSync(JACKPOT_FILE)) jackpotTickets = JSON.parse(fs.readFileSync(JACKPOT_FILE, "utf8"));
  else regenerateJackpotTickets();
}

// --------------------
// API Millionnaire
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
  if (!code || t.code !== code) return res.status(403).json({ error: "Code invalide" });
  res.json(t);
});

// --------------------
// API Pile ou Face
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
// API JACKPOT
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

// ✅ Lecture et verrouillage d’un ticket Jackpot
app.get("/api/jackpot/ticket/:id", (req, res) => {
  const { code } = req.query;

  if (!fs.existsSync(JACKPOT_FILE)) {
    return res.status(404).json({ error: "Fichier Jackpot introuvable." });
  }

  // Lire le fichier et trouver le ticket
  const data = JSON.parse(fs.readFileSync(JACKPOT_FILE, "utf8"));
  const t = data.find(tt => tt.id === req.params.id);

  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  if (!code || t.code !== code) return res.status(403).json({ error: "Code invalide" });

  // ✅ Si déjà utilisé, on bloque tout de suite
  if (t.used) {
    return res.status(403).json({ error: "Ce ticket a déjà été utilisé." });
  }

  // ✅ Marquer comme utilisé IMMÉDIATEMENT
  t.used = true;
  fs.writeFileSync(JACKPOT_FILE, JSON.stringify(data, null, 2));

  // ✅ Envoyer le contenu au premier utilisateur
  console.log(`🎰 Ticket #${t.id} utilisé par le premier joueur.`);
  res.json({
    id: t.id,
    code: t.code,
    machines: t.machines,
    gain: t.gain,
    sold: t.sold,
    used: false, // ← autorise le premier joueur à gratter une seule fois
    symbol: t.symbol
  });
});




// --------------------
// Pages web (corrigées)
// --------------------
app.get("/ticket", (req, res) => res.sendFile(path.join(__dirname, "public", "ticket.html")));
app.get("/pof", (req, res) => res.sendFile(path.join(__dirname, "public", "pof.html")));
app.get("/jackpot", (req, res) => res.sendFile(path.join(__dirname, "public", "jackpot.html")));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/", (req, res) => res.redirect("/ticket"));

// --------------------
// Admin
// --------------------
app.get("/api/admin/stock", (req, res) => {
  const game = req.query.game;
  const read = f => JSON.parse(fs.readFileSync(f, "utf8"));

  try {
    if (game === "ticket") {
      const d = read(TICKET_FILE);
      return res.json({ total: d.length, used: d.filter(x => x.used).length, remaining: d.filter(x => !x.used).length });
    } else if (game === "pof") {
      const d = read(POF_FILE);
      return res.json({ total: d.length, used: d.filter(x => x.used).length, remaining: d.filter(x => !x.used).length });
    } else if (game === "jackpot") {
      const d = read(JACKPOT_FILE);
      return res.json({ total: d.length, used: d.filter(x => x.used).length, remaining: d.filter(x => !x.used).length });
    } else {
      return res.status(400).json({ error: "Jeu inconnu" });
    }
  } catch (err) {
    console.error("Erreur lecture stock:", err);
    return res.status(500).json({ error: "Erreur lecture fichier." });
  }
});

// ✅ Reset spécifiques
app.post("/api/admin/reset", (req, res) => {
  regenerateTickets();
  regeneratePOFTickets();
  regenerateJackpotTickets();
  res.json({ success: true, message: "🎟️ Tous les tickets régénérés." });
});

// --------------------
// ADMIN - Vérif Jackpot
// --------------------
app.get("/api/admin/checkJackpot/:id", (req, res) => {
  try {
    if (!fs.existsSync(JACKPOT_FILE)) {
      return res.status(404).json({ error: "Fichier Jackpot introuvable." });
    }

    const data = JSON.parse(fs.readFileSync(JACKPOT_FILE, "utf8"));
    const t = data.find(tt => tt.id === req.params.id);
    if (!t) return res.status(404).json({ error: "Ticket introuvable" });

    let realGain = "PERDU";
    const isWinning = t.machines.some(
      m => m[0] === m[1] && m[1] === m[2] && t.gain !== "0"
    );

    if (isWinning) realGain = t.gain;

    res.json({
      id: t.id,
      machines: t.machines,
      gain: realGain,
      sold: t.sold,
      used: t.used,
      code: t.code
    });
  } catch (err) {
    console.error("Erreur /api/admin/checkJackpot:", err);
    res.status(500).json({ error: "Erreur interne serveur." });
  }
});

// --------------------
// Démarrage
// --------------------
loadTickets();
app.listen(PORT, () => console.log(`✅ Serveur lancé sur http://localhost:${PORT}`));
