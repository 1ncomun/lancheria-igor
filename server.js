/**
 * server.js — Backend Completo G&G Lanches
 * ─────────────────────────────────────────
 * INSTALAÇÃO:
 *   npm install express mercadopago cors dotenv better-sqlite3 ws
 *
 * RODAR:
 *   node server.js
 *
 * PAINEL ADMIN:
 *   http://localhost:3001/admin
 */

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const { WebSocketServer } = require('ws');
const Database   = require('better-sqlite3');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const path       = require('path');
const crypto     = require('crypto');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3001;

// ── MERCADOPAGO ──────────────────────────────────────
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-SUA-ACCESS-TOKEN-AQUI',
  options: { timeout: 5000 },
});
const mpPayment = new Payment(client);

// ── BANCO DE DADOS SQLite ────────────────────────────
const db = new Database('pedidos.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS pedidos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    mp_id         TEXT,
    status        TEXT    DEFAULT 'pending',
    status_label  TEXT    DEFAULT 'Aguardando PIX',
    nome          TEXT,
    email         TEXT,
    telefone      TEXT,
    total         REAL,
    descricao     TEXT,
    itens         TEXT,
    qr_code       TEXT,
    criado_em     DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
console.log('✅ Banco SQLite pronto (pedidos.db)');

// ── WEBSOCKET ────────────────────────────────────────
const wss = new WebSocketServer({ server });
const wsClients = new Set();
wss.on('connection', ws => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
  console.log(`🔌 Painel conectado (${wsClients.size} abertos)`);
});

function broadcast(event, data) {
  const msg = JSON.stringify({ event, data });
  wsClients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}

// ── MIDDLEWARES ──────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(__dirname));

// ════════════════════════════════════════════════════
// ROTAS PIX
// ════════════════════════════════════════════════════

