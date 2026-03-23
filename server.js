/**
 * server.js — Backend Completo G&G Lanches
 * ─────────────────────────────────────────
 * INSTALAÇÃO:
 *   npm install express mercadopago cors dotenv sqlite3 ws
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
const sqlite3    = require('sqlite3').verbose();
const { MercadoPagoConfig, Payment } = require('mercadopago');
const path       = require('path');
const crypto     = require('crypto');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3001;

// ── MERCADOPAGO ──────────────────────────────────────
// ✅ CORREÇÃO: removido token hardcoded — configure MP_ACCESS_TOKEN no Render
//    Painel Render → seu serviço → Environment → Add Environment Variable
if (!process.env.MP_ACCESS_TOKEN) {
  console.error('❌ ERRO: MP_ACCESS_TOKEN não definido! Configure no .env ou no painel do Render.');
  process.exit(1);
}

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
  options: { timeout: 5000 },
});
const mpPayment = new Payment(client);

// ── BANCO DE DADOS SQLite ────────────────────────────
// ✅ CORREÇÃO: trocado better-sqlite3 (falha no Render) por sqlite3 padrão
const db = new sqlite3.Database('pedidos.db', (err) => {
  if (err) { console.error('Erro ao abrir banco:', err.message); process.exit(1); }
  console.log('✅ Banco SQLite pronto (pedidos.db)');
});

// Helpers para usar sqlite3 com Promise (já que ele é assíncrono por padrão)
const dbRun = (sql, params = []) => new Promise((res, rej) =>
  db.run(sql, params, function(err) { err ? rej(err) : res(this); }));
const dbGet = (sql, params = []) => new Promise((res, rej) =>
  db.get(sql, params, (err, row) => err ? rej(err) : res(row)));
const dbAll = (sql, params = []) => new Promise((res, rej) =>
  db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));

// Criar tabela se não existir
db.serialize(() => {
  db.run(`
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
    )
  `);
});

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
    const nomeCompleto = `${nome || ''} ${sobrenome || ''}`.trim() || 'Cliente';

    const info = await dbRun(`
      INSERT INTO pedidos (mp_id, status, status_label, nome, email, telefone, total, descricao, itens, qr_code)
      VALUES (?, 'pending', 'Aguardando PIX ⏳', ?, ?, ?, ?, ?, ?, ?)
    `, [
      String(result.id), nomeCompleto, email, telefone || '',
      Number(amount), description || '',
      JSON.stringify(itens || []), txData?.qr_code || ''
    ]);

    const pedido = await dbGet('SELECT * FROM pedidos WHERE id = ?', [info.lastID]);
    broadcast('novo_pedido', { ...pedido, itens: itens || [] });

    return res.json({
      id:                 result.id,
      pedido_id:          info.lastID,
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
      await dbRun(`
        UPDATE pedidos SET status='approved', status_label='Pago ✓ — Em preparo 🔥', atualizado_em=CURRENT_TIMESTAMP
        WHERE mp_id=?
      `, [String(id)]);
      const pedido = await dbGet('SELECT * FROM pedidos WHERE mp_id=?', [String(id)]);
      if (pedido) {
        try { pedido.itens = JSON.parse(pedido.itens); } catch { pedido.itens = []; }
        broadcast('pedido_pago', pedido);
      }
    }

    return res.json({ id: result.id, status: result.status, status_detail: result.status_detail });
  } catch (err) {
    console.error('Erro MP status:', err?.cause || err.message);
    return res.status(500).json({ message: 'Erro ao consultar status.' });
  }
});

// POST /api/webhook
app.post('/api/webhook', async (req, res) => {
  const { type, data } = req.body;
  if (type === 'payment' && data?.id) {
    try {
      const result = await mpPayment.get({ id: Number(data.id) });
      const labels = { approved:'Pago ✓ — Em preparo 🔥', rejected:'Rejeitado ❌', cancelled:'Cancelado ❌' };
      const label  = labels[result.status] || result.status;
      await dbRun(`
        UPDATE pedidos SET status=?, status_label=?, atualizado_em=CURRENT_TIMESTAMP WHERE mp_id=?
      `, [result.status, label, String(data.id)]);
      const pedido = await dbGet('SELECT * FROM pedidos WHERE mp_id=?', [String(data.id)]);
      if (pedido) { try { pedido.itens = JSON.parse(pedido.itens); } catch {} broadcast('pedido_atualizado', pedido); }
    } catch (err) { console.error('[Webhook]', err.message); }
  }
  res.sendStatus(200);
});

// ════════════════════════════════════════════════════
// ROTAS PAINEL ADMIN
// ════════════════════════════════════════════════════

// GET /api/pedidos?status=approved&data=2025-01-01
app.get('/api/pedidos', async (req, res) => {
  const { status, data } = req.query;
  let query = 'SELECT * FROM pedidos WHERE 1=1';
  const params = [];
  if (status && status !== 'todos') { query += ' AND status=?'; params.push(status); }
  if (data)                         { query += ' AND DATE(criado_em)=?'; params.push(data); }
  query += ' ORDER BY criado_em DESC LIMIT 300';
  const pedidos = await dbAll(query, params);
  pedidos.forEach(p => { try { p.itens = JSON.parse(p.itens); } catch { p.itens = []; } });
  res.json(pedidos);
});

// PATCH /api/pedidos/:id/status
app.patch('/api/pedidos/:id/status', async (req, res) => {
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
  await dbRun(`UPDATE pedidos SET status=?, status_label=?, atualizado_em=CURRENT_TIMESTAMP WHERE id=?`, [status, label, id]);
  const pedido = await dbGet('SELECT * FROM pedidos WHERE id=?', [id]);
  try { pedido.itens = JSON.parse(pedido.itens); } catch { pedido.itens = []; }
  broadcast('pedido_atualizado', pedido);
  res.json(pedido);
});

// GET /api/resumo
app.get('/api/resumo', async (req, res) => {
  const hoje = new Date().toISOString().split('T')[0];
  const totalDia  = await dbGet(`SELECT COALESCE(SUM(total),0) as total, COUNT(*) as qtd FROM pedidos WHERE DATE(criado_em)=? AND status='approved'`, [hoje]);
  const pendentes = await dbGet(`SELECT COUNT(*) as qtd FROM pedidos WHERE DATE(criado_em)=? AND status='pending'`, [hoje]);
  const semana    = await dbAll(`SELECT DATE(criado_em) as dia, COALESCE(SUM(total),0) as total, COUNT(*) as qtd FROM pedidos WHERE criado_em>=DATE('now','-6 days') AND status='approved' GROUP BY dia ORDER BY dia`);
  res.json({ totalDia, pendentes, semana });
});

// Serve admin.html
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ── START ────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🍔 G&G Lanches → http://localhost:${PORT}`);
  console.log(`🖥️  Painel admin → http://localhost:${PORT}/admin\n`);
});
