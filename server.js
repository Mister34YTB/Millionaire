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
// Fichiers
// --------------------
const TICKET_FILE = "tickets.json";
const POF_FILE = "tickets_pof.json";
const JACKPOT_FILE = "tickets_jackpot.json";

// --------------------
// Distributions
// --------------------
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

const POF_DISTRIBUTION = [
  { gain: "5000€", count: 3 },
  { gain: "200€", count: 5 },
  { gain: "50€", count: 100 },
  { gain: "15€", count: 150 },
  { gain: "5€", count: 300 },
  { gain: "2€", count: 400 },
  { gain: "1€", count: 1000 }
];

const JACKPOT_DISTRIBUTION = [
  { symbol: "💎", gain: "30 000€", count: 3 },
  { symbol: "💰", gain: "500€", count: 5 },
  { symbol: "👑", gain: "30€", count: 40 },
  { symbol: "7️⃣", gain: "7€", count: 150 },
  { symbol: "⭐", gain: "3€", count: 800 },
  { symbol: "❌", gain: "0", count: 3995 }
];

const WIN_PROB = 1 / 8;

// --------------------
// Fonctions utilitaires
// --------------------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr; // ✅ <- AJOUTER CETTE LIGNE
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

  const tickets = pool.map((gain, index) => ({
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
  const pofTickets = [];
  const pool = [];

  // Prépare la distribution des vrais gains
  POF_DISTRIBUTION.forEach(d => {
    for (let j = 0; j < d.count; j++) pool.push(d.gain);
  });
  shuffle(pool);

  for (let i = 0; i < 5000; i++) {
    const type = Math.random() < 0.5 ? "PILE" : "FACE";
    let revealed;
    let gain;

    // 🎯 1 chance sur 8 d’être gagnant
    const isWinner = Math.random() < WIN_PROB;

    if (isWinner) {
      // 🏆 GAGNANT → symbole révélé = le bon côté
      revealed = type;
      gain = pool[Math.floor(Math.random() * pool.length)];
    } else {
      // 💀 PERDANT → symbole révélé ≠ bon côté
      revealed = type === "PILE" ? "FACE" : "PILE";
      // gain fictif aléatoire parmi la distribution existante, mais pas un vrai gain
      gain = pick(["1€", "2€", "5€", "10€", "20€"]);
    }

    pofTickets.push({
      id: String(i + 1).padStart(4, "0"),
      type,        // Côté du ticket choisi
      revealed,    // Côté révélé
      gain,        // Gain réel ou fictif
      sold: false,
      used: false,
      code: null
    });
  }

  fs.writeFileSync(POF_FILE, JSON.stringify(pofTickets, null, 2));
  console.log("✅ Tickets PILE OU FACE générés (avec gains fictifs pour les perdants)");
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

  const allSymbols = ["💰", "💎", "👑", "7️⃣", "⭐", "❌"];
  const jackpotTickets = pool.map((item, i) => {
    const machines = [];
    for (let m = 0; m < 3; m++) {
      let row;
      if (item.gain !== "0" && Math.random() < 0.33) {
        row = [item.symbol, item.symbol, item.symbol];
      } else {
        row = [];
        for (let j = 0; j < 3; j++) {
          row.push(allSymbols[Math.floor(Math.random() * allSymbols.length)]);
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
// Chargement initial
// --------------------
if (!fs.existsSync(TICKET_FILE)) regenerateTickets();
if (!fs.existsSync(POF_FILE)) regeneratePOFTickets();
if (!fs.existsSync(JACKPOT_FILE)) regenerateJackpotTickets();

// --------------------
// API Achat + Lecture
// --------------------

// 🎫 Achat Millionnaire
app.get("/api/buyTicket", (req, res) => {
  const count = parseInt(req.query.count) || 1;
  let data = JSON.parse(fs.readFileSync(TICKET_FILE, "utf8"));
  let available = data.filter(t => !t.sold);
  if (available.length < count) {
    regenerateTickets();
    data = JSON.parse(fs.readFileSync(TICKET_FILE, "utf8"));
    available = data.filter(t => !t.sold);
  }
  const bought = [];
  for (let i = 0; i < count; i++) {
    const t = available.splice(Math.floor(Math.random() * available.length), 1)[0];
    t.sold = true;
    t.code = Math.floor(1000 + Math.random() * 9000).toString();
    bought.push({ id: t.id, code: t.code });
  }
  fs.writeFileSync(TICKET_FILE, JSON.stringify(data, null, 2));
  res.json({ tickets: bought });
});

// 🎫 Lecture Millionnaire
app.get("/api/ticket/:id", (req, res) => {
  const { code } = req.query;
  const data = JSON.parse(fs.readFileSync(TICKET_FILE, "utf8"));
  const t = data.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  if (t.code !== code) return res.status(403).json({ error: "Code invalide" });
  if (t.used) return res.status(403).json({ error: "Ticket déjà utilisé" });
  t.used = true;
  fs.writeFileSync(TICKET_FILE, JSON.stringify(data, null, 2));
  res.json(t);
});

// 🪙 Achat Pile ou Face
app.get("/api/buyPOF", (req, res) => {
  const count = parseInt(req.query.count) || 1;
  let data = JSON.parse(fs.readFileSync(POF_FILE, "utf8"));
  let available = data.filter(t => !t.sold);
  if (available.length < count) {
    regeneratePOFTickets();
    data = JSON.parse(fs.readFileSync(POF_FILE, "utf8"));
    available = data.filter(t => !t.sold);
  }
  const bought = [];
  for (let i = 0; i < count; i++) {
    const t = available.splice(Math.floor(Math.random() * available.length), 1)[0];
    t.sold = true;
    t.code = Math.floor(1000 + Math.random() * 9000).toString();
    bought.push({ id: t.id, code: t.code, type: t.type });
  }
  fs.writeFileSync(POF_FILE, JSON.stringify(data, null, 2));
  res.json({ tickets: bought });
});

// 🪙 Lecture Pile ou Face
app.get("/api/pof/ticket/:id", (req, res) => {
  const { code, validate } = req.query;
  const data = JSON.parse(fs.readFileSync(POF_FILE, "utf8"));
  const t = data.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  if (t.code !== code) return res.status(403).json({ error: "Code invalide" });

  if (validate === "true") {
    if (t.used) return res.status(403).json({ error: "Ticket déjà utilisé" });
    t.used = true;
    fs.writeFileSync(POF_FILE, JSON.stringify(data, null, 2));
  }

  res.json(t);
});


// 🎰 Achat Jackpot
app.get("/api/buyJackpot", (req, res) => {
  const count = parseInt(req.query.count) || 1;
  let data = JSON.parse(fs.readFileSync(JACKPOT_FILE, "utf8"));
  let available = data.filter(t => !t.sold);
  if (available.length < count) {
    regenerateJackpotTickets();
    data = JSON.parse(fs.readFileSync(JACKPOT_FILE, "utf8"));
    available = data.filter(t => !t.sold);
  }
  const bought = [];
  for (let i = 0; i < count; i++) {
    const t = available.splice(Math.floor(Math.random() * available.length), 1)[0];
    t.sold = true;
    t.code = Math.floor(1000 + Math.random() * 9000).toString();
    bought.push({ id: t.id, code: t.code });
  }
  fs.writeFileSync(JACKPOT_FILE, JSON.stringify(data, null, 2));
  res.json({ tickets: bought });
});

// 🎰 Lecture Jackpot
app.get("/api/jackpot/ticket/:id", (req, res) => {
  const { code, validate } = req.query;
  const data = JSON.parse(fs.readFileSync(JACKPOT_FILE, "utf8"));
  const t = data.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  if (t.code !== code) return res.status(403).json({ error: "Code invalide" });

  if (validate === "true") {
    if (t.used) return res.status(403).json({ error: "Ticket déjà utilisé" });
    t.used = true;
    fs.writeFileSync(JACKPOT_FILE, JSON.stringify(data, null, 2));
  }

  res.json(t);
});

// --------------------
// 💶 CASH
// --------------------
const CASH_FILE = "tickets_cash.json";

const CASH_DISTRIBUTION = [
  { gain: 500000, count: 3 },
  { gain: 100000, count: 3 },
  { gain: 5000, count: 5 },
  { gain: 1000, count: 15 },
  { gain: 500, count: 40 },
  { gain: 100, count: 100 },
  { gain: 50, count: 250 },
  { gain: 20, count: 500 },
  { gain: 10, count: 800 },
  { gain: 5, count: 784 },
  { gain: 0, count: 5000 }
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickNumbers(count, exclude = []) {
  const numbers = [];
  while (numbers.length < count) {
    const n = randomInt(1, 49);
    if (!numbers.includes(n) && !exclude.includes(n)) numbers.push(n);
  }
  return numbers;
}

function regenerateCashTickets() {
  console.log("🎲 Génération des tickets CASH (logique FDJ réaliste)...");

  const tickets = [];
  const pool = [];
  CASH_DISTRIBUTION.forEach(d => {
    for (let i = 0; i < d.count; i++) pool.push(d.gain);
  });
  shuffle(pool);

  for (let i = 0; i < pool.length; i++) {
    const gainTotal = pool[i];
    const gagnants = pickNumbers(5);
    const grilleNums = pickNumbers(25);
    const grille = [];

    // 1 chance sur 5 d’être gagnant
    const isWin = Math.random() < 0.20;

    if (!isWin || gainTotal === 0) {
      // ❌ Ticket perdant : aucun gagnant présent
      grilleNums.forEach(num => {
        const fauxGain = pick([0, 5, 10, 20, 50, 100]);
        grille.push({ num, gain: fauxGain });
      });
    } else {
      // ✅ Ticket gagnant : définir le nombre de numéros gagnants
      const rand = Math.random() * 100;
      let nbWin;
      if (rand < 30) nbWin = 1;          // 30 %
      else if (rand < 40) nbWin = 2;     // 10 %
      else if (rand < 47) nbWin = 3;     // 7 %
      else if (rand < 50) nbWin = 4;     // 3 %
      else nbWin = 5;                    // 1 %

      const winNumbers = shuffle([...gagnants]).slice(0, nbWin);

      // Répartition des gains (pondérée)
      const gainsDistrib = [];
      let reste = gainTotal;
      for (let j = 0; j < nbWin; j++) {
        if (j === nbWin - 1) {
          gainsDistrib.push(reste);
        } else {
          // on divise le total en parts aléatoires cohérentes
          const partMin = Math.max(5, Math.floor(gainTotal / (nbWin * 2)));
          const partMax = Math.floor(gainTotal / nbWin);
          const part = randomInt(partMin, partMax);
          gainsDistrib.push(part);
          reste -= part;
        }
      }

      // Construction de la grille
      grilleNums.forEach(num => {
        if (winNumbers.includes(num)) {
          const g = gainsDistrib.pop() || 0;
          grille.push({ num, gain: g });
        } else {
          // gains fictifs sur les autres cases
          const fauxGain = pick([0, 5, 10, 20, 50, 100]);
          grille.push({ num, gain: fauxGain });
        }
      });
    }

    tickets.push({
      id: String(i + 1).padStart(4, "0"),
      gagnants,
      grille,
      gain_total: gainTotal,
      sold: false,
      used: false,
      code: null
    });
  }

  fs.writeFileSync(CASH_FILE, JSON.stringify(tickets, null, 2));
  console.log(`✅ ${tickets.length} tickets CASH générés avec logique FDJ réaliste`);
}



if (!fs.existsSync(CASH_FILE)) regenerateCashTickets();

// 🎫 Achat CASH
app.get("/api/buyCash", (req, res) => {
  const count = parseInt(req.query.count) || 1;
  let data = JSON.parse(fs.readFileSync(CASH_FILE, "utf8"));
  let available = data.filter(t => !t.sold);

  if (available.length < count) {
    regenerateCashTickets();
    data = JSON.parse(fs.readFileSync(CASH_FILE, "utf8"));
    available = data.filter(t => !t.sold);
  }

  const bought = [];
  for (let i = 0; i < count; i++) {
    const t = available.splice(Math.floor(Math.random() * available.length), 1)[0];
    t.sold = true;
    t.code = Math.floor(1000 + Math.random() * 9000).toString();
    bought.push({ id: t.id, code: t.code });
  }

  fs.writeFileSync(CASH_FILE, JSON.stringify(data, null, 2));
  res.json({ tickets: bought });
});

// 🎫 Lecture CASH
app.get("/api/cash/ticket/:id", (req, res) => {
  const { code, validate } = req.query;
  const data = JSON.parse(fs.readFileSync(CASH_FILE, "utf8"));
  const t = data.find(tt => tt.id === req.params.id);

  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  if (t.code !== code) return res.status(403).json({ error: "Code invalide" });

  if (validate === "true") {
    if (t.used) return res.status(403).json({ error: "Ticket déjà utilisé" });
    t.used = true;
    fs.writeFileSync(CASH_FILE, JSON.stringify(data, null, 2));
  }

  res.json(t);
});

// --------------------
// ADMIN
// --------------------

// 🔍 Vérif Millionnaire
app.get("/api/admin/checkTicket/:id", (req, res) => {
  const data = JSON.parse(fs.readFileSync(TICKET_FILE, "utf8"));
  const t = data.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  res.json(t);
});

// 🔍 Vérif Pile ou Face
app.get("/api/admin/checkPOF/:id", (req, res) => {
  const data = JSON.parse(fs.readFileSync(POF_FILE, "utf8"));
  const t = data.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  res.json(t);
});

// 🔍 Vérif Jackpot
app.get("/api/admin/checkJackpot/:id", (req, res) => {
  const data = JSON.parse(fs.readFileSync(JACKPOT_FILE, "utf8"));
  const t = data.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  res.json(t);
});

// 🔍 Vérif CASH
app.get("/api/admin/checkCash/:id", (req, res) => {
  const data = JSON.parse(fs.readFileSync(CASH_FILE, "utf8"));
  const t = data.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  res.json(t);
});

// 🔄 Reset complet
app.post("/api/admin/reset", (req, res) => {
  regenerateTickets();
  regeneratePOFTickets();
  regenerateJackpotTickets();
  regenerateCashTickets();
  res.json({ success: true, message: "🎟️ Tous les tickets régénérés." });
});



// --------------------
// Pages
// --------------------
app.get("/ticket", (_, res) => res.sendFile(path.join(__dirname, "public", "ticket.html")));
app.get("/pof", (_, res) => res.sendFile(path.join(__dirname, "public", "pof.html")));
app.get("/jackpot", (_, res) => res.sendFile(path.join(__dirname, "public", "jackpot.html")));
app.get("/cash", (_, res) => res.sendFile(path.join(__dirname, "public", "cash.html")));
app.get("/admin", (_, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/", (_, res) => res.redirect("/ticket"));

// --------------------
// Lancement
// --------------------
app.listen(PORT, () => console.log(`✅ Serveur lancé sur http://localhost:${PORT}`));
