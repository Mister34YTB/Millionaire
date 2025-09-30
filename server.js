const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public")); // Sert HTML/CSS/JS depuis public/

// --------------------
// Gestion des tickets
// --------------------
const TICKET_FILE = "tickets.json";

// ⚖️ Distribution : total 1000 tickets
const distribution = [
  { gain: "⭐", count: 5 },        // droit roue
  { gain: "50K€", count: 2 },     // jackpot
  { gain: "5K€", count: 10 },
  { gain: "1K€", count: 25 },
  { gain: "500€", count: 40 },
  { gain: "100€", count: 80 },
  { gain: "50€", count: 150 },
  { gain: "10€", count: 163 },    // ajusté pour total 1000
  { gain: "0", count: 525 }       // perdants
];

let tickets = [];

/**
 * Mélange tableau
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Régénère une série de 1000 tickets
 */
function regenerateTickets() {
  tickets = [];
  let id = 1;
  distribution.forEach(d => {
    for (let i = 0; i < d.count; i++) {
      tickets.push({
        id: String(id).padStart(3, "0"), // 001, 002...
        gain: d.gain,
        sold: false
      });
      id++;
    }
  });
  shuffle(tickets);
  saveTickets();
  console.log("🎟️ Nouvelle série de tickets générée (1000).");
}

/**
 * Charge tickets depuis fichier JSON
 */
function loadTickets() {
  if (fs.existsSync(TICKET_FILE)) {
    tickets = JSON.parse(fs.readFileSync(TICKET_FILE, "utf8"));
    console.log(`📂 ${tickets.length} tickets chargés.`);
  } else {
    regenerateTickets();
  }
}

/**
 * Sauvegarde tickets
 */
function saveTickets() {
  fs.writeFileSync(TICKET_FILE, JSON.stringify(tickets, null, 2));
}

// --------------------
// API
// --------------------

/**
 * Achat ticket (appelé par le bot)
 * Exemple: GET /buyTicket?count=2
 */
app.get("/buyTicket", (req, res) => {
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
    bought.push(t.id);
  }

  saveTickets();
  res.json({ tickets: bought });
});

/**
 * Vérification admin
 * Exemple: GET /checkTicket/123
 */
app.get("/checkTicket/:id", (req, res) => {
  const t = tickets.find(tt => tt.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  res.json({ id: t.id, gain: t.gain, sold: t.sold });
});

// --------------------
// Pages web
// --------------------

// Toutes les routes /ticket/... renvoient ticket.html
app.get("/ticket/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "ticket.html"));
});

/**
 * Page Admin
 */
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// --------------------
loadTickets();
app.listen(PORT, () => console.log(`✅ Serveur lancé sur http://localhost:${PORT}`));