// POST /api/criar-pix
app.post('/api/criar-pix', async (req, res) => {
  const { amount, description, email, nome, sobrenome, telefone, itens } = req.body;

  if (!amount || isNaN(amount) || Number(amount) <= 0)
    return res.status(400).json({ message: 'Valor inválido.' });
  if (!email || !email.includes('@'))
    return res.status(400).json({ message: 'E-mail inválido.' });

  const idempotencyKey = req.headers['x-idempotency-key'] || crypto.randomUUID();

  try {
    const result = await mpPayment.create({
      body: {
        transaction_amount: Number(Number(amount).toFixed(2)),
        description:        description || 'Pedido G&G Lanches',
        payment_method_id:  'pix',
        payer: {
          email,
          first_name: nome      || 'Cliente',
          last_name:  sobrenome || 'Anônimo',
        },
      },
      requestOptions: { idempotencyKey },
    });

    const txData = result.point_of_interaction?.transaction_data;

    // Salvar no banco
    const nomeCompleto = `${nome || ''} ${sobrenome || ''}`.trim() || 'Cliente';
    const info = db.prepare(`
      INSERT INTO pedidos (mp_id, status, status_label, nome, email, telefone, total, descricao, itens, qr_code)
      VALUES (?, 'pending', 'Aguardando PIX ⏳', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(result.id), nomeCompleto, email, telefone || '',
      Number(amount), description || '',
      JSON.stringify(itens || []), txData?.qr_code || ''
    );

    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(info.lastInsertRowid);
    broadcast('novo_pedido', { ...pedido, itens: itens || [] });

    return res.json({
      id:                 result.id,
      pedido_id:          info.lastInsertRowid,
      status:             result.status,
      qr_code:            txData?.qr_code        || '',
      qr_code_base64:     txData?.qr_code_base64 || '',
      date_of_expiration: result.date_of_expiration || null,
    });

  } catch (err) {
    console.error('Erro MP criar PIX:', err?.cause || err.message);
    return res.status(500).json({
      message: 'Erro ao criar pagamento PIX.',
      detail:  err?.cause?.[0]?.description || err.message,
    });
  }
});

// GET /api/status-pix?id=MP_ID
app.get('/api/status-pix', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ message: 'ID não informado.' });

  try {
    const result = await mpPayment.get({ id: Number(id) });

    if (result.status === 'approved') {
      db.prepare(`
        UPDATE pedidos SET status='approved', status_label='Pago ✓ — Em preparo 🔥', atualizado_em=CURRENT_TIMESTAMP
        WHERE mp_id=?
      `).run(String(id));
      const pedido = db.prepare('SELECT * FROM pedidos WHERE mp_id=?').get(String(id));
      if (pedido) {
        try { pedido.itens = JSON.parse(pedido.itens); } catch { pedido.itens = []; }
        broadcast('pedido_pago', pedido);
      }
    }

    return res.json({ id: result.id, status: result.status, status_detail: result.status_detail });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao consultar status.' });
  }
});

// POST /api/webhook  (configurar no painel MP)
app.post('/api/webhook', async (req, res) => {
  const { type, data } = req.body;
  if (type === 'payment' && data?.id) {
    try {
      const result = await mpPayment.get({ id: Number(data.id) });
      const labels = { approved:'Pago ✓ — Em preparo 🔥', rejected:'Rejeitado ❌', cancelled:'Cancelado ❌' };
      const label  = labels[result.status] || result.status;
      db.prepare(`
        UPDATE pedidos SET status=?, status_label=?, atualizado_em=CURRENT_TIMESTAMP WHERE mp_id=?
      `).run(result.status, label, String(data.id));
      const pedido = db.prepare('SELECT * FROM pedidos WHERE mp_id=?').get(String(data.id));
      if (pedido) { try { pedido.itens = JSON.parse(pedido.itens); } catch {} broadcast('pedido_atualizado', pedido); }
    } catch (err) { console.error('[Webhook]', err.message); }
  }
  res.sendStatus(200);
});

// ════════════════════════════════════════════════════
// ROTAS PAINEL ADMIN
// ════════════════════════════════════════════════════

// GET /api/pedidos?status=approved&data=2025-01-01
app.get('/api/pedidos', (req, res) => {
  const { status, data } = req.query;
  let query = 'SELECT * FROM pedidos WHERE 1=1';
  const params = [];
  if (status && status !== 'todos') { query += ' AND status=?'; params.push(status); }
  if (data)                         { query += ' AND DATE(criado_em)=?'; params.push(data); }
  query += ' ORDER BY criado_em DESC LIMIT 300';
  const pedidos = db.prepare(query).all(...params);
  pedidos.forEach(p => { try { p.itens = JSON.parse(p.itens); } catch { p.itens = []; } });
  res.json(pedidos);
});

// PATCH /api/pedidos/:id/status
app.patch('/api/pedidos/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const labels = {
    pending:    'Aguardando PIX ⏳',
    approved:   'Pago ✓ — Em preparo 🔥',
    em_preparo: 'Em preparo 🔥',
    pronto:     'Pronto para retirada ✅',
    entregue:   'Entregue 🛵',
    cancelado:  'Cancelado ❌',
  };
  const label = labels[status] || status;
  db.prepare(`UPDATE pedidos SET status=?, status_label=?, atualizado_em=CURRENT_TIMESTAMP WHERE id=?`).run(status, label, id);
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id=?').get(id);
  try { pedido.itens = JSON.parse(pedido.itens); } catch { pedido.itens = []; }
  broadcast('pedido_atualizado', pedido);
  res.json(pedido);
});

// GET /api/resumo
app.get('/api/resumo', (req, res) => {
  const hoje = new Date().toISOString().split('T')[0];
  const totalDia  = db.prepare(`SELECT COALESCE(SUM(total),0) as total, COUNT(*) as qtd FROM pedidos WHERE DATE(criado_em)=? AND status='approved'`).get(hoje);
  const pendentes = db.prepare(`SELECT COUNT(*) as qtd FROM pedidos WHERE DATE(criado_em)=? AND status='pending'`).get(hoje);
  const semana    = db.prepare(`SELECT DATE(criado_em) as dia, COALESCE(SUM(total),0) as total, COUNT(*) as qtd FROM pedidos WHERE criado_em>=DATE('now','-6 days') AND status='approved' GROUP BY dia ORDER BY dia`).all();
  res.json({ totalDia, pendentes, semana });
});

// Serve admin.html
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ── START ────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🍔 G&G Lanches → http://localhost:${PORT}`);
  console.log(`🖥️  Painel admin → http://localhost:${PORT}/admin\n`);
  if (!process.env.MP_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN.includes('SUA-ACCESS'))
    console.warn('⚠️  Configure MP_ACCESS_TOKEN no .env\n');
});
