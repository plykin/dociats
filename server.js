require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const LEADS_FILE = path.join(__dirname, 'leads.json');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Helper: read leads file
function readLeads() {
  if (!fs.existsSync(LEADS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

// Helper: write leads file
function writeLeads(leads) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
}

// Helper: send email notification
async function sendNotification(lead) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !NOTIFY_EMAIL) return;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT) || 587,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: SMTP_USER,
    to: NOTIFY_EMAIL,
    subject: `Neuer Lead: ${lead.vorname} ${lead.nachname}`,
    text: JSON.stringify(lead, null, 2),
    html: `<h2>Neuer Docia Lead</h2><pre>${JSON.stringify(lead, null, 2)}</pre>`,
  });
}

// POST /api/leads — save lead
app.post('/api/leads', async (req, res) => {
  const lead = { timestamp: new Date().toISOString(), ...req.body };

  const leads = readLeads();
  leads.push(lead);
  writeLeads(leads);

  // Fire-and-forget email notification
  sendNotification(lead).catch(err => console.error('Email error:', err));

  res.json({ success: true });
});

// GET /api/leads — basic auth protected
app.get('/api/leads', (req, res) => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'changeme';

  const authHeader = req.headers['authorization'] || '';
  const base64 = authHeader.replace('Basic ', '');
  let user = '', pass = '';
  try {
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    [user, pass] = decoded.split(':');
  } catch {}

  if (user !== adminUser || pass !== adminPass) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Docia Leads"');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.json(readLeads());
});

app.listen(PORT, () => {
  console.log(`Docia funnel running at http://localhost:${PORT}`);
});
