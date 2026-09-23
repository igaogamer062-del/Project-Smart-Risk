const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rules = require('../js/operational-rules.js');

const root = path.resolve(__dirname, '..');

test('catálogo possui somente os sete perfis atuais', () => {
  assert.deepEqual(rules.roles, ['Operador','Lider','Supervisor','Coordenador','Gerente','Administrador','Cliente']);
});

test('regra determinística encerra alerta elegível depois de dez minutos', () => {
  const createdAt = Date.UTC(2026, 0, 1, 12, 0, 0);
  const alert = { kind: 'PANIC_BUTTON', contact: 'Sucesso', status: 'Pendente', createdAt, history: [] };
  const configured = { PANIC_BUTTON: { criticality: 'Crítico', success: true } };
  assert.equal(rules.expire([alert], configured, createdAt + 9 * 60_000), 0);
  assert.equal(rules.expire([alert], configured, createdAt + 10 * 60_000), 1);
  assert.equal(alert.status, 'Tratado');
});

test('frontend conectado não usa localStorage nem registra PWA', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(app, /localStorage/);
  assert.doesNotMatch(html, /serviceWorker|manifest\.webmanifest|driver-app|chat-checklist/i);
  assert.match(app, /storage:window\.sessionStorage/);
});

test('Groq fica no backend e o frontend não contém segredo', () => {
  const frontend = fs.readFileSync(path.join(root, 'js/config.js'), 'utf8') + fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const backend = fs.readFileSync(path.join(root, 'supabase/functions/_shared/groq.ts'), 'utf8');
  assert.doesNotMatch(frontend, /GROQ_API_KEY/);
  assert.match(backend, /Deno\.env\.get\("GROQ_API_KEY"\)/);
  assert.match(backend, /json_schema/);
});

test('ingestão mantém idempotência e fallback quando a Groq falha', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/001_smart_risk_setup.sql'), 'utf8');
  const ingest = fs.readFileSync(path.join(root, 'supabase/functions/tracking-ingest/index.ts'), 'utf8');
  assert.match(sql, /unique\(provider,provider_event_id\)/i);
  assert.match(sql, /unique\(provider,fallback_key\)/i);
  assert.match(ingest, /Groq indisponível; seguindo regra determinística/);
  assert.match(ingest, /processing_status: "IGNORED"/);
});

test('navegação do efetivo preserva a subseção escolhida', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  assert.match(app, /if\(route==="efetivo"\)window\.csrEffectiveSection=section/);
  assert.match(app, /active=window\.csrEffectiveSection\|\|"control"/);
  assert.match(app, /show\(active\)/);
  assert.match(app, /data-eff-nav="absence"/);
  assert.match(app, /data-eff-nav="sanction"/);
  assert.match(app, /data-eff-nav="overtime"/);
});

test('feedback de criação, notificações e guia usam a interface revisada', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const workspace = fs.readFileSync(path.join(root, 'js/workspace-v58.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const corporate = fs.readFileSync(path.join(root, 'css/corporate-v511.css'), 'utf8');
  assert.doesNotMatch(app, /Usuário criado no Supabase/);
  assert.match(app, /toast\("Usuário criado\."/);
  assert.match(html, /corporate-v511\.css/);
  assert.match(corporate, /\.v54-notif-dropdown/);
  assert.match(workspace, /class="guide-module"/);
  assert.match(workspace, /Como utilizar/);
  assert.match(workspace, /data-guide-route/);
});

test('subseções do menu apontam para controles existentes', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(app, /assistente:\{chat:'\[data-ai-choice="chat"\]',config:'\[data-ai-choice="config"\]',manuals:'\[data-ai-choice="manuals"\]'\}/);
  assert.match(app, /passagem:\{create:'\[data-shift-tab="create"\]',received:'\[data-shift-tab="received"\]',history:'\[data-shift-tab="history"\]'\}/);
  assert.match(app, /sinistro:\{new:'\[data-choice="new"\]',history:'\[data-choice="history"\]'\}/);
  assert.match(app, /route==='efetivo'&&section==='early'/);
  assert.match(app, /route==='assistente'&&section==='team'/);
  assert.match(app, /csrChecklistTab=section/);
  assert.match(html, /data-shift-tab="create"/);
  assert.match(html, /data-shift-tab="received"/);
  assert.match(html, /data-shift-tab="history"/);
});
