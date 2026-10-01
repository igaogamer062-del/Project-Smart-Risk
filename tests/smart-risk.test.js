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
  assert.match(app, /function upgradeSearchBars\(scope\)/);
  assert.match(app, /db\.tabSettings=Object\.assign\(defaultTabSettings\(\),db\.tabSettings\|\|\{\}\)/);
  assert.match(flows, /settings\.plantoes\)&&settings\.plantoes\.length\?settings\.plantoes:\['Diurno','Noturno','Comercial'\]/);
  assert.match(flows, /db\(\)\.operationalBases\|\|\[\]/);
  assert.match(flows, /api\.saveStaff\(record,absenceRecords\)/);
  assert.match(flows, /Já existe um efetivo para este plantão nesta data/);
});

test('efetivo e faltas usam tabelas próprias com regras de data e edição', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const flows = fs.readFileSync(path.join(root, 'js/flows-v59.js'), 'utf8');
  const sql = fs.readFileSync(path.join(root, 'supabase/010_effective_records.sql'), 'utf8');
  assert.match(app, /from\("staff_controls"\)/);
  assert.match(app, /from\("staff_absences"\)/);
  assert.match(app, /save_staff_control/);
  assert.match(app, /save_staff_absence/);
  assert.match(sql, /unique\(work_date,shift\)/);
  assert.match(sql, /Somente Supervisor ou superior pode editar um efetivo/);
  assert.match(sql, /datas anteriores só podem ser criados por Coordenador ou superior/);
  assert.match(sql, /America\/Sao_Paulo/);
  assert.match(flows, /canEditRecord=record=>rank>=3/);
});

test('alertas ativos equivalentes não duplicam e encerramento coletivo exige supervisão', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const ingest = fs.readFileSync(path.join(root, 'supabase/functions/tracking-ingest/index.ts'), 'utf8');
  const sql = fs.readFileSync(path.join(root, 'supabase/009_active_alert_dedup_and_bulk_close.sql'), 'utf8');
  assert.match(ingest, /ACTIVE_ALERT_EXISTS/);
  assert.match(ingest, /\.eq\("plate", plate\)/);
  assert.match(sql, /tracking_alerts_one_active_vehicle_type_idx/);
  assert.match(sql, /create or replace function public\.bulk_close_tracking_alerts/);
  assert.match(sql, /'Supervisor','Coordenador','Gerente','Administrador'/);
  assert.match(app, /id="tracking-bulk-close"/);
  assert.match(app, /Finalizar todos os alertas sem verificação individual não é recomendado/);
  assert.match(app, /Ocorrência gerada pelo sistema/);
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

test('integração externa usa webhook e não mantém simulador manual no frontend', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const ingest = fs.readFileSync(path.join(root, 'supabase/functions/tracking-ingest/index.ts'), 'utf8');
  assert.doesNotMatch(app, /tracking-simulator-form|tracking-test-provider/);
  assert.doesNotMatch(app, /TRACKING_INGEST_SECRET/);
  assert.match(ingest, /x-tracking-secret/);
  assert.match(app, /data-tracking-occurrence/);
  assert.match(app, /data-tracking-redo/);
  assert.doesNotMatch(app, /id="tracking-occurrence-result"/);
});

test('PGR e instruções de IA são vinculados à transportadora', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const sql = fs.readFileSync(path.join(root, 'supabase/007_transporter_knowledge_and_pgr.sql'), 'utf8');
  const ingest = fs.readFileSync(path.join(root, 'supabase/functions/tracking-ingest/index.ts'), 'utf8');
  assert.match(app, /id:"pgr"/);
  assert.match(app, /scope:'ALERT_AI'/);
  assert.match(app, /scope:'PGR'/);
  assert.match(sql, /transporter_knowledge_documents/);
  assert.match(sql, /role_name <> 'Cliente'/);
  assert.match(ingest, /Conhecimento específico da transportadora/);
});

