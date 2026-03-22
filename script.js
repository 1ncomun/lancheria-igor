/* ═══════════════════════════════════════════════════
   script.js — Lanches Gabriel & Gabriela
   Carrinho + Integração PIX via backend Node/Express
   ═══════════════════════════════════════════════════ */

// ── 1. DADOS DO CARDÁPIO ────────────────────────────
const CARDAPIO = {
  lanches: [
    { id: 'xsal',  nome: 'X-Salada',    preco: 10.00 },
    { id: 'xmai',  nome: 'X-Maionese',  preco: 10.00 },
    { id: 'xbac',  nome: 'X-Bacon',     preco: 18.00 },
    { id: 'xcal',  nome: 'X-Calabresa', preco: 18.00 },
    { id: 'xsal2', nome: 'X-Salsicha',  preco: 14.00 },
    { id: 'mist',  nome: 'Misto Quente',preco: 8.00  },
    { id: 'mdup',  nome: 'Misto Duplo', preco: 9.00  },
    { id: 'xtud',  nome: 'X-Tudo',      preco: 22.00 },
  ],
  cachorros: [
    { id: 'ksim', nome: 'Kikão Simples',           preco: 8.00  },
    { id: 'kque', nome: 'Kikão c/ Queijo',          preco: 12.00 },
    { id: 'kbac', nome: 'Kikão c/ Bacon',           preco: 14.00 },
    { id: 'kbq',  nome: 'Kikão c/ Bacon e Queijo',  preco: 15.00 },
  ],
  pasteis: [
    { id: 'psim', nome: 'Pastel Simples',  preco: 6.00, sub: 'Banana c/ queijo · Mistão · Queijo' },
    { id: 'pesp', nome: 'Pastel Especial', preco: 6.00, sub: 'Banana c/ queijo · Mistão · Queijo · Pizza · Frango c/ catupiry' },
  ],
  batata: [
    { id: 'bmed', nome: 'Batata Média',  preco: 12.00 },
    { id: 'bgra', nome: 'Batata Grande', preco: 14.00 },
  ],
  salgados: [
    { id: 'stri', nome: 'Salgado de Trigo',    preco: 6.00, sub: 'Frango · Carne · Presunto e queijo · Salsicha · Ovo coberto' },
    { id: 'smac', nome: 'Salgado de Macaxeira', preco: 6.00, sub: 'Frango · Carne · Presunto e queijo · Salsicha · Ovo coberto' },
  ],
};

const COMBOS = [
  { id: 'c2xs',  nome: '2 X-Salada + Pet 1,5L',         preco: 25.00, badge: 'Combo' },
  { id: 'c3xs',  nome: '3 X-Salada + Pet 1,5L',         preco: 30.00, badge: 'Combo' },
  { id: 'c4xs',  nome: '4 X-Salada + Pet 1,5L',         preco: 40.00, badge: 'Combo' },
  { id: 'c5xs',  nome: '5 X-Salada + Pet 1,5L',         preco: 50.00, badge: 'Combo' },
  { id: 'c3k',   nome: '3 Kikão',                        preco: 23.00, badge: 'Combo' },
  { id: 'c3kp',  nome: '3 Kikão + Pet 1,5L',            preco: 26.00, badge: 'Combo' },
  { id: 'c4kp',  nome: '4 Kikão + Pet 1,5L',            preco: 33.00, badge: 'Combo' },
  { id: 'c5kp',  nome: '5 Kikão + Pet 1,5L',            preco: 44.00, badge: 'Combo' },
  { id: 'c6kp',  nome: '6 Kikão + Pet 1,5L',            preco: 50.00, badge: 'Combo' },
  { id: 'c7kp',  nome: '7 Kikão + Pet 1,5L',            preco: 58.00, badge: 'Combo' },
  { id: 'c8kp',  nome: '8 Kikão + Pet 1,5L',            preco: 66.00, badge: 'Combo' },
  { id: 'c9kp',  nome: '9 Kikão + Pet 1,5L',            preco: 74.00, badge: 'Combo' },
  { id: 'c10k',  nome: '10 Kikão + Pet 1,5L',           preco: 82.00, badge: 'Combo' },
  { id: 'trio1', nome: '1 X-Salada + Batata (M) + Lata', preco: 26.00, badge: 'Trio'  },
  { id: 'trio2', nome: '1 X-Salada + Pastel + Lata',     preco: 20.00, badge: 'Trio'  },
  { id: 'trio3', nome: '1 Kikão + Salgado + Lata',       preco: 18.00, badge: 'Trio'  },
];

