# 🍔 G&G Lanches — Sistema Completo com Painel Admin

## Arquivos

| Arquivo      | Função                                              |
|--------------|-----------------------------------------------------|
| `index.html` | Site do cliente (cardápio + carrinho + PIX)         |
| `script.js`  | Lógica do carrinho, PIX, polling                    |
| `server.js`  | Backend Node/Express + SQLite + WebSocket + MP      |
| `admin.html` | Painel do comerciante (tempo real via WebSocket)    |

---

## ⚡ Instalação completa

```bash
npm init -y
npm install express mercadopago cors dotenv better-sqlite3 ws
```

## Arquivo `.env`
```
MP_ACCESS_TOKEN=TEST-sua-access-token-aqui
PORT=3001
```

## Substituir Public Key em `script.js`
```js
const MP_PUBLIC_KEY = 'TEST-sua-public-key-aqui';
```

## Rodar
```bash
node server.js
```

## Acessar
- **Site cliente** → Abrir `index.html` no navegador
- **Painel admin** → http://localhost:3001/admin

---

## 🖥️ Painel do Comerciante

Acesse `http://localhost:3001/admin` e você verá:

- **Faturamento do dia** em tempo real
- **Pedidos pagos / pendentes / ticket médio**
- **Gráfico dos últimos 7 dias**
- **Cards de pedido** com todos os itens, nome, e-mail, valor
- **Botões de status**: Em preparo 🔥 → Pronto ✅ → Entregue 🛵
- **Alertas sonoros** quando chega novo pedido
- **WebSocket** — atualização instantânea sem precisar recarregar

---

## 🗄️ Banco de dados

Usa **SQLite** (arquivo `pedidos.db` criado automaticamente).
Sem instalar nada extra. Para ver os dados:

```bash
# Instalar visualizador (opcional)
npx @ashleyw/sqlite3-cli pedidos.db

# Ou usar extensão "SQLite Viewer" no VS Code
```

---

## 🚀 Escalabilidade

| Etapa | O que fazer |
|-------|-------------|
| **Hoje** | Rode local, use ngrok para expor na internet |
| **Crescendo** | Deploy no Railway/Render (gratuito) |
| **Escala maior** | Migre SQLite → PostgreSQL (só mudar o driver) |
| **Múltiplos atendentes** | WebSocket já suporta N painéis abertos |
| **App mobile** | A API REST já está pronta para consumir |

### Expor para internet com ngrok (teste rápido)
```bash
npx ngrok http 3001
# Copie a URL https://xxxx.ngrok.io
# Configure como Webhook no painel MP
```

---

## 🔔 Webhook (recomendado para produção)

Configure no painel MP:
`Suas integrações → Webhooks → URL: https://seu-dominio.com/api/webhook`

Isso substitui o polling e é instantâneo.
