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

test('formulário de efetivo abre mesmo com configurações remotas incompletas', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const flows = fs.readFileSync(path.join(root, 'js/flows-v59.js'), 'utf8');
  assert.match(app, /db\.tabSettings=Object\.assign\(defaultTabSettings\(\),db\.tabSettings\|\|\{\}\)/);
  assert.match(flows, /settings\.plantoes\)&&settings\.plantoes\.length\?settings\.plantoes:\['Diurno','Noturno','Comercial'\]/);
  assert.match(flows, /db\(\)\.operationalBases\|\|\[\]/);
  assert.match(flows, /Falha ao abrir o registro de efetivo/);
});

test('fluxo de ocorrência encaminha contato sem sucesso ao cliente pelo backend', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase/003_alert_occurrence_flow.sql'), 'utf8');
  assert.match(migration, /occurrence_check_status in \('PENDING','INCORRECT','CORRECT'\)/);
  assert.match(migration, /contact_result is null or contact_result in \('SUCCESS','NO_SUCCESS'\)/);
  assert.match(migration, /create or replace function public\.register_tracking_occurrence_result/);
  assert.match(migration, /then now\(\)\+interval '1 minute'/);
  assert.match(migration, /set status='WAITING_CLIENT'/);
  assert.match(migration, /Alerta encaminhado automaticamente à transportadora/);
  assert.match(migration, /select public\.tracking_workflow_tick\(\)/);
});

test('simulador do integrador exige administrador e não expõe segredo no frontend', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const provider = fs.readFileSync(path.join(root, 'supabase/functions/tracking-test-provider/index.ts'), 'utf8');
  assert.match(app, /id="tracking-simulator-form"/);
  assert.match(app, /functions\.invoke\("tracking-test-provider"/);
  assert.doesNotMatch(app, /TRACKING_INGEST_SECRET/);
  assert.match(provider, /profile\.data\?\.access_role === "Administrador"/);
  assert.doesNotMatch(app, /data-tracking-occurrence/);
  assert.doesNotMatch(app, /id="tracking-occurrence-result"/);
});

test('alertas usam painel operacional e criticidade fica em configuração separada', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const guide = fs.readFileSync(path.join(root, 'js/workspace-v58.js'), 'utf8');
  assert.match(app, /id:"config-alertas"/);
  assert.match(app, /function renderAlertConfiguration/);
  assert.match(app, /alerts-workspace/);
  assert.match(app, /data-alert-pane="integrator"/);
  assert.match(app, /data-alert-pane="manual"/);
  assert.match(app, /tracking-alert-severity/);
  assert.match(html, /id="tpl-config-alertas"/);
  assert.match(html, /alerts-v513\.css/);
  assert.match(guide, /'config-alertas'/);
});

test('configurações de abas voltam a administrar as listas gerais', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  assert.match(app, /function renderConfigAbas/);
  assert.match(app, /key:"plantoes"/);
  assert.match(app, /key:"transferenciaMotivos"/);
  assert.match(app, /key:"clientes"/);
  assert.match(app, /key:"sinistroTipos"/);
  assert.match(app, /key:"tecnologias"/);
  assert.match(app, /data-config-section/);
});

test('ramais usam bases e permitem pesquisa por transportadora', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const sql = fs.readFileSync(path.join(root, 'supabase/005_support_and_extensions.sql'), 'utf8');
  assert.match(sql, /create table if not exists public\.base_extensions/);
  assert.match(sql, /base_id uuid not null references public\.operational_bases/);
  assert.match(app, /function transporterNames\(baseId\)/);
  assert.match(app, /extension-search/);
  assert.match(app, /row\.transporters/);
});

test('chamados possuem abertura, fila autorizável e notificações individuais', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const sql = fs.readFileSync(path.join(root, 'supabase/005_support_and_extensions.sql'), 'utf8');
  assert.match(app, /id:"abrir-chamado"[\s\S]*perm:"abrirChamado"/);
  assert.match(app, /id:"chamados"[\s\S]*perm:"chamados"/);
  assert.match(sql, /create or replace function public\.create_support_ticket/);
  assert.match(sql, /profile_has_permission\(p\.id,'chamados'\)/);
  assert.match(sql, /notification_preferences->>'chamados'/);
  assert.match(html, /id="um-notif-chamados"/);
  assert.match(app, /rpc\('manage_support_ticket'/);
});
