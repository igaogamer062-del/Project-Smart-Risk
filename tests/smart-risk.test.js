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