test('polling do Lovable consulta API protegida e encaminha eventos idempotentes', () => {
  const poller = fs.readFileSync(path.join(root, 'supabase/functions/tracking-provider-poll/index.ts'), 'utf8');
  const sql = fs.readFileSync(path.join(root, 'supabase/008_lovable_provider_polling.sql'), 'utf8');
  const config = fs.readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');
  assert.match(poller, /TRACKING_PROVIDER_BASE_URL/);
  assert.match(poller, /TRACKING_PROVIDER_API_KEY/);
  assert.match(poller, /\/api\/public\/v1\/occurrences\?status=aberta&limit=100/);
  assert.match(poller, /x-api-key/);
  assert.match(poller, /provider_event_id: eventId/);
  assert.match(sql, /LOVABLE_SIMULATOR/);
  assert.match(sql, /botao_panico/);
  assert.match(config, /functions\.tracking-provider-poll/);
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
  const permissionSql = fs.readFileSync(path.join(root, 'supabase/006_extension_management_permission.sql'), 'utf8');
  assert.match(sql, /create table if not exists public\.base_extensions/);
  assert.match(sql, /base_id uuid not null references public\.operational_bases/);
  assert.match(app, /function transporterNames\(baseId\)/);
  assert.match(app, /extension-search/);
  assert.match(app, /data-extension-pane="search"/);
  assert.match(app, /data-extension-pane="manage"/);
  assert.match(app, /ramais_manage/);
  assert.match(permissionSql, /authorized users manage extensions/);
  assert.match(permissionSql, /user_has_permission\('ramais_manage'\)/);
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
  assert.match(app, /function openSupportTicketDetails/);
  assert.match(app, /Descrição da solicitação/);
  assert.match(app, /function generateSupportTicket/);
  assert.match(app, /data-ticket-generate/);
});


test('módulos operacionais persistem em tabela própria e reaparecem após novo login', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const sql = fs.readFileSync(path.join(root, 'supabase/011_alert_flow_and_operational_records.sql'), 'utf8');
  assert.match(app, /OPERATIONAL_ARRAY_MODULES=\{overtime:"overtime",earlyDepartures:"early_departures"/);
  assert.match(app, /replace_operational_module/);
  assert.match(app, /from\("operational_module_records"\)/);
  assert.match(sql, /create table if not exists public\.operational_module_records/);
  assert.match(sql, /'sinistros','pronta_resposta'/);
  assert.match(sql, /delete from public\.operational_module_records where module_key=requested_module/);
});

test('fluxo segue janela inicial, análise de ocorrência, transportadora e decisão da gestão', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/011_alert_flow_and_operational_records.sql'), 'utf8');
  const ingest = fs.readFileSync(path.join(root, 'supabase/functions/tracking-ingest/index.ts'), 'utf8');
  const occurrence = fs.readFileSync(path.join(root, 'supabase/functions/tracking-occurrence-provider/index.ts'), 'utf8');
  const groq = fs.readFileSync(path.join(root, 'supabase/functions/_shared/groq.ts'), 'utf8');
  assert.match(ingest, /initialCheckAt = new Date\(Date\.now\(\) \+ 5 \* 60_000\)/);
  assert.match(sql, /workflow_stage='WAITING_OCCURRENCE'/);
  assert.match(sql, /Realizada tentativa de contato com o condutor sem sucesso\./);
  assert.match(sql, /occurrence_check_status='CORRECT' and contact_result='SUCCESS'/);
  assert.match(sql, /occurrence_check_status='CORRECT' and contact_result='NO_SUCCESS'/);
  assert.match(sql, /workflow_stage='REDO_REQUIRED'/);
  assert.match(occurrence, /classifyOccurrenceWithGroq/);
  assert.match(groq, /tracking_occurrence_classification/);
  assert.match(sql, /A decisão final pertence à liderança/);
});

test('encerramento coletivo envia os alertas diretamente ao histórico', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const sql = fs.readFileSync(path.join(root, 'supabase/011_alert_flow_and_operational_records.sql'), 'utf8');
  assert.match(sql, /set status='ARCHIVED',workflow_stage='ARCHIVED'/);
  assert.match(sql, /visible_until=now\(\)/);
  assert.match(app, /value="ARCHIVED">Histórico/);
  assert.match(app, /enviados imediatamente ao histórico/);
});


test('ocorrência de sucesso após envio ao cliente volta para decisão da gestão', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/012_client_observation_return.sql'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  assert.match(sql, /CLIENT_SUCCESS_OBSERVATION/);
  assert.match(sql, /status='CLIENT_RESPONDED',workflow_stage='MANAGEMENT_DECISION'/);
  assert.match(app, /workflow_stage==='CLIENT_SUCCESS_OBSERVATION'/);
  assert.match(app, /Ocorrência atualizada/);
});


test('gestão pode continuar o alerta com pronta resposta, sinistro ou acionamento policial', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const sql = fs.readFileSync(path.join(root, 'supabase/013_tracking_continuation_actions.sql'), 'utf8');
  assert.match(sql, /PRONTA_RESPOSTA','SINISTRO','POLICE/);
  assert.match(sql, /module_name:='pronta_resposta'/);
  assert.match(sql, /module_name:='sinistros'/);
  assert.match(sql, /POLICE_ACTION_ACTIVE/);
  assert.match(app, /data-tracking-continue/);
  assert.match(app, /continue_tracking_alert/);
});