const SUCOS = [
  { id: 's250', tamanho: '250ml',  preco: 7.00  },
  { id: 's300', tamanho: '300ml',  preco: 8.00  },
  { id: 's400', tamanho: '400ml',  preco: 10.00 },
  { id: 's500', tamanho: '500ml',  preco: 12.00 },
  { id: 's1l',  tamanho: '1 Litro',preco: 22.00 },
];

// ── 2. CARRINHO ─────────────────────────────────────
let carrinho = {};

function formatBRL(v) { return 'R$ ' + v.toFixed(2).replace('.', ','); }
function totalCarrinho() { return Object.values(carrinho).reduce((s, { item, qty }) => s + item.preco * qty, 0); }

function adicionarItem(item) {
  carrinho[item.id] ? carrinho[item.id].qty++ : (carrinho[item.id] = { item, qty: 1 });
  renderCarrinho();
  const btn = document.getElementById('add-' + item.id);
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ Adicionado!';
    btn.classList.add('bg-green-600');
    btn.classList.remove('bg-red-700');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('bg-green-600'); btn.classList.add('bg-red-700'); }, 1200);
  }
}

function removerItem(id) { delete carrinho[id]; renderCarrinho(); }
function alterarQty(id, delta) {
  if (!carrinho[id]) return;
  carrinho[id].qty += delta;
  if (carrinho[id].qty <= 0) delete carrinho[id];
  renderCarrinho();
}
function limparCarrinho() { carrinho = {}; renderCarrinho(); esconderPix(); }

function renderCarrinho() {
  const itens = Object.values(carrinho);
  document.getElementById('nav-count').textContent = itens.reduce((s, { qty }) => s + qty, 0);
  if (itens.length === 0) {
    document.getElementById('cart-empty').classList.remove('hidden');
    document.getElementById('cart-content').classList.add('hidden');
    return;
  }
  document.getElementById('cart-empty').classList.add('hidden');
  document.getElementById('cart-content').classList.remove('hidden');
  document.getElementById('cart-total-display').textContent = formatBRL(totalCarrinho());
  document.getElementById('cart-items').innerHTML = itens.map(({ item, qty }) => `
    <div class="bg-[#1e1e1e] border border-white/5 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
      <div class="flex-1">
        <p class="font-bold text-sm text-white">${item.nome}</p>
        <p class="text-yellow-400 text-xs font-black mt-0.5">${formatBRL(item.preco)} cada</p>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="alterarQty('${item.id}',-1)" class="w-8 h-8 rounded-lg bg-[#111] border border-white/10 text-white/70 hover:text-red-400 font-bold transition text-sm">−</button>
        <span class="w-6 text-center font-black text-white">${qty}</span>
        <button onclick="alterarQty('${item.id}',1)"  class="w-8 h-8 rounded-lg bg-[#111] border border-white/10 text-white/70 hover:text-green-400 font-bold transition text-sm">+</button>
        <button onclick="removerItem('${item.id}')" class="ml-2 text-white/20 hover:text-red-400 transition text-lg leading-none">✕</button>
      </div>
      <div class="text-right min-w-[70px]">
        <p class="font-black text-white">${formatBRL(item.preco * qty)}</p>
      </div>
    </div>`).join('');
}

