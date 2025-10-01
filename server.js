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
// Millionaire
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
  // ⚠️ pas de "0"
];

const WIN_PROB = 1 / 8; // ✅ 1 chance sur 8 de gagner

let tickets = [];
let pofTickets = [];

// --------------------
// Fonctions utilitaires
// --------------------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

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

function regeneratePOFTickets() {
  pofTickets = [];

  for (let i = 0; i < 5000; i++) {
    const ticketType = Math.random() < 0.5 ? "PILE" : "FACE";
    let revealed, gain = "0";

    if (Math.random() < WIN_PROB) {
      // ✅ Ticket gagnant
      revealed = ticketType;

      // Tirer un gain dans la distribution
      const pool = [];
      POF_DISTRIBUTION.forEach(d => {
        for (let j = 0; j < d.count; j++) pool.push(d.gain);
      });
      shuffle(pool);
      gain = pool[Math.floor(Math.random() * pool.length)];
    } else {
      // ❌ Ticket perdant
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
}

// --------------------
// API Millionaire
// --------------------
app.get("/api/buyTicket", (req, res) => {
  const count = parseInt(req.query.count) || 1;
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

app.get("/api/pof/ticket/:id", (req, res) => {
  const { code } = req.query;
  const t = pofTickets.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  if (!code || t.code !== code) return res.status(403).json({ error: "Code invalide" });

  let realGain = "PERDU";
  if (t.type === t.revealed && t.gain !== "0") {
    realGain = t.gain;
  }

  res.json({
    id: t.id,
    type: t.type,
    revealed: t.revealed,
    gain: realGain,
    sold: t.sold,
    used: t.used,
    code: t.code
  });
});

// Marquer un ticket POF comme utilisé
app.post("/api/pof/use/:id", (req, res) => {
  const { code } = req.body;
  const t = pofTickets.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  if (t.code !== code) return res.status(403).json({ error: "Code invalide" });

  t.used = true;
  fs.writeFileSync(POF_FILE, JSON.stringify(pofTickets, null, 2));
  res.json({ success: true, message: "Ticket marqué comme utilisé" });
});

// --------------------
// Pages web
// --------------------
app.get("/ticket", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "ticket.html"));
});

app.get("/pof", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pof.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/", (req, res) => {
  res.redirect("/ticket");
});

// --------------------
// Admin
// --------------------
app.get("/api/admin/checkTicket/:id", (req, res) => {
  const t = tickets.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  res.json(t);
});

app.get("/api/admin/checkPOF/:id", (req, res) => {
  const t = pofTickets.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });

  let realGain = "PERDU";
  if (t.type === t.revealed && t.gain !== "0") {
    realGain = t.gain;
  }

  res.json({
    id: t.id,
    type: t.type,
    revealed: t.revealed,
    gain: realGain,
    sold: t.sold,
    used: t.used,
    code: t.code
  });
});

app.post("/api/admin/reset", (req, res) => {
  regenerateTickets();
  regeneratePOFTickets();
  res.json({ success: true, message: "🎟️ Inventaire réinitialisé." });
});

// --------------------
loadTickets();
app.listen(PORT, () =>
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`)
);
