// server.js (izrezak)
import express from 'express';
import { auth } from 'express-openid-connect';
import { expressjwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import bodyParser from 'body-parser';
import { Pool } from 'pg';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
import { expressjwt as jwt } from 'express-jwt';
import jwks from 'jwks-rsa';
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});


const oidcConfig = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.SESSION_SECRET,
  baseURL: process.env.BASE_URL,
  clientID: process.env.AUTH0_CLIENT_ID,
  issuerBaseURL: process.env.AUTH0_DOMAIN
};

app.use(auth(oidcConfig)); 


const checkM2M = jwt({
  secret: jwks.expressJwtSecret({
    jwksUri: `${process.env.AUTH0_ISSUER_BASE_URL}/.well-known/jwks.json`,
    cache: true,
    rateLimit: true
  }),
  audience: process.env.AUTH0_AUDIENCE,
  issuer: `${process.env.AUTH0_ISSUER_BASE_URL}/`,
  algorithms: ['RS256']
});


async function getActiveRound(client = pool) {
  // aktivna runda - zadnji redak koji nema closed_time
 // const { rows } = await client.query('SELECT * FROM rounds WHERE numbers IS NULL ORDER BY opened_time DESC LIMIT 1');
  const { rows } = await client.query('SELECT * FROM rounds WHERE closed_time IS NULL ORDER BY opened_time DESC LIMIT 1');
  return rows[0] || null;
}
async function getLastRound(client = pool) {
  // zadnja runda = zadnji redak neovisno jel otvoreno il zatovreno kolo
  const { rows } = await client.query('SELECT * FROM rounds ORDER BY opened_time DESC LIMIT 1');
  return rows[0] || null;
}

function parseNumbers(input) {
  if (Array.isArray(input)) return input.map(Number);
  return String(input).split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => Number(s));
}

app.get('/user', (req, res) => {
  if (req.oidc && req.oidc.isAuthenticated()) {
    res.json(req.oidc.user);
  } else {
    res.status(401).json({ error: 'Treba biti prijavljen' });
  }
});
//za glavnu stranicu status kola 
app.get('/api/status', async (req, res) => {
  try {
    //zadnja runda
    const roundResult = await pool.query(
      'SELECT id, closed_time, numbers FROM rounds ORDER BY id DESC LIMIT 1'
    );

    if (roundResult.rows.length === 0) {
      return res.json({
        roundActive: false,
        ticketCount: 0,
        drawnNumbers: []
      });
    }

    const round = roundResult.rows[0];

   
    const roundActive = round.closed_time === null;

    //broj uplata ovog kola
    const ticketResult = await pool.query(
      'SELECT COUNT(*) FROM tickets WHERE round_id = $1',
      [round.id]
    );

    res.json({
      roundActive,
      ticketCount: parseInt(ticketResult.rows[0].count, 10),
      drawnNumbers: round.numbers || []
    });
  } catch (err) {
    console.error('Greska:', err);
    res.status(500).json({ error: 'Greska s bazom podataka' });
  }
});

//za spremanje tiketa
app.post('/api/ticket', async (req, res) => {
  if (!req.oidc.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });

  const { cardNumber, numbers } = req.body; 

  let nums = parseNumbers(numbers)


  const client = await pool.connect();
  try {
    const active = await getActiveRound(client);
    if (!active) return res.status(400).json({ error: 'Kolo nije aktivirano' });

    const inserted = await client.query(
      `INSERT INTO tickets (round_id, card_number, numbers) VALUES ($1,$2,$3) RETURNING id`,
      [active.id, cardNumber, nums]
    );
    const ticketId = inserted.rows[0].id;

   
    const ticketUrl = `${process.env.BASE_URL}/ticket/${ticketId}`;
    const qr = await QRCode.toBuffer(ticketUrl, { type: 'png' });

    res.set('Content-Type', 'image/png');
    return res.status(201).send(qr);
  } finally {
    client.release();
  }
});

//za podatke o odredenom tiketu
app.get('/api/ticket/:id', async (req, res) => {
  const id = req.params.id;
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT t.id, t.card_number, t.numbers as ticket_numbers, r.numbers as drawn_numbers, r.opened_time, r.closed_time FROM tickets t LEFT JOIN rounds r ON t.round_id = r.id WHERE t.id = $1', [id]);
    if (!rows[0]) return res.status(404).send('Ne postoji uplata s tim identifikatorom.');
    // return JSON or render HTML
    res.json(rows[0]);
  } finally {
    client.release();
  }
});
//za pregled odredenog tiketa
app.get('/ticket/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ticket.html'));
});

//ADMIN RUTE M2M
//za aktiviranje novog kola 
app.post('/new-round', checkM2M, async (req, res) => {
//app.post('/new-round', checkM2M, requireMachineScope, async (req, res) => {
  const client = await pool.connect();
  try {
    // start a new round only if current active round is null or closed
    const active = await getActiveRound(client);
    if (!active) {
      await client.query('INSERT INTO rounds DEFAULT VALUES');
    } else {
      // if active exists, do nothing
    }
    res.sendStatus(204);
  } finally { client.release(); }
});
//za deaktiviranje kola
//app.post('/close', async (req, res) => {
app.post('/close', checkM2M, async (req, res) => {
  const client = await pool.connect();
  try {
    const active = await getActiveRound(client);
    if (!active) { //ak je vec deaktivirano
      return res.sendStatus(204); 
    }
    // stavlja da je zatvoreno
    await client.query('UPDATE rounds SET closed_time = now() WHERE id=$1', [active.id]);
   // res.redirect('/');
    res.sendStatus(204);
  } finally { client.release(); }
});
//za izvlacenje brojeva za kolo
app.post('/store-results', checkM2M, async (req, res) => {
//app.post('/store-results', checkM2M, requireMachineScope, async (req, res) => {

  const numbers = req.body && req.body.numbers;
  if (!Array.isArray(numbers)) return res.status(400).json({ error: 'treba upisati listu brojeva' });

  const client = await pool.connect();
  try {
    const active = await getLastRound(client);
    if (!active) return res.status(400).json({ error: 'Nema kola za izvlacenje' });
    if (active.numbers && active.numbers.length > 0) return res.status(400).json({ error: 'Brojevi su vec izvuceni za ovo kolo' });
    if (!active.closed_time) return res.status(400).json({ error: 'Kolo mora biti deaktivirano kako bi se brojevi mogli izvuci' });

    await client.query('UPDATE rounds SET numbers=$1 WHERE id=$2', [numbers, active.id]);
    return res.sendStatus(204);
  } finally { client.release(); }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server running on', port));
