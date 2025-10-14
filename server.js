// ==================================================
// 🎰 Serveur GDJ - Version complète 4 jeux (corrigé sans suppression)
// ==================================================

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

// ==================================================
// 📂 Fichiers JSON
// ==================================================
const TICKET_FILE = "tickets.json";
const POF_FILE = "tickets_pof.json";
const JACKPOT_FILE = "tickets_jackpot.json";
const CASH_FILE = "tickets_cash.json";

// ==================================================
// 🔢 Distributions
// ==================================================
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

const WIN_PROB = 1 / 8;

// ==================================================
// ⚙️ Fonctions utilitaires
// ==================================================
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

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

// ==================================================
// 🎫 MILLIONNAIRE
// ==================================================
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

// ==================================================
// 🪙 PILE OU FACE
// ==================================================
function regeneratePOFTickets() {
  const pofTickets = [];
  for (let i = 0; i < 5000; i++) {
    const type = Math.random() < 0.5 ? "PILE" : "FACE";
    let gain = pick(["1€", "2€", "5€", "10€", "20€"]); // gain factice
    let revealed = type === "PILE" ? "FACE" : "PILE";

    if (Math.random() < WIN_PROB) {
      const pool = [];
      POF_DISTRIBUTION.forEach(d => {
        for (let j = 0; j < d.count; j++) pool.push(d.gain);
      });
      shuffle(pool);
      gain = pool[Math.floor(Math.random() * pool.length)];
      revealed = type; // gagnant
    }

    pofTickets.push({
      id: String(i + 1).padStart(4, "0"),
      type,
      revealed,
      gain,
      sold: false,
      used: false,
      code: null
    });
  }
  fs.writeFileSync(POF_FILE, JSON.stringify(pofTickets, null, 2));
}

// ==================================================
// 🎰 JACKPOT
// ==================================================
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

// ==================================================
// 💶 CASH (corrigé + logique gagnante réaliste)
// ==================================================
function regenerateCashTickets() {
  console.log("🎲 Génération des tickets CASH réalistes...");
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

    if (gainTotal === 0) {
      // 🎟️ PERDANT — aucun numéro gagnant présent
      grilleNums.forEach(num => {
        const fauxGain = pick([0, 5, 10, 20, 50, 100]);
        grille.push({ num, gain: fauxGain });
      });
    } else {
      // 🏆 GAGNANT — répartir le gain total sur 1 à 5 numéros
      const nbWinCases = pick([1, 2, 3, 4, 5]);
      const winNumbers = shuffle([...gagnants]).slice(0, nbWinCases);

      let gainsDistrib = [];
      let reste = gainTotal;
      const gainsPossibles = [5, 10, 20, 50, 100, 200, 500, 1000, 5000];
      while (reste > 0) {
        const possible = gainsPossibles.filter(g => g <= reste);
        if (possible.length === 0) break;
        const val = pick(possible);
        gainsDistrib.push(val);
        reste -= val;
      }

      // équilibrer le nombre de gains avec les numéros gagnants
      gainsDistrib = gainsDistrib.slice(0, nbWinCases);
      while (gainsDistrib.length < nbWinCases) gainsDistrib.push(5);

      grilleNums.forEach(num => {
        if (winNumbers.includes(num)) {
          const g = gainsDistrib.pop() || 0;
          grille.push({ num, gain: g });
        } else {
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
  console.log(`✅ ${tickets.length} tickets CASH générés.`);
}

// ==================================================
// 🚀 Initialisation
// ==================================================
if (!fs.existsSync(TICKET_FILE)) regenerateTickets();
if (!fs.existsSync(POF_FILE)) regeneratePOFTickets();
if (!fs.existsSync(JACKPOT_FILE)) regenerateJackpotTickets();
if (!fs.existsSync(CASH_FILE)) regenerateCashTickets();

// ==================================================
// 🧾 Routes API
// ==================================================
function makeBuyEndpoint(file, regenFunc) {
  return (req, res) => {
    const count = parseInt(req.query.count) || 1;
    let data = JSON.parse(fs.readFileSync(file, "utf8"));
    let available = data.filter(t => !t.sold);
    if (available.length < count) {
      regenFunc();
      data = JSON.parse(fs.readFileSync(file, "utf8"));
      available = data.filter(t => !t.sold);
    }
    const bought = [];
    for (let i = 0; i < count; i++) {
      const t = available.splice(Math.floor(Math.random() * available.length), 1)[0];
      t.sold = true;
      t.code = Math.floor(1000 + Math.random() * 9000).toString();
      bought.push({ id: t.id, code: t.code });
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    res.json({ tickets: bought });
  };
}

function makeReadEndpoint(file) {
  return (req, res) => {
    const { code, validate } = req.query;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const t = data.find(tt => tt.id === req.params.id);
    if (!t) return res.status(404).json({ error: "Ticket introuvable" });
    if (t.code !== code) return res.status(403).json({ error: "Code invalide" });

    if (validate === "true") {
      if (t.used) return res.status(403).json({ error: "Ticket déjà utilisé" });
      t.used = true;
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
    }

    res.json(t);
  };
}

// Assignation rapide
app.get("/api/buyTicket", makeBuyEndpoint(TICKET_FILE, regenerateTickets));
app.get("/api/ticket/:id", makeReadEndpoint(TICKET_FILE));
app.get("/api/buyPOF", makeBuyEndpoint(POF_FILE, regeneratePOFTickets));
app.get("/api/pof/ticket/:id", makeReadEndpoint(POF_FILE));
app.get("/api/buyJackpot", makeBuyEndpoint(JACKPOT_FILE, regenerateJackpotTickets));
app.get("/api/jackpot/ticket/:id", makeReadEndpoint(JACKPOT_FILE));
app.get("/api/buyCash", makeBuyEndpoint(CASH_FILE, regenerateCashTickets));
app.get("/api/cash/ticket/:id", makeReadEndpoint(CASH_FILE));

// ==================================================
// 🧩 Admin
// ==================================================
function makeAdminCheck(file) {
  return (req, res) => {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const t = data.find(tt => tt.id === req.params.id);
    if (!t) return res.status(404).json({ error: "Ticket introuvable" });
    res.json(t);
  };
}

app.get("/api/admin/checkTicket/:id", makeAdminCheck(TICKET_FILE));
app.get("/api/admin/checkPOF/:id", makeAdminCheck(POF_FILE));
app.get("/api/admin/checkJackpot/:id", makeAdminCheck(JACKPOT_FILE));
app.get("/api/admin/checkCash/:id", makeAdminCheck(CASH_FILE));

app.post("/api/admin/reset", (req, res) => {
  regenerateTickets();
  regeneratePOFTickets();
  regenerateJackpotTickets();
  regenerateCashTickets();
  res.json({ success: true, message: "🎟️ Tous les tickets régénérés." });
});

// ==================================================
// 🌐 Pages
// ==================================================
app.get("/ticket", (_, res) => res.sendFile(path.join(__dirname, "public", "ticket.html")));
app.get("/pof", (_, res) => res.sendFile(path.join(__dirname, "public", "pof.html")));
app.get("/jackpot", (_, res) => res.sendFile(path.join(__dirname, "public", "jackpot.html")));
app.get("/cash", (_, res) => res.sendFile(path.join(__dirname, "public", "cash.html")));
app.get("/admin", (_, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/", (_, res) => res.redirect("/ticket"));

// ==================================================
// 🚀 Lancement du serveur
// ==================================================
app.listen(PORT, () => console.log(`✅ Serveur lancé sur http://localhost:${PORT}`));
