// ============================================================
// 🎰 SERVEUR CASINO COMPLET (Millionnaire + Pile ou Face + Tiercé)
// ============================================================

const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public")); // Sert les fichiers HTML, CSS et JS

// ============================================================
// 💰 MILLIONNAIRE
// ============================================================
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
  { gain: "0", count: 525 },
];
let tickets = [];

// ============================================================
// 🪙 PILE OU FACE
// ============================================================
const POF_FILE = "tickets_pof.json";
const POF_DISTRIBUTION = [
  { gain: "5000€", count: 3 },
  { gain: "200€", count: 5 },
  { gain: "50€", count: 100 },
  { gain: "15€", count: 150 },
  { gain: "5€", count: 300 },
  { gain: "2€", count: 400 },
  { gain: "1€", count: 1000 },
];
const WIN_PROB = 1 / 8;
let pofTickets = [];

// ============================================================
// 🏇 TIERCÉ AUTOMATIQUE PERSISTANT
// ============================================================
const TIERCE_FILE = "tierce.json";
let tierceState = {
  race_id: 1,
  jackpot: 15000,
  startTime: Date.now(),
  lastResult: null,
};

// Charger les données Tiercé sauvegardées
if (fs.existsSync(TIERCE_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(TIERCE_FILE, "utf8"));
    tierceState = { ...tierceState, ...data };
  } catch (err) {
    console.error("⚠️ Erreur de lecture du fichier tierce.json :", err);
  }
}

// ============================================================
// 🔧 FONCTIONS UTILITAIRES
// ============================================================
function saveTierce() {
  fs.writeFileSync(TIERCE_FILE, JSON.stringify(tierceState, null, 2));
}

function currentJackpot() {
  const elapsedMinutes = Math.floor((Date.now() - tierceState.startTime) / 60000);
  return tierceState.jackpot + elapsedMinutes * 10;
}

function timeRemaining() {
  const total = 5 * 60 * 1000; // 5 min
  const elapsed = Date.now() - tierceState.startTime;
  return Math.max(0, total - elapsed);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function regenerateTickets() {
  let pool = [];
  distribution.forEach((d) => {
    for (let i = 0; i < d.count; i++) pool.push(d.gain);
  });
  shuffle(pool);
  tickets = pool.map((gain, i) => ({
    id: String(i + 1).padStart(3, "0"),
    gain,
    sold: false,
    used: false,
    code: null,
  }));
  fs.writeFileSync(TICKET_FILE, JSON.stringify(tickets, null, 2));
}

function regeneratePOFTickets() {
  pofTickets = [];
  for (let i = 0; i < 5000; i++) {
    const type = Math.random() < 0.5 ? "PILE" : "FACE";
    let revealed, gain = "0";
    if (Math.random() < WIN_PROB) {
      revealed = type;
      const pool = [];
      POF_DISTRIBUTION.forEach((d) => {
        for (let j = 0; j < d.count; j++) pool.push(d.gain);
      });
      shuffle(pool);
      gain = pool[Math.floor(Math.random() * pool.length)];
    } else {
      revealed = type === "PILE" ? "FACE" : "PILE";
    }
    pofTickets.push({
      id: String(i + 1).padStart(4, "0"),
      type,
      revealed,
      gain,
      sold: false,
      used: false,
      code: null,
    });
  }
  fs.writeFileSync(POF_FILE, JSON.stringify(pofTickets, null, 2));
}

function loadTickets() {
  if (fs.existsSync(TICKET_FILE)) tickets = JSON.parse(fs.readFileSync(TICKET_FILE, "utf8"));
  else regenerateTickets();

  if (fs.existsSync(POF_FILE)) pofTickets = JSON.parse(fs.readFileSync(POF_FILE, "utf8"));
  else regeneratePOFTickets();
}

// ============================================================
// 🧭 ROUTES API TIERCÉ
// ============================================================

// ✅ État du Tiercé (site)
app.get("/api/tierce/state", (req, res) => {
  res.json({
    race_id: tierceState.race_id,
    jackpot: currentJackpot(),
    time_remaining: Math.floor(timeRemaining() / 1000),
  });
});

// ✅ Dernier résultat (bot)
app.get("/api/tierce/latest", (req, res) => {
  if (!tierceState.lastResult) {
    return res.json({ message: "Aucun résultat disponible." });
  }
  res.json(tierceState.lastResult);
});

// ✅ Fin d’une course (site)
app.post("/api/tierce/result", (req, res) => {
  const { top3, fullOrder } = req.body;
  if (!Array.isArray(top3) || top3.length !== 3) {
    return res.status(400).json({ error: "Top3 invalide." });
  }

  const result = {
    race_id: tierceState.race_id,
    top3,
    fullOrder: fullOrder || [],
    jackpot: currentJackpot(),
    timestamp: Date.now(),
  };

  tierceState.lastResult = result;
  tierceState.race_id += 1;
  tierceState.jackpot = currentJackpot();
  tierceState.startTime = Date.now();
  saveTierce();

  console.log(`🏁 Course #${result.race_id} terminée → ${top3.join(", ")}`);
  res.json({ success: true });
});

// ============================================================
// 🎟️ ROUTES API MILLIONNAIRE
// ============================================================
app.get("/api/buyTicket", (req, res) => {
  const count = parseInt(req.query.count) || 1;
  let available = tickets.filter((t) => !t.sold);
  if (available.length < count) {
    regenerateTickets();
    available = tickets.filter((t) => !t.sold);
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

// ============================================================
// 🪙 ROUTES API PILE OU FACE
// ============================================================
app.get("/api/buyPOF", (req, res) => {
  const count = parseInt(req.query.count) || 1;
  let available = pofTickets.filter((t) => !t.sold);
  if (available.length < count) {
    regeneratePOFTickets();
    available = pofTickets.filter((t) => !t.sold);
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

// ============================================================
// 🌐 PAGES WEB
// ============================================================
app.get("/tierce", (req, res) => res.sendFile(path.join(__dirname, "public", "tierce.html")));
app.get("/ticket", (req, res) => res.sendFile(path.join(__dirname, "public", "ticket.html")));
app.get("/pof", (req, res) => res.sendFile(path.join(__dirname, "public", "pof.html")));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/", (req, res) => res.redirect("/ticket"));

// ============================================================
// 🚀 LANCEMENT DU SERVEUR
// ============================================================
loadTickets();
saveTierce();

app.listen(PORT, () => {
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
});