// ── 3. RENDERIZAR CARDÁPIO ──────────────────────────
function criarCard(item, tipo = 'normal') {
  const sub   = item.sub   ? `<p class="text-white/30 text-xs mt-1 leading-relaxed">${item.sub}</p>` : '';
  const badge = item.badge ? `<span class="inline-block bg-red-700 text-white text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded mb-1">${item.badge}</span>` : '';
  const itemStr = JSON.stringify(item).replace(/"/g, "'");

  if (tipo === 'suco') return `
    <div class="bg-[#1e1e1e] border border-white/5 rounded-xl p-5 text-center hover:border-yellow-400/30 hover:-translate-y-1 transition">
      <p class="bebas text-3xl text-yellow-400">${item.tamanho}</p>
      <p class="font-black text-white mt-1">${formatBRL(item.preco)}</p>
      <p class="text-white/30 text-xs mt-1">Maracujá · Goiaba · Graviola</p>
      <button id="add-${item.id}" onclick="adicionarItem(${itemStr})"
        class="mt-3 w-full bebas tracking-widest bg-red-700 hover:bg-red-600 text-white text-sm py-2 rounded-lg transition">+ Adicionar</button>
    </div>`;

  return `
    <div class="bg-[#1e1e1e] border border-white/5 rounded-xl p-5 flex flex-col justify-between hover:border-red-700/40 hover:-translate-y-1 transition" style="border-left:3px solid #C8000A">
      <div>${badge}<p class="font-bold text-sm text-white">${item.nome}</p>${sub}</div>
      <div class="mt-4 flex items-center justify-between gap-2">
        <span class="bebas text-xl text-yellow-400">${formatBRL(item.preco)}</span>
        <button id="add-${item.id}" onclick="adicionarItem(${itemStr})"
          class="bebas tracking-widest bg-red-700 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg transition whitespace-nowrap">+ Adicionar</button>
      </div>
    </div>`;
}

function renderCardapio() {
  Object.entries(CARDAPIO).forEach(([cat, itens]) => {
    document.getElementById('cat-' + cat).innerHTML = itens.map(i => criarCard(i)).join('');
  });
  document.getElementById('combos-grid').innerHTML = COMBOS.map(i => criarCard(i)).join('');
  document.getElementById('sucos-grid').innerHTML  = SUCOS.map(i => criarCard(i, 'suco')).join('');
}

// ── 4. TABS ─────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('bg-red-700','border-red-700','text-white');
        b.classList.add('border-white/10','text-white/50');
      });
      document.querySelectorAll('.menu-cat').forEach(c => c.classList.add('hidden'));
      btn.classList.add('bg-red-700','border-red-700','text-white');
      btn.classList.remove('border-white/10','text-white/50');
      document.getElementById('cat-' + btn.dataset.cat).classList.remove('hidden');
    });
  });
}

// ── 5. PIX ───────────────────────────────────────────
let pixPaymentId   = null;
let pollingTimer   = null;
let countdownTimer = null;
let pixCodigoAtual = '';

// ⚠️ SUBSTITUA pela sua Public Key TEST-
const MP_PUBLIC_KEY = 'TEST-cb0fc43a-2170-42f2-8164-354ff01c2d4a';
const BACKEND_URL   = 'http://localhost:3001';

