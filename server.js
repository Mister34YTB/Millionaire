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
// Gestion des tickets
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

let tickets = [];

function regenerateTickets() {
  tickets = [];
  let id = 1;
  distribution.forEach(d => {
    for (let i = 0; i < d.count; i++) {
      tickets.push({
        id: String(id).padStart(3, "0"), // 001, 002...
        gain: d.gain,
        sold: false,
        used: false,
        code: null // généré seulement à l’achat
      });
      id++;
    }
  });
  shuffle(tickets);
  saveTickets();
}

function loadTickets() {
  if (fs.existsSync(TICKET_FILE)) {
    tickets = JSON.parse(fs.readFileSync(TICKET_FILE, "utf8"));
  } else {
    regenerateTickets();
  }
}

function saveTickets() {
  fs.writeFileSync(TICKET_FILE, JSON.stringify(tickets, null, 2));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// --------------------
// API
// --------------------

// Achat ticket (appelé par le bot)
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
    const t = available.pop();
    t.sold = true;
    // Génère un code à 4 chiffres
    t.code = Math.floor(1000 + Math.random() * 9000).toString();
    bought.push({ id: t.id, code: t.code });
  }

  saveTickets();
  res.json({ tickets: bought });
});

// Vérification ticket (joueur)
app.get("/api/ticket/:id", (req, res) => {
  const { code } = req.query;
  const t = tickets.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });

  if (!code || t.code !== code) {
    return res.status(403).json({ error: "Code invalide" });
  }

  res.json({
    id: t.id,
    gain: t.gain,
    sold: t.sold,
    used: t.used
  });
});

// Marquer ticket comme utilisé
app.post("/api/useTicket/:id", (req, res) => {
  const { code } = req.body;
  const t = tickets.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  if (t.code !== code) return res.status(403).json({ error: "Code invalide" });

  t.used = true;
  saveTickets();
  res.json({ success: true, message: "Ticket marqué comme utilisé" });
});

// Vérification admin (pas besoin de code)
app.get("/api/admin/checkTicket/:id", (req, res) => {
  const t = tickets.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });

  res.json({
    id: t.id,
    gain: t.gain,
    sold: t.sold,
    used: t.used,
    code: t.code
  });
});

// --------------------
// Pages web
// --------------------
app.get("/ticket", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "ticket.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/", (req, res) => {
  res.redirect("/ticket");
});

// --------------------
loadTickets();
app.listen(PORT, () =>
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`)
);