async function iniciarPix() {
  const email    = document.getElementById('pix-email').value.trim();
  const nomeCompleto = document.getElementById('pix-nome').value.trim();
  const telefone = document.getElementById('pix-telefone').value.trim();

  if (!email || !email.includes('@')) { mostrarErro('Informe um e-mail válido.'); return; }
  if (totalCarrinho() <= 0)           { mostrarErro('Seu carrinho está vazio.');  return; }

  esconderPix();
  document.getElementById('form-pagamento').classList.add('hidden');
  document.getElementById('pix-loading').classList.remove('hidden');
  document.getElementById('pix-erro').classList.add('hidden');

  const amount   = totalCarrinho();
  const nomeParts = nomeCompleto.split(' ');
  const nome     = nomeParts[0] || 'Cliente';
  const sobrenome = nomeParts.slice(1).join(' ') || 'Anônimo';

  // Monta lista de itens para o painel
  const itens = Object.values(carrinho).map(({ item, qty }) => ({ id: item.id, nome: item.nome, preco: item.preco, qty }));
  const itensList = itens.map(i => `${i.qty}x ${i.nome}`).join(', ');
  const description = `Pedido G&G — ${itensList}`;

  try {
    const resp = await fetch(`${BACKEND_URL}/api/criar-pix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ amount, description, email, nome, sobrenome, telefone, itens }),
    });

    if (!resp.ok) { const e = await resp.json().catch(()=>({})); throw new Error(e.message || `Erro ${resp.status}`); }

    const data = await resp.json();
    pixPaymentId   = data.id;
    pixCodigoAtual = data.qr_code;

    document.getElementById('pix-loading').classList.add('hidden');
    mostrarQR(data, amount);
    iniciarPolling();
    iniciarCountdown(30 * 60);

  } catch (err) {
    document.getElementById('pix-loading').classList.add('hidden');
    document.getElementById('form-pagamento').classList.remove('hidden');
    mostrarErro('Erro ao criar PIX: ' + err.message);
  }
}

function mostrarQR(data, amount) {
  document.getElementById('pix-result').classList.remove('hidden');
  const qrImg = document.getElementById('pix-qr-img');
  qrImg.src = data.qr_code_base64
    ? 'data:image/png;base64,' + data.qr_code_base64
    : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.qr_code)}`;
  document.getElementById('pix-code-text').textContent    = data.qr_code;
  document.getElementById('pix-valor-display').textContent = formatBRL(amount);
}

async function copiarPix() {
  if (!pixCodigoAtual) return;
  try { await navigator.clipboard.writeText(pixCodigoAtual); }
  catch { const e=document.createElement('textarea'); e.value=pixCodigoAtual; document.body.appendChild(e); e.select(); document.execCommand('copy'); document.body.removeChild(e); }
  document.getElementById('copy-icon').textContent  = '✅';
  document.getElementById('copy-label').textContent = 'Copiado!';
  setTimeout(() => { document.getElementById('copy-icon').textContent='📋'; document.getElementById('copy-label').textContent='Copiar Código PIX'; }, 2500);
}

function iniciarCountdown(segundos) {
  clearInterval(countdownTimer);
  let restante = segundos;
  const el = document.getElementById('pix-timer');
  countdownTimer = setInterval(() => {
    restante--;
    el.textContent = `${String(Math.floor(restante/60)).padStart(2,'0')}:${String(restante%60).padStart(2,'0')}`;
    if (restante <= 0) { clearInterval(countdownTimer); el.textContent='Expirado'; pararPolling(); }
  }, 1000);
}

function iniciarPolling() {
  pararPolling();
  pollingTimer = setInterval(verificarStatus, 8000);
}
function pararPolling() { if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; } }

async function verificarStatus() {
  if (!pixPaymentId) return;
  try {
    const resp = await fetch(`${BACKEND_URL}/api/status-pix?id=${pixPaymentId}`);
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.status === 'approved') { pararPolling(); clearInterval(countdownTimer); mostrarSucesso(); }
    else if (['cancelled','rejected'].includes(data.status)) { pararPolling(); mostrarErro('Pagamento cancelado/rejeitado. Tente novamente.'); }
  } catch {}
}

function mostrarSucesso() {
  document.getElementById('pix-result').classList.add('hidden');
  document.getElementById('pix-sucesso').classList.remove('hidden');
  carrinho = {}; renderCarrinho();
}
function mostrarErro(msg) {
  document.getElementById('pix-erro-msg').textContent = '⚠️ ' + msg;
  document.getElementById('pix-erro').classList.remove('hidden');
}
function esconderPix() {
  ['pix-result','pix-sucesso','pix-loading','pix-erro'].forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('form-pagamento').classList.remove('hidden');
  pararPolling(); clearInterval(countdownTimer);
  pixPaymentId = null; pixCodigoAtual = '';
}
function novosPedido() { esconderPix(); window.scrollTo({ top:0, behavior:'smooth' }); }

// ── INIT ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderCardapio();
  renderCarrinho();
  initTabs();
});
