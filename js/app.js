
(function(){
  "use strict";

  var SESSION_KEY = "smart_risk_session";
  var PUBLIC_CONFIG = window.SMART_RISK_CONFIG || {};
  var SUPABASE_URL = PUBLIC_CONFIG.supabaseUrl || "";
  var SUPABASE_PUBLISHABLE_KEY = PUBLIC_CONFIG.supabasePublishableKey || "";
  var SUPABASE_CONFIGURED = /^https:\/\/.+\.supabase\.co$/i.test(SUPABASE_URL) && !/COLE_AQUI/.test(SUPABASE_PUBLISHABLE_KEY);
  var supabaseClient = window.supabase && SUPABASE_CONFIGURED ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth:{persistSession:true,storage:window.sessionStorage,storageKey:"smart-risk-auth",autoRefreshToken:true,detectSessionInUrl:true}
  }) : null;
  var pendingTemporaryPasswordUser = null;
  window.SMART_RISK_SUPABASE_CLIENT = supabaseClient;

  var PAGES = [
    {id:"menu", label:"Menu inicial", perm:"menu", icon:"home"},
    {id:"perfil", label:"Alteração de perfil", perm:"perfil", icon:"user"},
    {id:"permissoes", label:"Permissões", perm:"permissoes", icon:"shield"},
    {id:"usuarios", label:"Usuários", perm:"usuarios", icon:"users"},
    {id:"dashboard", label:"Dashboard", perm:"dashboard", icon:"chart"},
    {id:"ocorrencia", label:"Gerar descritivo", perm:"ocorrencia", icon:"edit"},
    {id:"assistente", label:"Assistente Operacional", perm:"assistente", icon:"ai"},
    {id:"central-ocorrencias", label:"Alertas", perm:"centralOcorrencias", icon:"alert"},
    {id:"passagem", label:"Passagem de Plantão", perm:"passagem", icon:"inbox"},
    {id:"pronta-resposta", label:"Pronta Resposta", perm:"centralOcorrencias", icon:"truck"},
    {id:"sinistro", label:"Sinistro", perm:"sinistro", icon:"file"},
    {id:"efetivo", label:"Efetivo", perm:"efetivo", icon:"users"},
    {id:"saida-antecipada",label:"Saída antecipada",perm:"efetivo",icon:"exit"},
    {id:"checklist", label:"Checklist", perm:"checklist", icon:"list"},
    {id:"ferias", label:"Controle de férias", perm:"ferias", icon:"calendar"},
    {id:"config-abas", label:"Configurações de abas", perm:"configAbas", icon:"settings"},
    {id:"config-bases", label:"Configurações de bases", perm:"configAbas", icon:"home"},
    {id:"documentacao",label:"Guia do sistema",perm:"menu",icon:"book"},
    {id:"duvidas-equipe",label:"Dúvidas da equipe",perm:"assistente",icon:"insights"},
    {id:"logs", label:"Logs do sistema", perm:"logs", icon:"logs"}
  ];
  var FERIAS_PERMS = [
    {key:"ferias_view",label:"Férias — Visualizar"},{key:"ferias_create",label:"Férias — Criar programação"},{key:"ferias_edit",label:"Férias — Editar programação"},{key:"ferias_cancel",label:"Férias — Cancelar programação"},{key:"ferias_history",label:"Férias — Visualizar histórico"},{key:"ferias_export",label:"Férias — Exportar"},{key:"ferias_team",label:"Férias — Visualizar equipe"},{key:"ferias_all_bases",label:"Férias — Visualizar todas as bases"}
  ];
  var OP_PERMS = [
    ["users_view","Usuários — Visualizar"],["users_create","Usuários — Criar"],["users_edit","Usuários — Editar"],["users_disable","Usuários — Desativar"],["users_role","Usuários — Alterar cargo"],["users_manager","Usuários — Alterar gestor"],["users_reset_password","Usuários — Redefinir senha"],
    ["occ_create","Alertas — Criar"],["occ_view","Alertas — Visualizar"],["occ_edit","Alertas — Editar"],["occ_finish","Alertas — Finalizar"],["occ_history","Alertas — Visualizar tratadas"],["occ_delete","Alertas — Excluir"],
    ["mech_create","Mecânicos — Criar"],["mech_edit","Mecânicos — Editar"],["mech_email","Mecânicos — Enviar por e-mail"],["mech_history","Mecânicos — Visualizar histórico"],
    ["shift_create","Passagem — Criar"],["shift_send","Passagem — Enviar"],["shift_received","Passagem — Visualizar recebidas"],["shift_history","Passagem — Visualizar histórico"],["shift_team","Passagem — Visualizar equipe"],
    ["ai_use","IA — Usar Assistente operacional"],["ai_analysis","IA — Visualizar análise"],["ai_config","IA — Configurar"],["ai_files_add","IA — Adicionar arquivos"],["ai_files_remove","IA — Remover arquivos"],["ai_instructions","IA — Adicionar instruções"],["ai_knowledge","IA — Administrar conhecimento"],
    ["sinistro_create","Sinistro — Adicionar"],["sinistro_history","Sinistro — Visualizar histórico"],["sinistro_edit","Sinistro — Editar"],["sinistro_delete","Sinistro — Excluir"]
  ].map(function(x){return {key:x[0],label:x[1]};});

  var DEFAULT_PERMS = {
    Administrador:{menu:true,perfil:true,permissoes:true,usuarios:true,dashboard:true,ocorrencia:true,assistente:true,centralOcorrencias:true,passagem:true,sinistro:true,efetivo:true,checklist:true,ferias:true,configAbas:true,logs:true},
    Coordenador:{menu:true,perfil:true,usuarios:true,dashboard:true,ocorrencia:true,assistente:true,centralOcorrencias:true,passagem:true,sinistro:true,efetivo:true,checklist:true,ferias:true,configAbas:false,logs:true},
    Gerente:{menu:true,perfil:true,permissoes:false,usuarios:true,dashboard:true,ocorrencia:true,assistente:true,centralOcorrencias:true,passagem:true,sinistro:true,efetivo:true,checklist:true,ferias:true,configAbas:false,logs:true},
    Supervisor:{menu:true,perfil:true,permissoes:false,usuarios:true,dashboard:true,ocorrencia:true,assistente:true,centralOcorrencias:true,passagem:true,sinistro:true,efetivo:true,checklist:true,ferias:true,configAbas:false,logs:true},
    Lider:{menu:true,perfil:true,permissoes:false,usuarios:true,dashboard:true,ocorrencia:true,assistente:true,centralOcorrencias:true,passagem:true,sinistro:true,efetivo:true,checklist:true,ferias:true,configAbas:false,logs:true},
    Operador:{menu:true,perfil:true,permissoes:false,usuarios:false,dashboard:true,ocorrencia:true,assistente:true,centralOcorrencias:true,passagem:true,sinistro:true,efetivo:true,checklist:true,ferias:true,configAbas:false,logs:false},
    Cliente:{menu:true,perfil:true,permissoes:false,usuarios:false,dashboard:true,ocorrencia:false,assistente:false,centralOcorrencias:true,passagem:false,sinistro:false,efetivo:false,checklist:false,ferias:false,configAbas:false,logs:false}
  };


  function icon(name){
    var icons = {
      book:'<path d="M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3zM12 6v16"/>',
      insights:'<path d="M3 21h18M5 17v-5M11 17V8M17 17V3"/>',
      headset:'<path d="M4 14v-3a8 8 0 0 1 16 0v3M4 12H2v7h4v-7zM20 12h2v7h-4v-7zM20 19v3h-7"/>',
      home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
      user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
      shield:'<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/>',
      org:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M6 9v3a3 3 0 0 0 3 3h3m0 0h3a3 3 0 0 0 3-3V9"/>',
      users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><circle cx="18" cy="7" r="2.5"/><path d="M15.5 12.2c2.6.3 4.5 2.3 4.5 5.3"/>',
      alert:'<path d="M12 2 1 21h22L12 2z"/><path d="M12 9v5M12 17h.01"/>',
      truck:'<rect x="1" y="7" width="15" height="11" rx="2"/><path d="M16 10h4l3 4v4h-7"/><circle cx="6" cy="18.5" r="1.8"/><circle cx="18.5" cy="18.5" r="1.8"/>',
      note:'<path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/><path d="M8 13h8M8 17h5"/>',
      file:'<path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/><path d="M8 12h8M8 16h5"/>',
      calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
      chart:'<path d="M4 20V10M11 20V4M18 20v-7"/><path d="M3 20h18"/>',
      logs:'<path d="M4 6h16M4 12h16M4 18h10"/>'
      ,settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15z"/>'
      ,list:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'
      ,edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>'
      ,inbox:'<path d="M4 4h16v16H4z"/><path d="M4 14h5l2 3h2l2-3h5"/>'
      ,ai:'<path d="M12 3a7 7 0 0 0-7 7v4l-2 3h18l-2-3v-4a7 7 0 0 0-7-7z"/><path d="M9 10h.01M15 10h.01M9 14c2 2 4 2 6 0"/>'
      ,wrench:'<path d="M14 7l3-3 3 3-3 3M4 20l8-8M5 4l15 15"/>'
      ,shift:'<path d="M7 7h11l-3-3M17 17H6l3 3"/><path d="M18 7l-3 3M6 17l3-3"/>'
      ,chat:'<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>'
    };
    const more={clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',exit:'<path d="M10 4H4v16h6M10 12h12m-5-5 5 5-5 5"/>',absence:'<circle cx="9" cy="7" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0M17 6l5 5m0-5-5 5"/>',sanction:'<path d="m14 3 7 7-4 4-7-7 4-4ZM4 21l10-10M2 22h10"/>',plus:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 7v10M7 12h10"/>',history:'<path d="M3 11a9 9 0 1 1 3 8M3 4v7h7M12 7v5l3 2"/>',key:'<circle cx="7" cy="8" r="4"/><path d="m10 11 10 10m-4-4 3-3m-6 0 3-3"/>',config:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',chartLine:'<path d="M3 3v18h18M6 15l5-6 4 3 6-8"/>',receipt:'<path d="M5 2h14v20l-3-2-4 2-4-2-3 2V2ZM8 7h8M8 12h8"/>'};
    return more[name] || icons[name] || icons.file;
  }

  function alertDot(a){var state=CSRRules.alertState(a,db.tabSettings.alertRules);return '<span class="v58-alert-dot '+state.color+'" title="'+escapeHtml(state.label)+'" aria-label="'+escapeHtml(state.label)+'"></span><span class="v58-criticality">'+escapeHtml(state.criticality)+'</span> ';}
  setInterval(function(){if(!currentUser())return;var changed=!db.supabaseConnected&&CSRRules.expire(db.operationalOccurrences,db.tabSettings.alertRules);if(changed){saveDB(db);if(['menu','dashboard'].includes(getRoute()))renderRoleDashboard('role-dashboard');}if(getRoute()==='central-ocorrencias'&&window.csrAlertsDraw)window.csrAlertsDraw();},15000);
  /* ---------- DB / seed ---------- */
  function seedDB(){
    var db = {
      users: [],
      logs: [],
      prontaResposta: [],
      notesFree: {},
      notesStructured: [],
      changeLogs: [],
      profileLogs: [],
      sinistros: [],
      sinistroCounter: 0,
      ferias: [],
      feriasHistory: [],
      feriasConfig: {approvalEnabled:false},
      operationalOccurrences: [],
      shiftPassages: [],
      aiConversations: {},
      aiKnowledge: [],
      aiInstructions: "",
      aiQueries: [],
      emailHistory: [],
      notifications: [],
      checklists: [], overtime: [],earlyDepartures: [],
      absences: [], effectiveVacations: [], sanctions: [], staffControls: [], transfers: [],
      transporters: [], operationalBases: [], baseTransporters: [], trackingAlerts: []
      ,tabSettings: defaultTabSettings()
    };
    return db;
  }

  function loadDB(){
    var parsed = seedDB();
    if(!parsed.prontaResposta) parsed.prontaResposta = [];
    if(!parsed.notesFree) parsed.notesFree = {};
    if(!parsed.notesStructured) parsed.notesStructured = [];
    if(!parsed.changeLogs) parsed.changeLogs = [];
    if(!parsed.profileLogs) parsed.profileLogs = [];
    if(!parsed.sinistros) parsed.sinistros = [];
    if(parsed.sinistroCounter === undefined) parsed.sinistroCounter = parsed.sinistros.length;
    if(!parsed.ferias) parsed.ferias = [];
    if(!parsed.feriasHistory) parsed.feriasHistory = [];
    parsed.feriasConfig = {approvalEnabled:false};
    parsed.ferias.forEach(function(f){ if(f.status === "Pendente") f.status = "Programada"; });
    if(!parsed.operationalOccurrences) parsed.operationalOccurrences = [];
    if(!parsed.shiftPassages) parsed.shiftPassages = [];
    if(!parsed.aiConversations) parsed.aiConversations = {};
    if(!parsed.aiKnowledge) parsed.aiKnowledge = [];
    if(parsed.aiInstructions === undefined) parsed.aiInstructions = "";
    if(!parsed.aiQueries) parsed.aiQueries = [];
    if(!parsed.emailHistory) parsed.emailHistory = [];
    if(!parsed.notifications) parsed.notifications = [];
    if(!parsed.earlyDepartures)parsed.earlyDepartures=[];if(!parsed.checklists) parsed.checklists = []; if(!parsed.overtime) parsed.overtime = [];
    if(!parsed.absences) parsed.absences=[]; if(!parsed.effectiveVacations) parsed.effectiveVacations=[]; if(!parsed.sanctions) parsed.sanctions=[]; if(!parsed.staffControls) parsed.staffControls=[]; if(!parsed.transfers) parsed.transfers=[];
    if(!parsed.transporters) parsed.transporters=[];if(!parsed.operationalBases) parsed.operationalBases=[];if(!parsed.baseTransporters) parsed.baseTransporters=[];if(!parsed.trackingAlerts) parsed.trackingAlerts=[];
    parsed.tabSettings = Object.assign(defaultTabSettings(), parsed.tabSettings || {});
    var defaults=defaultTabSettings();Object.keys(defaults).forEach(function(key){if(Array.isArray(defaults[key])&&!Array.isArray(parsed.tabSettings[key]))parsed.tabSettings[key]=defaults[key];if(!Array.isArray(defaults[key])&&(!parsed.tabSettings[key]||typeof parsed.tabSettings[key]!=="object"))parsed.tabSettings[key]=defaults[key];});
    parsed.users.forEach(function(u){if(u.unidade&&!parsed.tabSettings.clientes.some(function(x){return x.toLowerCase()===u.unidade.toLowerCase();}))parsed.tabSettings.clientes.push(u.unidade);});
    parsed.users.forEach(function(u){
      if(u.managerId === undefined) u.managerId = null;
      if(u.matricula === undefined) u.matricula = "";
      if(u.dataContratacao === undefined) u.dataContratacao = "";
      if(u.notifySinistro === undefined) u.notifySinistro = true;
      if(u.notificationsEnabled === undefined) u.notificationsEnabled = true;
      if(!u.notificationPrefs) u.notificationPrefs = {sinistro:u.notifySinistro !== false, ferias:true, sistema:true, alertas:true};
      if(u.notificationPrefs.sinistro === undefined) u.notificationPrefs.sinistro = u.notifySinistro !== false;
      if(u.notificationPrefs.ferias === undefined) u.notificationPrefs.ferias = true;
      if(u.notificationPrefs.sistema === undefined) u.notificationPrefs.sistema = true;
      if(u.notificationPrefs.alertas === undefined) u.notificationPrefs.alertas = true;
      u.funcao=CSRRules.role(u);u.cargo=u.funcao;
      if(u.perms){
        var roleDefaults = DEFAULT_PERMS[u.funcao] || DEFAULT_PERMS.Operador;
        PAGES.forEach(function(p){ if(u.perms[p.perm] === undefined) u.perms[p.perm] = !!roleDefaults[p.perm]; });
      }
    });
    return parsed;
  }
  function saveDB(){ scheduleCloudSync(); }

  function defaultTabSettings(){return {plantoes:["Diurno","Noturno","Comercial"],transferenciaMotivos:["Troca operacional","Manutenção","Indisponibilidade","Orientação do cliente"],clientes:[],transportadoras:[],alertas:["Botão de pânico","Desengate de carreta","Violação","Desvio de rota","Entrada em área de risco","Saída de área de risco","Perda de comunicação","Perda de GPS","Ignição","Porta aberta","Evento de rastreamento","Outros"],sinistroTipos:["Acidente","Perda parcial","Dano no cavalo","Avaria"],viagemTipos:["Longa distância","Curta distância","Última milha","Transferência entre CDs","Coleta","Entrega"],tecnologias:[],deslocamentoMotivos:["Suspeita de roubo/furto","Desvio de rota crítico","Perda de sinal prolongada","Botão de pânico acionado","Parada não programada"],alertRules:{}};}
  function settingOptions(key,placeholder){var list=(db.tabSettings&&db.tabSettings[key])||[];return '<option value="">'+escapeHtml(placeholder||"Selecione")+'</option>'+list.map(function(v){return '<option value="'+escapeHtml(v)+'">'+escapeHtml(v)+'</option>';}).join("");}
  function setSelectOptions(id,key,placeholder,current){var el=document.getElementById(id);if(!el)return;el.innerHTML=settingOptions(key,placeholder);if(current!==undefined&&current!==null)el.value=current;}

  function nowStr(){
    var d = new Date();
    function p(n){return String(n).padStart(2,"0");}
    return p(d.getDate())+"/"+p(d.getMonth()+1)+"/"+d.getFullYear()+" "+p(d.getHours())+":"+p(d.getMinutes());
  }

  var db = loadDB();
  var CLOUD_ARRAY_MODULES={
    checklists:"checklists",
    overtime:"overtime",earlyDepartures:"early_departures",
    absences:"absences",
    effectiveVacations:"effective_vacations",
    sanctions:"sanctions",
    staffControls:"staff_controls",
    transfers:"transfers",
    operationalOccurrences:"operational_occurrences",
    sinistros:"sinistros",
    prontaResposta:"pronta_resposta",
    ferias:"ferias",
    feriasHistory:"ferias_history",
    shiftPassages:"shift_passages",
    notifications:"notifications",
    logs:"system_logs",
    changeLogs:"change_logs",
    profileLogs:"profile_logs",
    notesStructured:"structured_notes",
    aiKnowledge:"ai_knowledge",
    aiQueries:"ai_queries",
    emailHistory:"email_history"
  };
  var CLOUD_SETTING_MODULES={
    tabSettings:"tab_settings",
    feriasConfig:"ferias_config",
    aiInstructions:"ai_instructions"
  };
  var CLOUD_OBJECT_MODULES={notesFree:"free_notes",aiConversations:"ai_conversations"};
  var cloudReady=false,cloudLoading=false,cloudSyncTimer=null,cloudReloadTimer=null,profileReloadTimer=null,cloudFingerprints={},cloudChannel=null;

  function stableCloudValue(value){try{return JSON.stringify(value===undefined?null:value);}catch(error){return "";}}
  function ensureCloudRecordIds(property,moduleKey){
    var list=Array.isArray(db[property])?db[property]:[];
    list.forEach(function(item,index){
      if(!item.id)item.id=moduleKey+"-"+Date.now()+"-"+index+"-"+Math.random().toString(36).slice(2,8);
    });
    return list;
  }
  function scheduleCloudSync(){
    if(!cloudReady||cloudLoading||!supabaseClient)return;
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer=setTimeout(function(){syncAllCloudModules().catch(function(error){console.error("Falha ao sincronizar dados Nova GR",error);});},450);
  }
  async function syncCloudArray(property,moduleKey){
    var list=ensureCloudRecordIds(property,moduleKey);if(property==="notifications")list=list.filter(function(item){return !item.serverNotification;});var fingerprint=stableCloudValue(list);
    if(cloudFingerprints["a:"+moduleKey]===fingerprint)return;
    var user=currentUser();if(!user)return;
    var existing=await supabaseClient.from("nova_gr_records").select("record_id").eq("module_key",moduleKey);
    if(existing.error)throw existing.error;
    /* O navegador nunca remove registros remotos por diferença de cache. Exclusões usam fluxos explícitos no backend. */
    if(list.length){
      var rows=list.map(function(item){return {module_key:moduleKey,record_id:String(item.id),payload:item,created_by:user.id,updated_by:user.id};});
      var upsert=await supabaseClient.from("nova_gr_records").upsert(rows,{onConflict:"module_key,record_id"});
      if(upsert.error)throw upsert.error;
    }
    var marker=await supabaseClient.from("nova_gr_modules").upsert({module_key:moduleKey,updated_by:user.id},{onConflict:"module_key"});
    if(marker.error)throw marker.error;
    cloudFingerprints["a:"+moduleKey]=fingerprint;
  }
  async function syncCloudSetting(property,settingKey){
    var value=db[property],fingerprint=stableCloudValue(value);
    if(cloudFingerprints["s:"+settingKey]===fingerprint)return;
    var user=currentUser();if(!user)return;
    var result=await supabaseClient.from("nova_gr_settings").upsert({setting_key:settingKey,value:value===undefined?null:value,updated_by:user.id},{onConflict:"setting_key"});
    if(result.error)throw result.error;
    cloudFingerprints["s:"+settingKey]=fingerprint;
  }
  async function syncCloudObject(property,moduleKey){
    var objectValue=db[property]||{},user=currentUser();if(!user)return;
    var ownValue=objectValue[user.id]===undefined?(moduleKey==="ai_conversations"?[]:""):objectValue[user.id];
    var fingerprint=stableCloudValue(ownValue);if(cloudFingerprints["o:"+moduleKey]===fingerprint)return;
    var row={module_key:moduleKey,record_id:user.id,payload:{userId:user.id,data:ownValue},created_by:user.id,updated_by:user.id};
    var result=await supabaseClient.from("nova_gr_records").upsert(row,{onConflict:"module_key,record_id"});if(result.error)throw result.error;
    var marker=await supabaseClient.from("nova_gr_modules").upsert({module_key:moduleKey,updated_by:user.id},{onConflict:"module_key"});if(marker.error)throw marker.error;
    cloudFingerprints["o:"+moduleKey]=fingerprint;
  }
  async function syncAllCloudModules(){
    if(!cloudReady||cloudLoading||!currentUser())return;
    var entries=Object.entries(CLOUD_ARRAY_MODULES);
    for(var i=0;i<entries.length;i++){
      try{await syncCloudArray(entries[i][0],entries[i][1]);}catch(error){console.warn("Módulo sem permissão ou indisponível:",entries[i][1],error.message);}
    }
    var settings=Object.entries(CLOUD_SETTING_MODULES);
    for(var j=0;j<settings.length;j++){
      try{await syncCloudSetting(settings[j][0],settings[j][1]);}catch(error){console.warn("Configuração não sincronizada:",settings[j][1],error.message);}
    }
    var objects=Object.entries(CLOUD_OBJECT_MODULES);
    for(var k=0;k<objects.length;k++){
      try{await syncCloudObject(objects[k][0],objects[k][1]);}catch(error){console.warn("Dados pessoais não sincronizados:",objects[k][1],error.message);}
    }
  }
  async function loadCloudData(){
    if(!supabaseClient||!currentUser()||cloudLoading)return;
    cloudLoading=true;
    try{
      var responses=await Promise.all([
        supabaseClient.from("nova_gr_records").select("module_key,record_id,payload,updated_at"),
        supabaseClient.from("nova_gr_modules").select("module_key"),
        supabaseClient.from("nova_gr_settings").select("setting_key,value"),
        supabaseClient.from("transporters").select("id,name,active").order("name"),
        supabaseClient.from("operational_bases").select("id,name,code,active").order("name"),
        supabaseClient.from("base_transporters").select("base_id,transporter_id,active"),
        supabaseClient.from("tracking_alerts").select("*").order("occurred_at",{ascending:false}).limit(500),
        supabaseClient.from("user_notifications").select("*").order("created_at",{ascending:false}).limit(200)
      ]);
      responses.forEach(function(result){if(result.error)throw result.error;});
      var grouped={};(responses[0].data||[]).forEach(function(row){(grouped[row.module_key]||(grouped[row.module_key]=[])).push(row.payload);});
      var initialized=(responses[1].data||[]).map(function(row){return row.module_key;});
      Object.entries(CLOUD_ARRAY_MODULES).forEach(function(entry){
        var property=entry[0],moduleKey=entry[1];
        if(initialized.indexOf(moduleKey)!==-1){
          var remoteRows=grouped[moduleKey]||[],localRows=Array.isArray(db[property])?db[property]:[],mergedRows={};
          remoteRows.concat(localRows).forEach(function(row){if(!row)return;var key=row.id||row.recordId||("local-"+stableCloudValue(row));mergedRows[key]=row;});
          db[property]=Object.keys(mergedRows).map(function(key){return mergedRows[key];});
          cloudFingerprints["a:"+moduleKey]=stableCloudValue(db[property]);
        }
      });
      Object.entries(CLOUD_OBJECT_MODULES).forEach(function(entry){
        var property=entry[0],moduleKey=entry[1],user=currentUser(),rows=grouped[moduleKey]||[];
        if(!db[property]||typeof db[property]!=="object")db[property]={};
        if(user&&initialized.indexOf(moduleKey)!==-1){var own=rows.find(function(row){return row&&row.userId===user.id;});db[property][user.id]=own?own.data:(moduleKey==="ai_conversations"?[]:"");cloudFingerprints["o:"+moduleKey]=stableCloudValue(db[property][user.id]);}
      });
      var settingRows={};(responses[2].data||[]).forEach(function(row){settingRows[row.setting_key]=row.value;});
      Object.entries(CLOUD_SETTING_MODULES).forEach(function(entry){
        var property=entry[0],settingKey=entry[1];
        if(Object.prototype.hasOwnProperty.call(settingRows,settingKey)){db[property]=settingRows[settingKey];cloudFingerprints["s:"+settingKey]=stableCloudValue(db[property]);}
      });
      db.tabSettings=Object.assign(defaultTabSettings(),db.tabSettings||{});
      var defaultSettings=defaultTabSettings();Object.keys(defaultSettings).forEach(function(key){if(Array.isArray(defaultSettings[key])&&!Array.isArray(db.tabSettings[key]))db.tabSettings[key]=defaultSettings[key];if(!Array.isArray(defaultSettings[key])&&(!db.tabSettings[key]||typeof db.tabSettings[key]!=="object"))db.tabSettings[key]=defaultSettings[key];});
      db.transporters=(responses[3].data||[]).filter(function(x){return x.active!==false;});
      db.operationalBases=(responses[4].data||[]).filter(function(x){return x.active!==false;});
      db.baseTransporters=(responses[5].data||[]).filter(function(x){return x.active!==false;});
      db.trackingAlerts=responses[6].data||[];
      var serverNotifications=(responses[7].data||[]).map(function(n){return {id:n.id,userId:n.user_id,type:"alertas",title:n.title,message:n.message,route:"central-ocorrencias",recordId:n.alert_id||"",at:new Date(n.created_at).getTime(),read:!!n.read_at,serverNotification:true};});
      var localNotifications=(db.notifications||[]).filter(function(n){return !n.serverNotification;});db.notifications=serverNotifications.concat(localNotifications);
      cloudReady=true;
    }finally{cloudLoading=false;}
    scheduleCloudSync();
  }
  function startCloudRealtime(){
    if(!supabaseClient||cloudChannel)return;
    cloudChannel=supabaseClient.channel("nova-gr-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"nova_gr_records"},function(){clearTimeout(cloudReloadTimer);cloudReloadTimer=setTimeout(refreshCloudView,1800);})
      .on("postgres_changes",{event:"*",schema:"public",table:"nova_gr_settings"},function(){clearTimeout(cloudReloadTimer);cloudReloadTimer=setTimeout(refreshCloudView,1800);})
      .on("postgres_changes",{event:"*",schema:"public",table:"tracking_alerts"},function(){clearTimeout(cloudReloadTimer);cloudReloadTimer=setTimeout(refreshCloudView,900);})
      .on("postgres_changes",{event:"*",schema:"public",table:"user_notifications"},function(){clearTimeout(cloudReloadTimer);cloudReloadTimer=setTimeout(refreshCloudView,900);})
      .on("postgres_changes",{event:"*",schema:"public",table:"transporters"},function(){clearTimeout(cloudReloadTimer);cloudReloadTimer=setTimeout(refreshCloudView,900);})
      .on("postgres_changes",{event:"*",schema:"public",table:"operational_bases"},function(){clearTimeout(cloudReloadTimer);cloudReloadTimer=setTimeout(refreshCloudView,900);})
      .on("postgres_changes",{event:"*",schema:"public",table:"base_transporters"},function(){clearTimeout(cloudReloadTimer);cloudReloadTimer=setTimeout(refreshCloudView,900);})
      .on("postgres_changes",{event:"*",schema:"public",table:"profiles"},function(){clearTimeout(profileReloadTimer);profileReloadTimer=setTimeout(refreshProfilesView,1800);})
      .subscribe();
  }
  async function stopCloudRealtime(){
    clearTimeout(cloudSyncTimer);clearTimeout(cloudReloadTimer);
    if(cloudChannel&&supabaseClient){try{await supabaseClient.removeChannel(cloudChannel);}catch(ignore){}}
    cloudChannel=null;cloudReady=false;cloudLoading=false;cloudFingerprints={};
  }
  async function refreshCloudView(){
    if(cloudLoading)return;
    var active=document.activeElement,isEditing=active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName);
    cloudFingerprints={};
    await loadCloudData();
    updateTopbar(currentUser());
    refreshNotifBadge();
  }
  async function refreshProfilesView(){
    if(!supabaseClient)return;
    try{
      var auth=await supabaseClient.auth.getUser();if(auth.error||!auth.data.user)return;
      var active=document.activeElement,isEditing=active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName);
      await syncSupabaseProfiles(auth.data.user);updateTopbar(currentUser());
    }catch(error){console.warn("Não foi possível atualizar os perfis em tempo real.",error.message);}
  }

  function profileToLocalUser(p){
    return {
      id:p.id,
      nome:p.full_name||p.username||p.email,
      usuario:p.username||String(p.email||"").split("@")[0],
      email:p.email||"",
      senha:"",
      matricula:p.employee_code||"",
      cargo:CSRRules.role({funcao:p.access_role}),
      funcao:CSRRules.role({funcao:p.access_role}),
      unidade:p.base_name||"",
      baseId:p.base_id||null,
      obs:p.notes||"",
      managerId:p.manager_id||null,
      dataContratacao:p.hire_date||String(p.created_at||"").slice(0,10),
      photo:p.avatar_url||"",
      active:p.active!==false,
      notificationsEnabled:p.notifications_enabled!==false,
      notificationPrefs:p.notification_preferences||{sinistro:true,ferias:true,sistema:true,alertas:true},
      notifySinistro:!p.notification_preferences||p.notification_preferences.sinistro!==false,
      transporterId:p.transporter_id||null,
      mustChangePassword:p.must_change_password===true,
      perms:null,
      supabaseProfile:true
    };
  }

  async function syncSupabaseProfiles(authUser){
    var permissionResults=await Promise.all([
      supabaseClient.from("profiles").select("*").order("full_name",{ascending:true}),
      supabaseClient.from("role_permissions").select("access_role,permission_key,allowed"),
      supabaseClient.from("user_permission_overrides").select("user_id,permission_key,allowed")
    ]);
    if(permissionResults[0].error)throw permissionResults[0].error;
    if(permissionResults[1].error)throw permissionResults[1].error;
    if(permissionResults[2].error)throw permissionResults[2].error;
    var roleMap={};(permissionResults[1].data||[]).forEach(function(row){(roleMap[row.access_role]||(roleMap[row.access_role]={}))[row.permission_key]=row.allowed;});
    db.rolePermissionDefaults=roleMap;
    var overrideMap={};(permissionResults[2].data||[]).forEach(function(row){(overrideMap[row.user_id]||(overrideMap[row.user_id]={}))[row.permission_key]=row.allowed;});
    var remoteUsers=(permissionResults[0].data||[]).map(profileToLocalUser).filter(function(user){return user.active!==false||user.id===authUser.id;});
    remoteUsers.forEach(function(user){user.perms=Object.assign({},DEFAULT_PERMS[user.funcao]||DEFAULT_PERMS.Operador,roleMap[user.funcao]||{},overrideMap[user.id]||{});});
    if(!db.legacyUsers) db.legacyUsers=(db.users||[]).slice();
    db.users=remoteUsers;
    db.supabaseConnected=true;
    saveDB(db);
    var logged=remoteUsers.find(function(u){return u.id===authUser.id;});
    if(!logged) throw new Error("Perfil não encontrado na tabela profiles.");
    setSession(logged);
    try{await loadCloudData();startCloudRealtime();}catch(cloudError){console.warn("Os módulos compartilhados ainda não foram inicializados.",cloudError.message);}
    return logged;
  }

  async function edgeFunctionErrorMessage(error,fallback){
    try{
      if(error&&error.context&&typeof error.context.clone==="function"){
        var payload=await error.context.clone().json();
        if(payload&&payload.error)return payload.error;
      }
    }catch(ignore){}
    return (error&&error.message)||fallback;
  }

  async function bootSupabase(){
    if(!supabaseClient){
      clearSession();
      render();
      document.getElementById("login-error").textContent="Não foi possível carregar a conexão segura. Atualize a página.";
      document.getElementById("login-error").classList.add("show");
      return;
    }
    try{
      var sessionResult=await supabaseClient.auth.getSession();
      var remoteSession=sessionResult.data&&sessionResult.data.session;
      if(remoteSession&&remoteSession.user){
        var restoredUser=await syncSupabaseProfiles(remoteSession.user);
        if(restoredUser.mustChangePassword){pendingTemporaryPasswordUser=restoredUser;clearSession();}
      }
      else clearSession();
    }catch(error){
      console.error("Falha ao restaurar sessão Supabase",error);
      clearSession();
    }
    render();
    if(pendingTemporaryPasswordUser)showTemporaryPasswordChange(pendingTemporaryPasswordUser);
    refreshNotifBadge();
    if(currentUser()){checkFeriasDeadlines();refreshNotifBadge();touchPresence();}
  }

  async function touchPresence(){
    if(!supabaseClient||!currentUser())return;
    try{await supabaseClient.rpc("touch_presence");}catch(error){console.warn("Presença não atualizada",error.message);}
  }
  setInterval(function(){
    if(getSession()&&!currentUser()){render();return;}
    touchPresence();
  },180000);
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")touchPresence();});

  function addLog(acao){
    var session = getSession();
    db.logs.unshift({data: nowStr(), acao: acao, usuario: session ? session.usuario : "—"});
    saveDB(db);
  }

  function getSession(){
    var raw = sessionStorage.getItem(SESSION_KEY);
    if(!raw) return null;
    try{ return JSON.parse(raw); }catch(e){ return null; }
  }
  function setSession(user){
    var current=getSession();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({id:user.id,usuario:user.usuario,startedAt:current&&current.id===user.id?current.startedAt:Date.now()}));
  }
  function clearSession(){ sessionStorage.removeItem(SESSION_KEY); }
  function currentUser(){
    var s = getSession();
    if(!s) return null;
    var maxMs=Number(PUBLIC_CONFIG.sessionMaxHours||13)*60*60*1000;
    if(!s.startedAt||Date.now()-s.startedAt>=maxMs){clearSession();if(supabaseClient)supabaseClient.auth.signOut().catch(function(){});return null;}
    return db.users.find(function(u){ return u.id === s.id; }) || null;
  }
  function userPerms(user){if(!user)return {};var role=CSRRules.role(user);if(role==="Cliente")return Object.assign({},DEFAULT_PERMS.Cliente);var permissions=Object.assign({},DEFAULT_PERMS[role]||DEFAULT_PERMS.Operador,(db.rolePermissionDefaults&&db.rolePermissionDefaults[role])||{},user.perms||{});permissions.menu=true;permissions.perfil=true;permissions.dashboard=true;return permissions;}
  function themeIcon(dark){return dark?'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>':'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';}
  function applyTheme(theme){var dark=theme==="dark";document.body.classList.toggle("theme-dark",dark);var btn=document.getElementById("theme-toggle");if(btn){btn.innerHTML=themeIcon(dark);btn.title=dark?"Modo noturno ativo":"Modo diurno ativo";}sessionStorage.setItem("smart_risk_theme",dark?"dark":"light");}
  function feriasPerm(user,key){
    if(!user) return false;
    if(user.funcao === "Administrador") return true;
    if(user.perms && user.perms[key] !== undefined) return !!user.perms[key];
    var gestor = ["Lider","Líder","Coordenador","Supervisor","Gerente","Administrador"].indexOf(user.cargo) !== -1;
    var defaults = {ferias_view:true,ferias_create:true,ferias_edit:true,ferias_approve:gestor,ferias_reject:gestor,ferias_cancel:gestor,ferias_history:gestor,ferias_export:gestor,ferias_team:gestor,ferias_all_bases:false};
    return !!defaults[key];
  }
  function opPerm(user,key){
    if(!user) return false;if(user.funcao==="Administrador"||user.cargo==="Administrador")return true;if(user.perms&&user.perms[key]!==undefined)return !!user.perms[key];
    var levelMap={Operador:1,Lider:2,Supervisor:3,Coordenador:4,Gerente:5,Administrador:6};
    var level=levelMap[user.funcao||user.cargo];if(level===undefined)level=1;
    var min={occ_finish:2,occ_history:2,mech_email:2,mech_history:2,shift_history:3,shift_team:2,ai_analysis:3,users_view:3,users_create:5,users_edit:5,users_disable:5,users_role:5,users_manager:3,users_reset_password:6,sinistro_create:1,sinistro_history:1,sinistro_edit:3,sinistro_delete:3,ai_config:99,ai_files_add:99,ai_files_remove:99,ai_instructions:99,ai_knowledge:99}[key];
    if(min!==undefined)return level>=min;return ["occ_create","occ_view","occ_edit","mech_create","mech_edit","shift_create","shift_send","shift_received","ai_use"].indexOf(key)!==-1;
  }

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(msg, type){
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.className = "toast show" + (type ? " " + type : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ el.className = "toast"; }, 2600);
  }

  /* ---------- routing ---------- */
  function getRoute(){
    var h = window.location.hash.replace(/^#\/?/, "");
    return h || "login";
  }

  function navigate(route){
    window.location.hash = "#/" + route;
  }

  window.addEventListener("hashchange", render);

  function requireAuth(route){
    var user = currentUser();
    if(!user){
      if(route !== "login"){ navigate("login"); }
      return false;
    }
    return true;
  }

  function render(){
    var route = getRoute();
    var user = currentUser();

    if(!user){
      showLogin();
      return;
    }
    if(route === "login" || route === ""){ route = "menu"; navigate("menu"); return; }

    var page = PAGES.find(function(p){ return p.id === route; });
    if(!page){ route = "menu"; page = PAGES[0]; }

    var perms = userPerms(user);
    showApp();
    updateTopbar(user);
    renderWorkspaceNav(user,page.id);
    document.querySelectorAll('.avatar-menu').forEach(function(m){ m.classList.remove('show'); });
    if(typeof closeDrawer === "function"){ closeDrawer(); }
    if(typeof refreshNotifBadge === "function"){ refreshNotifBadge(); }
    if(!perms[page.perm]){
      renderAccessDenied(page);
      addLog("Acesso negado: " + page.label);
      return;
    }
    if(page.id!=='sinistro')window.csrIncidentAlert=null;renderPage(page.id, user);
    addLog("Acesso: " + page.label);
  }

  function renderAccessDenied(page){
    var root=document.getElementById("view-root");
    root.innerHTML='<section class="access-denied access-blocked"><div class="access-denied-icon prohibited-icon"><span></span></div><h2>Acesso não permitido</h2></section>';
  }

  function showLogin(){
    /* A preferência é preservada, mas a autenticação nunca recebe o tema escuro. */
    document.body.classList.remove("theme-dark");
    document.getElementById("login-screen").style.display = "flex";
    document.getElementById("app-screen").style.display = "none";
    document.getElementById("login-user").value = "";
    document.getElementById("login-pass").value = "";
    document.getElementById("login-form").hidden = false;
    document.querySelector(".bat-login-helper").hidden = false;
    document.querySelector(".bat-login-meta").hidden = false;
    document.getElementById("temporary-password-panel").hidden = true;
  }
  function showTemporaryPasswordChange(user){
    pendingTemporaryPasswordUser=user;
    document.body.classList.remove("theme-dark");
    document.getElementById("login-screen").style.display="flex";
    document.getElementById("app-screen").style.display="none";
    document.getElementById("login-form").hidden=true;
    document.querySelector(".bat-login-helper").hidden=true;
    document.querySelector(".bat-login-meta").hidden=true;
    document.getElementById("login-error").classList.remove("show");
    document.getElementById("temporary-password-error").classList.remove("show");
    document.getElementById("temporary-password-value").value="";
    document.getElementById("temporary-password-confirm").value="";
    document.getElementById("temporary-password-panel").hidden=false;
    setTimeout(function(){document.getElementById("temporary-password-value").focus();},40);
  }
  function showApp(){
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-screen").style.display = "flex";
    applyTheme(sessionStorage.getItem("smart_risk_theme")||"light");
  }

  function updateTopbar(user){
    var hour = new Date().getHours();
    var saud = hour < 12 ? "Bom dia" : (hour < 18 ? "Boa tarde" : "Boa noite");
    document.getElementById("greeting-text").textContent = saud + ", " + user.nome.toUpperCase() + "!";
    var avatar=document.getElementById("avatar-btn");
    avatar.textContent = user.photo ? "" : user.nome.trim().charAt(0).toUpperCase();
    avatar.style.backgroundImage = user.photo ? 'url("'+user.photo+'")' : "";
    avatar.classList.toggle("has-photo",!!user.photo);
  }

  /* ---------- page renderers ---------- */
  function renderPage(id, user){
    var root = document.getElementById("view-root");
    CSRWorkspace.init({db:()=>db,user:currentUser,perms:()=>userPerms(currentUser()),pages:()=>PAGES,save:()=>saveDB(db),toast:toast,navigate:navigate});
    CSRFlows.init({db:()=>db,user:currentUser,save:()=>saveDB(db),toast,remote:()=>!!db.supabaseConnected,client:()=>supabaseClient,perm:k=>opPerm(currentUser(),k),navigate,refresh:()=>render(),dot:alertDot,incident:()=>openWorkspaceBranch('sinistro','new'),pr:(a)=>{window.csrPrAlert=a.id;openPRModal(null);},commit:async(alert,linked,kind,closing)=>{const r=await supabaseClient.rpc('csr_transition_alert',{alert_id:alert.id,linked_record:linked,link_kind:kind,close_alert:closing,reason:alert.history.at(-1).note});if(r.error)throw r.error;}});
    var tpl = document.getElementById("tpl-" + id);
    root.innerHTML = "";
    if(tpl)root.appendChild(tpl.content.cloneNode(true));

    if(id!=="menu"){
      var header=root.querySelector(".page-header");
      if(header){
        var menuBack=document.createElement("button");menuBack.className="back-btn back-menu-btn";menuBack.textContent="⌂ Voltar ao menu inicial";menuBack.onclick=function(){navigate("menu");};header.insertBefore(menuBack,header.firstChild);
        header.querySelectorAll("[data-back]").forEach(function(btn){btn.textContent="← Voltar à página anterior";});
      }
    }

    root.querySelectorAll("[data-back]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var internalBack=Array.from(root.querySelectorAll(".subpage-back")).find(function(candidate){
          return candidate.offsetParent!==null&&!candidate.hasAttribute("data-back");
        });
        if(internalBack){ internalBack.click(); return; }
        if(window.history.length > 1){ window.history.back(); }
        else { navigate("menu"); }
      });
    });
    root.querySelectorAll("[data-nav]").forEach(function(el){
      el.addEventListener("click", function(){ navigate(el.getAttribute("data-nav")); });
    });

    if(id === "menu") renderRoleDashboard("role-dashboard");
    else if(id === "saida-antecipada") CSRFlows.early(root);
    else if(id === "perfil") renderPerfil(user);
    else if(id === "permissoes") renderPermissoes(user);
    else if(id === "organograma") renderOrganogramaV4();
    else if(id === "usuarios") renderUsuarios(user);
    else if(id === "dashboard") renderRoleDashboard("role-dashboard");
    else if(id === "ocorrencia") renderOcorrencia();
    else if(id === "assistente") renderAssistente();
    else if(id === "central-ocorrencias") renderCentralOcorrencias();
    else if(id === "mecanicos") renderMecanicosV3();
    else if(id === "passagem") renderPassagem();
    else if(id === "checklist") renderChecklist();
    else if(id === "sinistro") renderSinistroV3();
    else if(id === "pronta-resposta") renderProntaResposta();
    else if(id === "ferias") renderFerias();
    else if(id === "config-abas") renderConfigAbas();
    else if(id === "config-bases") renderBaseConfiguration();
    else if(id === "efetivo") renderEfetivoV4();
    else if(id === "transferencia") renderTransferenciaV3();
    else if(id === "logs") renderLogs(user);
    else if(id === "documentacao") CSRWorkspace.guide(root);
    else if(id === "duvidas-equipe") CSRFlows.analytics(root);
  }


  function renderMenu(user){
    var perms = userPerms(user);
    var grid = document.getElementById("menu-grid");
    grid.innerHTML = "";
    PAGES.filter(function(p){ return p.id !== "menu" && p.id!=="perfil" && !!perms[p.perm]; }).forEach(function(p){
      var div = document.createElement("div");
      div.className = "menu-card";
      div.innerHTML = '<span>'+p.label.toUpperCase()+'</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+icon(p.icon)+'</svg>';
      div.addEventListener("click", function(){ navigate(p.id); });
      grid.appendChild(div);
    });
  }

  var workspaceActiveBranch=null;
  var WORKSPACE_BRANCH_SELECTORS={
    mecanicos:{new:'[data-choice="new"]',history:'[data-choice="history"]'},
    transferencia:{new:'[data-choice="new"]',history:'[data-choice="history"]'},
    passagem:{create:'[data-shift-tab="create"]',received:'[data-shift-tab="received"]',history:'[data-shift-tab="history"]'},
    assistente:{chat:'[data-ai-choice="chat"]',config:'[data-ai-choice="config"]',manuals:'[data-ai-choice="manuals"]'},
    sinistro:{new:'[data-choice="new"]',history:'[data-choice="history"]'},
    efetivo:{dashboard:'[data-eff-nav="dashboard"]',absence:'[data-eff-nav="absence"]',sanction:'[data-eff-nav="sanction"]',control:'[data-eff-nav="control"]',overtime:'[data-eff-nav="overtime"]'},
    permissoes:{users:'[data-permission-choice="users"]',profiles:'[data-permission-choice="profiles"]'},
    logs:{acessos:'[data-log-choice="acessos"]',alteracoes:'[data-log-choice="alteracoes"]',perfil:'[data-log-choice="perfil"]'}
  };

  function workspaceBranches(user){
    return {
      "central-ocorrencias":[["current","Problemas atuais","list"],["treated","Alertas encerrados","logs"]],
      mecanicos:[["new","Registrar manutenção","wrench"],["history","Histórico de manutenção","logs"]],
      sinistro:[
        ["new","Registrar sinistro","file",opPerm(user,"sinistro_create")],
        ["history","Histórico de sinistros","logs",opPerm(user,"sinistro_history")]
      ],
      transferencia:[["new","Nova transferência","shift"],["history","Histórico de transferências","logs"]],
      passagem:[["create","Realizar passagem","file"],["received","Passagens recebidas","chat"],["history","Histórico de passagens","logs"]],
      assistente:[
        ["chat","Conversa operacional","chat",true],
        ["config","Configuração IA","settings",canAdmin()],
        ["manuals","Manuais de tecnologias","file",true]
      ],
      efetivo:[["dashboard","Dashboard do efetivo","chart"],["control","Efetivo do plantão","users"],["absence","Faltas","alert"],["sanction","Sanções","file"],["overtime","Horas extras","clock"]],
      permissoes:[["users","Permissões por usuário","users"],["profiles","Perfis cadastrados","shield"]],
      logs:[["acessos","Acessos","logs"],["alteracoes","Alterações realizadas","list"],["perfil","Mudanças de perfil","users"]]
    };
  }

  function openWorkspaceBranch(route,section){
    workspaceActiveBranch={route:route,section:section};
    if(route==="efetivo")window.csrEffectiveSection=section;
    if(getRoute()===route)render();
    else navigate(route);
    var attempts=0;
    function activate(){
      var selector=WORKSPACE_BRANCH_SELECTORS[route]&&WORKSPACE_BRANCH_SELECTORS[route][section];
      var target=selector?document.querySelector(selector):null;
      if(target){target.click();return;}
      attempts+=1;if(attempts<4)setTimeout(activate,40);
    }
    setTimeout(activate,0);
  }

  function renderWorkspaceNav(user,activeRoute){
    var host=document.getElementById('workspace-nav');if(!host)return;
    var visualRoute=activeRoute==='saida-antecipada'?'efetivo':activeRoute;
    function selectedSection(route){
      if(route==='efetivo')return activeRoute==='saida-antecipada'?'early':(window.csrEffectiveSection||'control');
      if(route==='checklist')return window.csrChecklistTab||'register';
      return workspaceActiveBranch&&workspaceActiveBranch.route===route?workspaceActiveBranch.section:'';
    }
    var perms=userPerms(user);
    var items=[
      {route:'menu',label:'Dashboard',icon:'chart'},
      {route:'efetivo',label:'Controle efetivo',icon:'users',children:[['dashboard','Dashboard do efetivo'],['control','Efetivo do plantão'],['absence','Faltas'],['sanction','Sanções'],['overtime','Horas extras'],['early','Saída antecipada']]},
      {route:'pronta-resposta',label:'Pronta resposta',icon:'truck'},
      {route:'ocorrencia',label:'Gerar descritivo',icon:'edit'},
      {route:'assistente',label:'Assistente operacional',icon:'ai',children:[['chat','Conversa'],['config','Alimentar assistente'],['manuals','Manuais']].concat(CSRRules.role(user)!=='Operador'?[['team','Dúvidas da equipe']]:[])},
      {route:'passagem',label:'Passagem de plantão',icon:'inbox',children:[['create','Realizar passagem'],['received','Recebidas'],['history','Histórico']]},
      {route:'sinistro',label:'Sinistro',icon:'file',children:[['new','Registrar sinistro'],['history','Histórico de sinistros']]},
      {route:'checklist',label:'Checklist',icon:'list',children:[['register','Registrar checklist'],['dashboard','Dashboard'],['history','Histórico']]},
      {route:'central-ocorrencias',label:'Alertas',icon:'alert'},
      {route:'ferias',label:'Controle de férias',icon:'calendar'},
      {route:'documentacao',label:'Guia do sistema',icon:'book'},
      {route:'admin',label:'Administração',icon:'shield',children:[['users','Permissões'],['profiles','Perfis cadastrados'],['acessos','Alteração de acesso'],['bases','Configurações de bases'],['abas','Configurações de abas']]}
    ];
    function allowed(x){if(x.route==='admin')return !!(perms.permissoes||perms.usuarios||perms.configAbas);var p=PAGES.find(function(p){return p.id===x.route});return !!p&&!!perms[p.perm];}
    function svg(n){if(n==='chart'||n==='bell')return '<img class="v58-nav-icon" alt="" src="images/icons/'+(n==='chart'?'grafico-histograma.svg':'balao-de-fala-do-chatbot.svg')+'">';return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+icon(n)+'</svg>'}
    host.innerHTML='<div class="csr-side-brand"><img src="images/central-smart-risk.png" alt=""><b>Central Smart Risk</b></div><div class="csr-side-scroll">'+items.filter(allowed).map(function(x){var selected=selectedSection(x.route);return '<div class="csr-nav-group '+(visualRoute===x.route?'active open':'')+'"><button class="csr-nav-item" data-route="'+x.route+'">'+svg(x.icon)+'<span>'+x.label+'</span>'+(x.children?'<em>⌄</em>':'')+'</button>'+(x.children?'<div class="csr-nav-children">'+x.children.map(function(c){return '<button class="'+(visualRoute===x.route&&selected===c[0]?'selected':'')+'" data-route="'+x.route+'" data-section="'+c[0]+'">'+svg(({dashboard:'chartLine',control:'user',absence:'absence',vacation:'calendar',sanction:'sanction',overtime:'clock',early:'exit',register:'plus',new:'plus',chat:'chat',config:'config',create:'edit',received:'inbox',history:'history',conversation:'chat',knowledge:'book',manuals:'file',team:'insights',users:'users',profiles:'shield',acessos:'key',abas:'settings'})[c[0]]||'file')+c[1]+'</button>'}).join('')+'</div>':'')+'</div>'}).join('')+'</div><div class="csr-side-foot">Central Smart Risk</div>';
    host.querySelectorAll('[data-route]').forEach(function(b){b.onclick=function(){var route=b.dataset.route,section=b.dataset.section,group=b.closest('.csr-nav-group');if(!section&&group.querySelector('.csr-nav-children')){group.classList.toggle('open');return}if(route==='efetivo'&&section==='early'){navigate('saida-antecipada');return;}if(route==='assistente'&&section==='team'){navigate('duvidas-equipe');return;}if(route==='admin'){if(section==='abas')navigate('config-abas');else if(section==='bases')navigate('config-bases');else if(section==='acessos')navigate('usuarios');else openWorkspaceBranch('permissoes',section==='profiles'?'profiles':'users')}else if(route==='checklist'&&section){window.csrChecklistTab=section;navigate('checklist');if(getRoute()==='checklist')render()}else if(route==='sinistro'&&section){openWorkspaceBranch(route,section)}else if(section)openWorkspaceBranch(route,section);else navigate(route)};});
  }

  document.addEventListener('click',function(event){if(!event.target.closest('#workspace-nav')){document.querySelectorAll('.workspace-nav-group.open').forEach(function(group){group.classList.remove('open');});document.querySelectorAll('.workspace-nav-cascade.sub-open').forEach(function(item){item.classList.remove('sub-open');var trigger=item.querySelector('[data-workspace-parent]');if(trigger)trigger.setAttribute('aria-expanded','false');});}});

  function renderRoleDashboard(targetId){
    var root=document.getElementById(targetId),user=currentUser();if(!root||!user)return;
    if(CSRRules.role(user)==="Cliente"){
      var clientAlerts=(db.trackingAlerts||[]).filter(function(a){return a.transporter_id===user.transporterId&&a.status==='WAITING_CLIENT';});
      var critical=clientAlerts.filter(function(a){return a.severity==='CRITICAL';}).length;
      root.innerHTML='<header class="role-dashboard-head v55-dashboard-head"><div><span>PAINEL DA TRANSPORTADORA</span><h1>Alertas aguardando retorno</h1><p>Exibimos somente solicitações destinadas à sua transportadora.</p></div><div class="v55-live"><i></i>Atualização segura ativa</div></header><div class="role-metric-grid v55-metric-grid"><button class="role-metric-card tone-orange" data-go="central-ocorrencias"><span class="role-metric-label">Aguardando resposta</span><strong>'+clientAlerts.length+'</strong><small>Solicitações pendentes</small></button><button class="role-metric-card tone-violet" data-go="central-ocorrencias"><span class="role-metric-label">Críticos</span><strong>'+critical+'</strong><small>Prioridade imediata</small></button></div><section class="dashboard-rail-section v55-active-panel"><div class="dashboard-section-head"><div><span class="section-eyebrow">SOLICITAÇÕES</span><h2>Veículos aguardando retorno</h2></div><button class="v55-text-action" data-go="central-ocorrencias">Responder alertas</button></div><div class="dashboard-rail">'+(clientAlerts.slice(0,8).map(function(a){return '<button class="dashboard-rail-card" data-go="central-ocorrencias"><div class="rail-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+icon('alert')+'</svg></div><div><b>'+escapeHtml(a.plate||'Sem placa')+'</b><span>'+escapeHtml(a.alert_type||'Alerta')+' · '+escapeHtml(a.occurrence_summary||'Retorno solicitado')+'</span></div></button>';}).join('')||'<div class="dashboard-empty">Nenhum alerta aguardando sua resposta.</div>')+'</div></section>';
      root.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){navigate(b.dataset.go);};});return;
    }
    function norm(value){return String(value||'').trim().toLowerCase();}
    var trackingOperational=(db.trackingAlerts||[]).map(function(a){return {id:a.id,placa:a.plate,kind:a.alert_type,description:a.description,base:(db.operationalBases.find(function(b){return b.id===a.base_id;})||{}).name||'Sem base',date:String(a.occurred_at||'').slice(0,10),time:new Date(a.occurred_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),status:a.status==='TREATED'||a.status==='ARCHIVED'?'Tratado':'Pendente'};});
    var alerts=(db.operationalOccurrences||[]).filter(function(a){return norm(a.kind)!=='problema mecânico';}).concat(trackingOperational);
    var open=alerts.filter(function(a){return !a.status||norm(a.status)==='pendente';});
    var closed=alerts.filter(function(a){return ['tratado','encerrado','finalizado'].indexOf(norm(a.status))!==-1;});
    var prs=db.prontaResposta||[],pr=prs.filter(function(p){return ['finalizada','cancelada','encerrada','encerrado'].indexOf(norm(p.status))===-1;});
    var allSins=db.sinistros||[],sins=allSins.filter(function(x){return norm(x.status)!=='encerrado';});
    var today=todayISO(),todayStaff=(db.staffControls||[]).filter(function(item){return item.date===today;}).sort(function(a,b){return Number(b.at||b.createdAt||0)-Number(a.at||a.createdAt||0);});
    var effective=todayStaff.reduce(function(names,item){(item.operators||[]).forEach(function(op){var name=norm(op&&op.name);if(name&&names.indexOf(name)===-1)names.push(name);});return names;},[]).length,totalOperators=11,effectivePct=Math.min(100,Math.round(effective/totalOperators*100));
    function lastDays(){var out=[];for(var i=6;i>=0;i--){var d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);var key=d.toISOString().slice(0,10),n=alerts.filter(function(x){return x.date===key;}).length+prs.filter(function(x){return (x.date||'')===key;}).length+allSins.filter(function(x){return (x.date||x.data||'')===key;}).length;out.push({label:d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''),value:n});}return out;}
    function baseRows(){var map={};alerts.forEach(function(x){var k=x.base||'Sem base';map[k]=(map[k]||0)+1;});return Object.keys(map).map(function(k){return {label:k,value:map[k]};}).sort(function(x,y){return y.value-x.value;}).slice(0,5);}
    function bars(rows,color){var max=Math.max.apply(null,rows.map(function(x){return x.value;}).concat([1]));return rows.map(function(x){return '<div class="csr-chart-row"><span>'+escapeHtml(x.label)+'</span><i><b style="width:'+Math.max(x.value?6:0,Math.round(x.value/max*100))+'%;background:'+color+'"></b></i><strong>'+x.value+'</strong></div>';}).join('')||'<div class="dashboard-empty">Sem dados no período.</div>';}
    var days=lastDays(),bases=baseRows(),totalStatus=Math.max(1,open.length+closed.length),pct=Math.round(open.length/totalStatus*100);
    root.innerHTML='<header class="role-dashboard-head v55-dashboard-head"><div><span>VISÃO OPERACIONAL</span><h1>Dashboard</h1><p>'+new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})+' · Central Smart Risk</p></div><div class="v55-live"><i></i>Sincronização online ativa</div></header>'+
      '<div class="role-metric-grid v55-metric-grid"><button class="role-metric-card tone-blue" data-go="central-ocorrencias"><span class="role-metric-label">Alertas ativos</span><strong>'+open.length+'</strong><small>Em acompanhamento</small></button><button class="role-metric-card tone-green" data-go="efetivo"><span class="role-metric-label">Efetivo plantão</span><strong>'+effective+'<em>/'+totalOperators+'</em></strong><small>'+effectivePct+'% dos operadores previstos</small><span class="v55-mini-progress"><i style="width:'+effectivePct+'%"></i></span></button><button class="role-metric-card tone-orange" data-go="pronta-resposta"><span class="role-metric-label">Pronta resposta</span><strong>'+pr.length+'</strong><small>Acionamentos em curso</small></button><button class="role-metric-card tone-violet" data-go="sinistro"><span class="role-metric-label">Sinistros em aberto</span><strong>'+sins.length+'</strong><small>Tratativas registradas</small></button></div>'+
      '<div class="csr-main-charts v55-main-charts"><section class="dashboard-rail-section csr-chart-card v55-chart-wide"><div class="dashboard-section-head"><div><span class="section-eyebrow">ÚLTIMOS 7 DIAS</span><h2>Movimentação operacional</h2></div><span class="v55-chart-total">'+days.reduce(function(n,x){return n+x.value;},0)+' registros</span></div><div class="csr-chart-bars">'+bars(days,'#087fe3')+'</div></section><section class="dashboard-rail-section csr-chart-card"><div class="dashboard-section-head"><div><span class="section-eyebrow">ALERTAS</span><h2>Situação atual</h2></div></div><div class="csr-donut-wrap"><div class="csr-donut '+(alerts.length?'':'empty')+'" style="--pct:'+pct+'"><span>'+pct+'%</span></div><div class="csr-donut-legend"><span><i class="open"></i>Ativos <b>'+open.length+'</b></span><span><i class="closed"></i>Encerrados <b>'+closed.length+'</b></span></div></div></section><section class="dashboard-rail-section csr-chart-card"><div class="dashboard-section-head"><div><span class="section-eyebrow">DISTRIBUIÇÃO</span><h2>Alertas por base</h2></div></div><div class="csr-chart-bars">'+bars(bases,'#13b5f4')+'</div></section></div>'+
      '<section class="dashboard-rail-section v55-active-panel"><div class="dashboard-section-head"><div><span class="section-eyebrow">ACOMPANHAMENTO</span><h2>Alertas em andamento</h2></div><button class="v55-text-action" data-go="central-ocorrencias">Ver todos</button></div><div class="dashboard-rail">'+(open.slice().reverse().slice(0,6).map(function(a){return '<button class="dashboard-rail-card" data-go="central-ocorrencias"><div class="rail-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+icon('alert')+'</svg></div><div><b>'+escapeHtml(a.placa||a.sm||'Sem placa')+'</b><span>'+escapeHtml(a.kind||a.description||'Alerta')+' · '+escapeHtml(a.base||'Sem base')+'</span></div><time>'+escapeHtml(a.time||'')+'</time></button>';}).join('')||'<div class="dashboard-empty">Nenhum alerta ativo.</div>')+'</div></section>';
    CSRWorkspace.dashboard(root);CSRFlows.dashboard(root);
    root.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){navigate(b.dataset.go);};});
  }

  function renderPerfil(user){
    var photoPreview=document.getElementById("pf-photo-preview");
    function drawPhoto(){photoPreview.style.backgroundImage=user.photo?'url("'+user.photo+'")':'';photoPreview.textContent=user.photo?'':(user.nome||"U").charAt(0).toUpperCase();}
    drawPhoto();
    document.getElementById("pf-photo-add").onclick=function(){document.getElementById("pf-photo").click();};
    document.getElementById("pf-photo").onchange=async function(){
      var f=this.files[0];if(!f)return;if(f.size>5242880){toast("A foto deve ter no máximo 5 MB.","error");return;}
      if(db.supabaseConnected){
        try{
          var ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"})[f.type];if(!ext)throw new Error("Formato de imagem não permitido.");
          var path=user.id+"/avatar."+ext,upload=await supabaseClient.storage.from("profile-photos").upload(path,f,{upsert:true,contentType:f.type,cacheControl:"3600"});if(upload.error)throw upload.error;
          var publicData=supabaseClient.storage.from("profile-photos").getPublicUrl(path),avatarUrl=publicData.data.publicUrl+"?v="+Date.now();
          var rpc=await supabaseClient.rpc("update_my_nova_gr_profile",{new_full_name:user.nome,new_username:user.usuario,new_base_name:user.unidade||"",new_notes:user.obs||"",new_avatar_url:avatarUrl});if(rpc.error)throw rpc.error;
          user.photo=avatarUrl;drawPhoto();updateTopbar(user);toast("Foto atualizada para todos os usuários.","success");
        }catch(error){console.error("Falha no upload da foto",error);toast(error.message||"Não foi possível atualizar a foto.","error");}
        return;
      }
      var reader=new FileReader();reader.onload=function(){user.photo=reader.result;saveDB(db);drawPhoto();updateTopbar(user);toast("Foto atualizada.","success");};reader.readAsDataURL(f);
    };
    document.getElementById("pf-photo-remove").onclick=async function(){
      if(db.supabaseConnected){
        try{
          var listed=await supabaseClient.storage.from("profile-photos").list(user.id);if(listed.error)throw listed.error;
          var paths=(listed.data||[]).map(function(file){return user.id+"/"+file.name;});if(paths.length){var removed=await supabaseClient.storage.from("profile-photos").remove(paths);if(removed.error)throw removed.error;}
          var rpc=await supabaseClient.rpc("update_my_nova_gr_profile",{new_full_name:user.nome,new_username:user.usuario,new_base_name:user.unidade||"",new_notes:user.obs||"",new_avatar_url:null});if(rpc.error)throw rpc.error;
          user.photo="";drawPhoto();updateTopbar(user);toast("Foto removida.","success");
        }catch(error){console.error("Falha ao remover foto",error);toast(error.message||"Não foi possível remover a foto.","error");}
        return;
      }
      user.photo="";saveDB(db);drawPhoto();updateTopbar(user);
    };
    document.getElementById("pf-usuario").value = user.usuario;

    document.getElementById("perfil-form").addEventListener("submit", async function(e){
      e.preventDefault();
      var novoUsuario = document.getElementById("pf-usuario").value.trim();
      var duplicado = db.users.find(function(u){ return u.usuario.toLowerCase() === novoUsuario.toLowerCase() && u.id !== user.id; });
      if(duplicado){
        toast("Já existe um usuário com esse nome de usuário.", "error");
        return;
      }
      if(db.supabaseConnected){
        var submit=e.currentTarget.querySelector('button[type="submit"]');submit.disabled=true;submit.textContent="Salvando...";
        try{
          var result=await supabaseClient.rpc("update_my_nova_gr_profile",{new_full_name:user.nome,new_username:novoUsuario,new_base_name:user.unidade||"",new_notes:user.obs||"",new_avatar_url:user.photo||null});
          if(result.error)throw result.error;
          var currentAuth=await supabaseClient.auth.getUser();if(currentAuth.error)throw currentAuth.error;await syncSupabaseProfiles(currentAuth.data.user);
          toast("Perfil salvo e compartilhado.","success");updateTopbar(currentUser());return;
        }catch(error){console.error("Falha ao atualizar perfil",error);toast(error.message||"Não foi possível salvar o perfil.","error");return;}
        finally{submit.disabled=false;submit.textContent="Salvar";}
      }
      var before = {usuario:user.usuario};
      user.usuario = novoUsuario;
      saveDB(db);
      setSession(user);
      addLog("Perfil atualizado");
      logProfileDiffs(before, user, user.nome);
      addChangeLog("Perfil atualizado", user.nome + " atualizou o próprio perfil.", user.id, user.nome);
      toast("Perfil salvo com sucesso.", "success");
      updateTopbar(user);
    });
  }

  function logProfileDiffs(before, after, targetNome){
    var map = [
      ["nome","Nome"], ["usuario","Usuário"], ["matricula","Matrícula"], ["email","E-mail"],
      ["cargo","Cargo"], ["funcao","Função de acesso"], ["unidade","Unidade"], ["dataContratacao","Data de contratação"], ["obs","Observação"]
    ];
    map.forEach(function(pair){
      var key = pair[0], label = pair[1];
      var de = before[key] || "—";
      var para = after[key] || "—";
      if(de !== para){ addProfileLog(after.id, targetNome, label, de, para); }
    });
  }

  function renderPermissoes(user){
    var sel = document.getElementById("perm-user-select");
    sel.innerHTML = "";
    db.users.forEach(function(u){
      var opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.nome + " - " + u.usuario;
      sel.appendChild(opt);
    });
    sel.value = user.id;

    var funcaoSel = document.getElementById("perm-funcao-select");

    function loadForUser(uid){
      var u = db.users.find(function(x){ return x.id === uid; });
      if(!u) return;
      funcaoSel.value = u.funcao;
      renderPermList(userPerms(u));
    }

    function renderPermList(perms){
      var list = document.getElementById("perm-list");
      list.innerHTML = "";
      var selectedUser = db.users.find(function(x){ return x.id === document.getElementById("perm-user-select").value; });
      var buckets={usuarios:"users_","central-ocorrencias":"occ_",mecanicos:"mech_",passagem:"shift_",assistente:"ai_",ferias:"ferias_",sinistro:"sinistro_"};
      function childrenFor(page){
        if(page.id==="ferias") return FERIAS_PERMS.map(function(x){return {key:x.key,label:x.label.replace("Férias — ","")};});
        var prefix=buckets[page.id]; if(!prefix)return [];
        return OP_PERMS.filter(function(x){return x.key.indexOf(prefix)===0;}).map(function(x){return {key:x.key,label:x.label.split("—").pop().trim()};});
      }
      PAGES.filter(function(p){return p.id!=="menu"&&p.id!=="perfil";}).forEach(function(p,index){
        var children=childrenFor(p),panel=document.createElement("div");panel.className="perm-panel"+(index===0?" open":"");
        var checked=!!perms[p.perm];
        panel.innerHTML='<div class="perm-panel-head"><input type="checkbox" data-perm="'+p.perm+'" '+(checked?'checked':'')+'><b>'+escapeHtml(p.label)+'</b><small>'+(children.length?children.length+' ações':'Acesso à aba')+'</small><span class="perm-chevron">⌄</span></div><div class="perm-panel-body"></div>';
        var body=panel.querySelector(".perm-panel-body");
        if(!children.length)body.innerHTML='<div class="perm-row" style="color:var(--muted)">A permissão acima controla o acesso completo a esta aba.</div>';
        children.forEach(function(c){var allowed=perms[c.key]!==undefined?perms[c.key]:(c.key.indexOf("ferias_")===0?feriasPerm(selectedUser,c.key):opPerm(selectedUser,c.key));var row=document.createElement("label");row.className="perm-row";row.innerHTML='<input type="checkbox" data-perm="'+c.key+'" '+(allowed?'checked':'')+'> '+escapeHtml(c.label);body.appendChild(row);});
        panel.querySelector(".perm-panel-head").onclick=function(e){if(e.target.tagName!=="INPUT")panel.classList.toggle("open");};
        list.appendChild(panel);
      });
    }

    loadForUser(user.id);
    sel.addEventListener("change", function(){ loadForUser(sel.value); });
    funcaoSel.addEventListener("change", function(){
      renderPermList((db.rolePermissionDefaults&&db.rolePermissionDefaults[funcaoSel.value])||DEFAULT_PERMS[funcaoSel.value]||DEFAULT_PERMS.Operador);
    });

    document.getElementById("perm-save").addEventListener("click", async function(){
      var u = db.users.find(function(x){ return x.id === sel.value; });
      if(!u) return;
      var newPerms = {};
      document.querySelectorAll("#perm-list input[type=checkbox]").forEach(function(cb){
        newPerms[cb.getAttribute("data-perm")] = cb.checked;
      });
      if(db.supabaseConnected){
        var saveButton=document.getElementById("perm-save");saveButton.disabled=true;saveButton.textContent="Salvando...";
        try{
          var profileRoleChanges={access_role:funcaoSel.value,updated_at:new Date().toISOString()};
          var roleUpdate=await supabaseClient.from("profiles").update(profileRoleChanges).eq("id",u.id);
          if(roleUpdate.error)throw roleUpdate.error;
          var clearOverrides=await supabaseClient.from("user_permission_overrides").delete().eq("user_id",u.id);
          if(clearOverrides.error)throw clearOverrides.error;
          var defaults=Object.assign({},DEFAULT_PERMS[funcaoSel.value]||{},(db.rolePermissionDefaults&&db.rolePermissionDefaults[funcaoSel.value])||{});
          var overrideRows=Object.keys(newPerms).filter(function(key){return defaults[key]===undefined||!!defaults[key]!==!!newPerms[key];}).map(function(key){return {user_id:u.id,permission_key:key,allowed:!!newPerms[key],updated_by:currentUser().id};});
          if(overrideRows.length){var overrideResult=await supabaseClient.from("user_permission_overrides").insert(overrideRows);if(overrideResult.error)throw overrideResult.error;}
          var currentAuth=await supabaseClient.auth.getUser();if(currentAuth.error)throw currentAuth.error;
          await syncSupabaseProfiles(currentAuth.data.user);
          toast("Permissões compartilhadas salvas para "+u.usuario+".","success");
          sel.value=u.id;loadForUser(u.id);
          return;
        }catch(error){console.error("Falha ao salvar permissões",error);toast(error.message||"Não foi possível salvar as permissões.","error");return;}
        finally{saveButton.disabled=false;saveButton.textContent="Salvar";}
      }
      u.funcao = funcaoSel.value;
      u.perms = newPerms;
      saveDB(db);
      addLog("Permissões atualizadas para " + u.usuario);
      addChangeLog("Permissões atualizadas", "Usuário: " + u.usuario + " — Função: " + u.funcao, u.id, u.nome);
      toast("Permissões salvas para " + u.usuario + ".", "success");
      if(u.id === currentUser().id){ /* refresh menu locks live */ }
    });

    var roles=["Administrador","Gerente","Coordenador","Supervisor","Lider","Operador","Cliente"],activeRole="";
    document.getElementById("profiles-count").textContent=roles.length+" perfis";
    function allPermissionDefinitions(){
      var defs=PAGES.filter(function(p){return p.id!=="menu"&&p.id!=="perfil";}).map(function(p){return {key:p.perm,label:p.label,group:"Acesso às abas"};});
      return defs.concat(OP_PERMS.map(function(p){return {key:p.key,label:p.label,group:"Ações"};}),FERIAS_PERMS.map(function(p){return {key:p.key,label:p.label,group:"Ações"};}));
    }
    function drawRoleList(){var box=document.getElementById("profile-defaults-list");box.innerHTML=roles.map(function(role){var count=db.users.filter(function(u){return u.funcao===role;}).length;return '<button class="profile-default-card '+(activeRole===role?'active':'')+'" data-default-role="'+role+'"><span><b>'+role+'</b><small>'+count+' usuário(s)</small></span><span>Configurar →</span></button>';}).join("");box.querySelectorAll("[data-default-role]").forEach(function(btn){btn.onclick=function(){activeRole=btn.dataset.defaultRole;drawRoleList();drawRoleEditor();};});}
    function drawRoleEditor(){var editor=document.getElementById("profile-defaults-editor"),defaults=Object.assign({},DEFAULT_PERMS[activeRole]||{},(db.rolePermissionDefaults&&db.rolePermissionDefaults[activeRole])||{}),defs=allPermissionDefinitions();editor.innerHTML='<div class="profile-editor-head"><div><h3>'+activeRole+'</h3><p>Permissões aplicadas automaticamente ao criar um usuário com este perfil.</p></div></div><div class="profile-permission-grid">'+defs.map(function(d){return '<label><input type="checkbox" data-role-permission="'+d.key+'" '+(defaults[d.key]?'checked':'')+'><span>'+escapeHtml(d.label)+'</span></label>';}).join("")+'</div><div class="actions-row"><button class="btn btn-success" id="role-default-save">Salvar padrão do perfil</button></div>';
      document.getElementById("role-default-save").onclick=async function(){var button=this,next={};editor.querySelectorAll("[data-role-permission]").forEach(function(cb){next[cb.dataset.rolePermission]=cb.checked;});next.menu=true;next.perfil=true;if(activeRole==="Cliente"){next.dashboard=true;next.centralOcorrencias=true;}button.disabled=true;button.textContent="Salvando...";try{if(db.supabaseConnected){var rows=Object.keys(next).map(function(key){return {access_role:activeRole,permission_key:key,allowed:!!next[key]};}),ins=await supabaseClient.from("role_permissions").upsert(rows,{onConflict:"access_role,permission_key"});if(ins.error)throw ins.error;}db.rolePermissionDefaults=db.rolePermissionDefaults||{};db.rolePermissionDefaults[activeRole]=next;saveDB(db);toast("Perfil "+activeRole+" atualizado com sucesso.","success");}catch(error){console.error(error);toast(error.message||"Não foi possível salvar o perfil.","error");}finally{button.disabled=false;button.textContent="Salvar padrão do perfil";}};
    }
    var permissionHub=document.getElementById("permission-hub"),usersPane=document.getElementById("permission-users-pane"),profilesPane=document.getElementById("permission-profiles-pane");
    function showPermissionHub(){permissionHub.style.display="block";usersPane.style.display="none";profilesPane.style.display="none";}
    function openPermissionArea(area){permissionHub.style.display="none";usersPane.style.display=area==="users"?"block":"none";profilesPane.style.display=area==="profiles"?"block":"none";}
    document.querySelectorAll("[data-permission-choice]").forEach(function(button){button.onclick=function(){openPermissionArea(button.dataset.permissionChoice);};});
    document.querySelectorAll("[data-permission-home]").forEach(function(button){button.onclick=showPermissionHub;});
    drawRoleList();
    showPermissionHub();
  }

  var ORG_PALETTE = ["#1f5fd6","#8b3fd6","#e0554c","#0fa895","#e08a1e","#2f7ed8"];

  function renderOrganograma(){
    var wrap = document.getElementById("org-tree-wrap");
    wrap.innerHTML = "";
    if(!db.users.length){wrap.innerHTML='<div class="empty-state">Nenhum usuário cadastrado ainda.</div>';return;}
    var admins=db.users.filter(function(u){return u.cargo==="Administrador"||u.funcao==="Administrador";}),team=db.users.filter(function(u){return admins.indexOf(u)===-1;}),valid={};team.forEach(function(u){valid[u.id]=true;});var byManager={};team.forEach(function(u){var k=u.managerId&&valid[u.managerId]?u.managerId:"__root__";(byManager[k]||(byManager[k]=[])).push(u);});
    var adminWrap=document.getElementById("org-admins-wrap");adminWrap.innerHTML=admins.length?'<div class="org-admins"><b style="font-size:11px;color:var(--muted);text-transform:uppercase">Administradores</b>'+admins.map(function(u){return '<button class="org-admin-chip" data-org-user="'+u.id+'">'+userAvatarHTML(u,"user-photo-sm")+'<span>'+escapeHtml(u.nome)+'</span></button>';}).join("")+'</div>':'';
    function nodeHTML(u,color){return '<div class="org-node" data-org-user="'+u.id+'">'+userAvatarHTML(u,"org-avatar",color)+'<div class="org-card" style="background:'+color+'"><b>'+escapeHtml(u.nome)+'</b><span class="org-cargo">'+escapeHtml(u.cargo.toUpperCase())+'</span><span class="org-user">@'+escapeHtml(u.usuario)+' · '+escapeHtml(u.unidade||"—")+'</span></div></div>';}
    function buildLi(u,color,seen){seen=seen||{};if(seen[u.id])return document.createElement("li");seen[u.id]=true;var li=document.createElement("li");li.innerHTML=nodeHTML(u,color);var children=(byManager[u.id]||[]).filter(function(c){return !seen[c.id];});if(children.length){var ul=document.createElement("ul");children.forEach(function(c,i){ul.appendChild(buildLi(c,ORG_PALETTE[i%ORG_PALETTE.length],seen));});li.appendChild(ul);}return li;}
    var managers=team.filter(function(u){return u.cargo==="Gerente";}),roots=managers.length?managers:team.filter(function(u){return !u.managerId||!valid[u.managerId];});if(!roots.length&&team.length)roots=[team[0]];var tree=document.createElement("ul");tree.className="org-tree";var seen={};roots.forEach(function(u){tree.appendChild(buildLi(u,"var(--navy)",seen));});team.filter(function(u){return !seen[u.id];}).forEach(function(u){tree.appendChild(buildLi(u,"#59617d",seen));});wrap.appendChild(tree);
    function openProfile(id){var u=db.users.find(function(x){return x.id===id;});if(!u)return;var gestor=db.users.find(function(x){return x.id===u.managerId;});document.getElementById("org-profile-body").innerHTML='<div class="profile-view"><div class="profile-view-side">'+userAvatarHTML(u,"profile-view-photo")+'<h3 style="margin:8px 0 3px">'+escapeHtml(u.nome)+'</h3><span class="badge">'+escapeHtml(u.cargo)+'</span></div><div><div class="profile-view-grid">'+[["Usuário","@"+u.usuario],["Matrícula",u.matricula||"—"],["E-mail",u.email],["Função de acesso",u.funcao],["Base",u.unidade||"—"],["Gestor responsável",gestor?gestor.nome:"—"],["Contratação",fmtDateBR(u.dataContratacao)],["Notificações",u.notificationsEnabled===false?"Desativadas":"Ativadas"]].map(function(x){return '<div class="profile-view-field"><span>'+x[0]+'</span><b>'+escapeHtml(x[1])+'</b></div>';}).join("")+'</div><div class="profile-view-field" style="margin-top:10px"><span>Observações</span><b>'+escapeHtml(u.obs||"Sem observações")+'</b></div></div></div>';document.getElementById("org-profile-modal").classList.add("show");}
    document.querySelectorAll("[data-org-user]").forEach(function(el){el.onclick=function(){openProfile(el.dataset.orgUser);};});document.getElementById("org-profile-close").onclick=function(){document.getElementById("org-profile-modal").classList.remove("show");};document.getElementById("org-profile-modal").onclick=function(e){if(e.target===this)this.classList.remove("show");};
  }

  function renderOrganograma(){var wrap=document.getElementById("org-tree-wrap"),admins=db.users.filter(function(u){return u.cargo==="Administrador"||u.funcao==="Administrador";}),team=db.users.filter(function(u){return admins.indexOf(u)===-1;}),valid={};team.forEach(function(u){valid[u.id]=true;});var byManager={};team.forEach(function(u){var key=u.managerId&&valid[u.managerId]?u.managerId:"__root__";(byManager[key]||(byManager[key]=[])).push(u);});function node(u,color){return '<div class="org-node" data-org-user="'+u.id+'">'+userAvatarHTML(u,"org-avatar",color)+'<div class="org-card" style="background:'+color+'"><b>'+escapeHtml(u.nome)+'</b><span class="org-cargo">'+escapeHtml(u.cargo.toUpperCase())+'</span><span class="org-user">@'+escapeHtml(u.usuario)+' · '+escapeHtml(u.unidade||"—")+'</span></div></div>';}var seen={};function branch(u,depth){if(seen[u.id])return "";seen[u.id]=true;var children=(byManager[u.id]||[]).filter(function(x){return !seen[x.id];}),color=depth===0?"var(--navy)":ORG_PALETTE[(depth-1)%ORG_PALETTE.length];return '<div class="org-branch">'+node(u,color)+(children.length?'<div class="org-children">'+children.map(function(c){return branch(c,depth+1);}).join("")+'</div>':'')+'</div>';}var managers=team.filter(function(u){return u.cargo==="Gerente";}),roots=managers.length?managers:team.filter(function(u){return !u.managerId||!valid[u.managerId];});if(!roots.length&&team.length)roots=[team[0]];var treeHtml=roots.map(function(u){return branch(u,0);}).join("")+team.filter(function(u){return !seen[u.id];}).map(function(u){return branch(u,0);}).join("");document.getElementById("org-admins-wrap").innerHTML="";wrap.parentNode.classList.add("org-workspace");wrap.innerHTML='<div class="org-horizontal">'+(treeHtml||'<div class="empty-state">Nenhum colaborador na hierarquia.</div>')+'</div>';var side=document.createElement("aside");side.className="org-admins-side";side.innerHTML='<h3>Administração do sistema</h3>'+(admins.map(function(u){return '<button class="org-admin-chip" data-org-user="'+u.id+'">'+userAvatarHTML(u,"user-photo-sm")+'<span>'+escapeHtml(u.nome)+'</span></button>';}).join("")||'<div class="empty-state">Nenhum administrador.</div>');wrap.parentNode.appendChild(side);function openProfile(id){var u=db.users.find(function(x){return x.id===id;});if(!u)return;var gestor=db.users.find(function(x){return x.id===u.managerId;});document.getElementById("org-profile-body").innerHTML='<div class="profile-view"><div class="profile-view-side">'+userAvatarHTML(u,"profile-view-photo")+'<h3 style="margin:8px 0 3px">'+escapeHtml(u.nome)+'</h3><span class="badge">'+escapeHtml(u.cargo)+'</span></div><div><div class="profile-view-grid">'+[["Usuário","@"+u.usuario],["Matrícula",u.matricula||"—"],["E-mail",u.email],["Função de acesso",u.funcao],["Base",u.unidade||"—"],["Gestor responsável",gestor?gestor.nome:"—"],["Contratação",fmtDateBR(u.dataContratacao)]].map(function(x){return '<div class="profile-view-field"><span>'+x[0]+'</span><b>'+escapeHtml(x[1])+'</b></div>';}).join("")+'</div></div></div>';document.getElementById("org-profile-modal").classList.add("show");}document.querySelectorAll("[data-org-user]").forEach(function(el){el.onclick=function(){openProfile(el.dataset.orgUser);};});document.getElementById("org-profile-close").onclick=function(){document.getElementById("org-profile-modal").classList.remove("show");};}

  function renderOrganograma(){
    var wrap=document.getElementById("org-tree-wrap"),adminWrap=document.getElementById("org-admins-wrap"),admins=db.users.filter(function(u){return u.cargo==="Administrador"||u.funcao==="Administrador";}),team=db.users.filter(function(u){return admins.indexOf(u)===-1;}),valid={},children={};team.forEach(function(u){valid[u.id]=true;});team.forEach(function(u){var key=u.managerId&&valid[u.managerId]?u.managerId:"__root__";(children[key]||(children[key]=[])).push(u);});Object.keys(children).forEach(function(k){children[k].sort(function(a,b){return a.nome.localeCompare(b.nome,"pt-BR");});});
    var managers=team.filter(function(u){return u.cargo==="Gerente";}),roots=managers.length?managers:(children.__root__||[]);if(!roots.length&&team.length)roots=[team[0]];var positions=[],links=[],leaf=0,maxDepth=0,seen={};function place(u,depth,parent){if(seen[u.id])return null;seen[u.id]=true;maxDepth=Math.max(maxDepth,depth);var kids=(children[u.id]||[]).filter(function(c){return !seen[c.id];}),kidPositions=kids.map(function(c){return place(c,depth+1,u);}).filter(Boolean),y;if(kidPositions.length)y=kidPositions.reduce(function(sum,p){return sum+p.y;},0)/kidPositions.length;else{y=50+leaf*92;leaf++;}var pos={u:u,x:28+depth*290,y:y,depth:depth};positions.push(pos);kidPositions.forEach(function(cp){links.push({from:pos,to:cp});});return pos;}roots.forEach(function(r){place(r,0,null);});team.filter(function(u){return !seen[u.id];}).forEach(function(u){place(u,0,null);});var width=Math.max(900,(maxDepth+1)*290+275),height=Math.max(520,leaf*92+100),palette=["#173b67","#326ca3","#3a7c78","#8a6235","#79568f","#a44c55"],paths=links.map(function(l){var x1=l.from.x+230,y1=l.from.y+31,x2=l.to.x,y2=l.to.y+31,mid=(x1+x2)/2;return '<path d="M '+x1+' '+y1+' C '+mid+' '+y1+', '+mid+' '+y2+', '+x2+' '+y2+'" fill="none" stroke="'+palette[Math.min(l.to.depth,palette.length-1)]+'" stroke-width="2" opacity=".48"/>';}).join("");var nodes=positions.map(function(p){return '<button class="mind-node" data-org-user="'+p.u.id+'" data-org-search="'+escapeHtml([p.u.nome,p.u.cargo,p.u.unidade,p.u.matricula].join(" ").toLowerCase())+'" style="left:'+p.x+'px;top:'+p.y+'px;--node-color:'+palette[Math.min(p.depth,palette.length-1)]+'">'+userAvatarHTML(p.u,"user-photo-sm")+'<span><b>'+escapeHtml(p.u.nome)+'</b><small>'+escapeHtml(p.u.cargo)+' · '+escapeHtml(p.u.unidade||"—")+'</small></span></button>';}).join("");
    adminWrap.innerHTML='<div class="org-search-bar"><input id="org-search" placeholder="Buscar colaborador por nome, cargo, base ou matrícula..."><button class="btn btn-secondary" id="org-search-clear">Limpar</button></div><div class="org-admin-strip"><b style="font-size:10px;text-transform:uppercase;color:var(--muted);align-self:center">Administradores fora da hierarquia:</b>'+admins.map(function(u){return '<button class="org-admin-chip" data-org-user="'+u.id+'">'+userAvatarHTML(u,"user-photo-sm")+'<span>'+escapeHtml(u.nome)+'</span></button>';}).join("")+'</div>';wrap.innerHTML=team.length?'<div class="org-mindmap-shell"><div class="org-mindmap" style="width:'+width+'px;height:'+height+'px"><svg width="'+width+'" height="'+height+'">'+paths+'</svg>'+nodes+'</div></div>':'<div class="empty-state">Cadastre Gerentes e suas equipes para montar a estrutura hierárquica.</div>';
    function openProfile(id){var u=db.users.find(function(x){return x.id===id;});if(!u)return;var gestor=db.users.find(function(x){return x.id===u.managerId;});document.getElementById("org-profile-body").innerHTML='<div class="profile-view"><div class="profile-view-side">'+userAvatarHTML(u,"profile-view-photo")+'<h3 style="margin:8px 0 3px">'+escapeHtml(u.nome)+'</h3><span class="badge">'+escapeHtml(u.cargo)+'</span></div><div><div class="profile-view-grid">'+[["Usuário","@"+u.usuario],["Matrícula",u.matricula||"—"],["E-mail",u.email],["Função de acesso",u.funcao],["Base",u.unidade||"—"],["Gestor responsável",gestor?gestor.nome:"—"],["Contratação",fmtDateBR(u.dataContratacao)]].map(function(x){return '<div class="profile-view-field"><span>'+x[0]+'</span><b>'+escapeHtml(x[1])+'</b></div>';}).join("")+'</div></div></div>';document.getElementById("org-profile-modal").classList.add("show");}document.querySelectorAll("[data-org-user]").forEach(function(el){el.onclick=function(){openProfile(el.dataset.orgUser);};});var search=document.getElementById("org-search");search.oninput=function(){var q=search.value.trim().toLowerCase();document.querySelectorAll(".mind-node").forEach(function(node){node.classList.toggle("dimmed",!!q&&node.dataset.orgSearch.indexOf(q)===-1);});};document.getElementById("org-search-clear").onclick=function(){search.value="";search.oninput();search.focus();};document.getElementById("org-profile-close").onclick=function(){document.getElementById("org-profile-modal").classList.remove("show");};document.getElementById("org-profile-modal").onclick=function(e){if(e.target===this)this.classList.remove("show");};
  }

  function userAvatarHTML(u,className,color){var style=u.photo?'background-image:url(&quot;'+u.photo+'&quot;);background-size:cover;background-position:center;':'background:'+(color||'#e8ecf5')+';';return '<span class="'+className+'" style="'+style+'">'+(u.photo?'':escapeHtml((u.nome||"U").charAt(0).toUpperCase()))+'</span>';}

  function renderUsuarios(user){
    var tbody = document.getElementById("users-tbody");
    var search=document.getElementById("users-search"),cargoFilter=document.getElementById("users-cargo-filter"),funcaoFilter=document.getElementById("users-funcao-filter"),baseFilter=document.getElementById("users-base-filter");
    function unique(values){return values.filter(function(v,i,a){return v&&a.indexOf(v)===i;}).sort();}
    cargoFilter.innerHTML='<option value="">Todos os cargos</option>'+unique(db.users.map(function(u){return u.cargo;})).map(function(v){return '<option>'+escapeHtml(v)+'</option>';}).join("");baseFilter.innerHTML='<option value="">Todas as bases</option>'+unique(db.users.map(function(u){return u.unidade;})).map(function(v){return '<option>'+escapeHtml(v)+'</option>';}).join("");
    function draw(){
      tbody.innerHTML = "";
      var q=search.value.trim().toLowerCase(),rows=db.users.filter(function(u){if(cargoFilter.value&&u.cargo!==cargoFilter.value)return false;if(funcaoFilter.value&&u.funcao!==funcaoFilter.value)return false;if(baseFilter.value&&u.unidade!==baseFilter.value)return false;return !q||[u.nome,u.usuario,u.matricula,u.email].join(" ").toLowerCase().indexOf(q)!==-1;});
      if(!rows.length){tbody.innerHTML='<tr><td colspan="7" class="empty-state">Nenhum usuário encontrado com esses filtros.</td></tr>';return;}
      rows.forEach(function(u){
        var tr = document.createElement("tr");
        tr.innerHTML =
          '<td><div class="user-name-cell">'+userAvatarHTML(u,"user-photo-sm")+'<div><b>'+escapeHtml(u.nome)+'</b><br><small>'+escapeHtml(u.cargo)+'</small></div></div></td>'+
          '<td><b>@'+escapeHtml(u.usuario)+'</b><br><small>'+escapeHtml(u.email)+'</small></td>'+
          '<td><span class="badge'+(u.funcao==="Administrador"?" admin":"")+'">'+u.funcao+'</span><br><small>'+(u.active===false?'Inativo':'Ativo')+'</small></td>'+
          '<td>'+escapeHtml(u.unidade||"—")+'</td>'+
           '<td><div class="row-actions">'+
             '<button data-edit="'+u.id+'">Editar</button>'+
             (opPerm(user,"users_reset_password")?'<button data-reset-password="'+u.id+'">Redefinir senha</button>':'')+
             '<button data-del="'+u.id+'" class="del">'+(u.active===false?'Ativar':'Desativar')+'</button>'+
          '</div></td>';
        tbody.appendChild(tr);
      });
      tbody.querySelectorAll("[data-edit]").forEach(function(b){
        b.addEventListener("click", function(){ openUserModal(b.getAttribute("data-edit")); });
      });
      tbody.querySelectorAll("[data-del]").forEach(function(b){
        b.addEventListener("click",function(){
          var id=b.getAttribute("data-del"),target=db.users.find(function(x){return x.id===id;});
          if(!target)return;if(id===user.id){toast("Você não pode excluir o próprio usuário logado.","error");return;}
          openUserRemoval(target);
        });
      });
      function openUserRemoval(target){
        var existing=document.getElementById('user-removal-modal');if(existing)existing.remove();
        document.body.insertAdjacentHTML('beforeend','<div class="modal-overlay show" id="user-removal-modal"><div class="modal-card v55-removal-card"><div class="modal-head"><div><small>ADMINISTRAÇÃO DE ACESSO</small><h2>Excluir usuário</h2></div><button type="button" id="user-removal-x" aria-label="Fechar">×</button></div><div class="v55-user-summary">'+userAvatarHTML(target,'profile-view-photo')+'<div><strong>'+escapeHtml(target.nome)+'</strong><span>@'+escapeHtml(target.usuario)+' · '+escapeHtml(target.funcao||target.cargo)+'</span><span>'+escapeHtml(target.email||'')+' · '+escapeHtml(target.unidade||'Sem base')+'</span></div></div><div class="fgroup"><label>Motivo da exclusão *</label><textarea id="user-removal-reason" rows="4" placeholder="Descreva por que este usuário será excluído"></textarea></div><div class="v55-removal-confirm" id="user-removal-confirm" hidden><strong>Tem certeza que deseja excluir o usuário?</strong><p>Após confirmar, ele deixará de aparecer na lista de usuários.</p></div><div class="actions-row" style="justify-content:flex-end"><button type="button" class="btn btn-secondary" id="user-removal-cancel">Cancelar</button><button type="button" class="btn btn-danger" id="user-removal-next">Concluir</button><button type="button" class="btn btn-danger" id="user-removal-yes" style="display:none">Sim, excluir usuário</button></div></div></div>');
        var modal=document.getElementById('user-removal-modal'),reason=document.getElementById('user-removal-reason'),next=document.getElementById('user-removal-next'),yes=document.getElementById('user-removal-yes');function close(){modal.remove();}document.getElementById('user-removal-x').onclick=close;document.getElementById('user-removal-cancel').onclick=close;modal.onclick=function(e){if(e.target===modal)close();};next.onclick=function(){if(!reason.value.trim()){toast('Informe o motivo da exclusão.','error');reason.focus();return;}reason.disabled=true;document.getElementById('user-removal-confirm').hidden=false;next.style.display='none';yes.style.display='inline-flex';};yes.onclick=async function(){yes.disabled=true;var motive=reason.value.trim();if(db.supabaseConnected){try{var result=await supabaseClient.functions.invoke('admin-manage-user',{body:{action:'set-active',user_id:target.id,active:false}});if(result.error)console.warn('Exclusão remota pendente:',result.error);}catch(error){console.warn('Exclusão remota pendente:',error);}}db.users=db.users.filter(function(x){return x.id!==target.id;});addLog('Usuário excluído: '+target.usuario+' — Motivo: '+motive);addChangeLog('Usuário excluído',target.nome+' ('+target.usuario+') foi excluído. Motivo: '+motive,target.id,target.nome);saveDB(db);close();draw();toast('Usuário excluído.','success');};
      }      tbody.querySelectorAll("[data-reset-password]").forEach(function(b){
        b.addEventListener("click",function(){openPasswordResetModal(b.getAttribute("data-reset-password"));});
      });
    }
    draw();
    [search,cargoFilter,funcaoFilter,baseFilter].forEach(function(el){el.addEventListener("input",draw);el.addEventListener("change",draw);});
    document.getElementById("novo-usuario-btn").addEventListener("click", function(){
      openUserModal(null);
    });
    window._refreshUsersTable = draw;
  }

  /* user modal (create / edit) shared */
  var modalOverlay = document.getElementById("user-modal-overlay");
  function selectedUserRole(){return document.getElementById("um-funcao").value;}
  function syncUserRoleFields(){
    var role=selectedUserRole(),manager=document.getElementById("um-manager"),managerGroup=document.getElementById("um-manager-group"),base=document.getElementById("um-unidade"),baseGroup=document.getElementById("um-base-group"),transporter=document.getElementById("um-transporter"),transporterGroup=document.getElementById("um-transporter-group");
    document.getElementById("um-cargo").value=role;
    var isClient=role==="Cliente",isOperator=role==="Operador";
    managerGroup.hidden=isClient;manager.disabled=isClient;manager.required=!isClient;
    baseGroup.hidden=!isOperator;base.disabled=!isOperator;base.required=isOperator;
    transporterGroup.hidden=!isClient;transporter.disabled=!isClient;transporter.required=isClient;
    if(isClient){manager.value="";base.value="";}else transporter.value="";
    if(!isOperator)base.value="";
  }
  function openUserModal(id){
    var isEdit = !!id;
    document.getElementById("user-modal-title").textContent = isEdit ? "Editar usuário" : "Novo usuário";
    var u = isEdit ? db.users.find(function(x){ return x.id === id; }) : null;
    document.getElementById("um-id").value = id || "";
    document.getElementById("um-nome").value = u ? u.nome : "";
    document.getElementById("um-usuario").value = u ? u.usuario : "";
    document.getElementById("um-matricula").value = u ? (u.matricula||"") : "";
    var emailInput=document.getElementById("um-email"),passwordInput=document.getElementById("um-senha");
    emailInput.value = u ? u.email : "";
    passwordInput.value = "";
    emailInput.disabled = false;
    passwordInput.disabled = false;
    passwordInput.required = !isEdit;
    passwordInput.placeholder = isEdit&&db.supabaseConnected ? "Deixe vazio para manter a senha atual" : "Mínimo de 8 caracteres";
    document.getElementById("um-cargo").value = u ? u.cargo : "Operador";
    document.getElementById("um-funcao").value = u ? CSRRules.role(u) : "Operador";
    var unitInput=document.getElementById("um-unidade");unitInput.innerHTML='<option value="">Selecione a base</option>'+db.operationalBases.map(function(base){return '<option value="'+base.id+'">'+escapeHtml(base.name)+'</option>';}).join('');unitInput.value=u&&u.baseId?u.baseId:"";
    var transporterInput=document.getElementById("um-transporter");transporterInput.innerHTML='<option value="">Selecione a transportadora</option>'+db.transporters.map(function(item){return '<option value="'+item.id+'">'+escapeHtml(item.name)+'</option>';}).join('');transporterInput.value=u&&u.transporterId?u.transporterId:"";
    document.getElementById("um-data-contratacao").value = u ? (u.dataContratacao||"") : "";
    document.getElementById("um-obs").value = u ? (u.obs||"") : "";
    var notifPrefs = u && u.notificationPrefs ? u.notificationPrefs : {sinistro:u ? u.notifySinistro !== false : true, ferias:true, sistema:true, alertas:true};
    document.getElementById("um-notif-enabled").checked = u ? u.notificationsEnabled !== false : true;
    document.getElementById("um-notif-sinistro").checked = notifPrefs.sinistro !== false;
    document.getElementById("um-notif-ferias").checked = notifPrefs.ferias !== false;
    document.getElementById("um-notif-sistema").checked = notifPrefs.sistema !== false;
    document.getElementById("um-notif-alertas").checked = notifPrefs.alertas !== false;
    syncNotificationOptions();

    var mgrSel = document.getElementById("um-manager");
    mgrSel.innerHTML = '<option value="">Selecione o gestor responsável</option>';mgrSel.required=true;
    db.users.forEach(function(other){
      if((isEdit&&other.id===id)||['Operador','Cliente'].indexOf(CSRRules.role(other))!==-1||other.active===false)return;
      var opt = document.createElement("option");
      opt.value = other.id;
      opt.textContent = other.nome + " - " + other.cargo;
      mgrSel.appendChild(opt);
    });
    mgrSel.value = u && u.managerId ? u.managerId : "";
    syncUserRoleFields();

    document.getElementById("user-modal-submit").textContent=isEdit?"Salvar alterações":"Criar usuário";

    modalOverlay.classList.add("show");
  }
  function closeUserModal(){ modalOverlay.classList.remove("show"); }
  document.getElementById("user-modal-close").addEventListener("click", closeUserModal);
  document.getElementById("user-modal-cancel").addEventListener("click", closeUserModal);
  modalOverlay.addEventListener("click", function(e){ if(e.target === modalOverlay) closeUserModal(); });

  function syncNotificationOptions(){
    var enabled = document.getElementById("um-notif-enabled").checked;
    document.getElementById("um-notif-settings").classList.toggle("is-disabled", !enabled);
    document.querySelectorAll("[data-notif-option]").forEach(function(input){ input.disabled = !enabled; });
  }
  document.getElementById("um-notif-enabled").addEventListener("change", syncNotificationOptions);
  document.getElementById("um-funcao").addEventListener("change", syncUserRoleFields);

  var passwordResetModal=document.getElementById("password-reset-modal");
  function openPasswordResetModal(id){
    if(!opPerm(currentUser(),"users_reset_password")){toast("Você não possui permissão para redefinir senhas.","error");return;}
    var target=db.users.find(function(u){return u.id===id;});if(!target)return;
    document.getElementById("password-reset-user-id").value=id;
    document.getElementById("password-reset-target").textContent="Usuário: "+target.nome+" (@"+target.usuario+")";
    document.getElementById("password-reset-value").value="";
    document.getElementById("password-reset-confirm").value="";
    passwordResetModal.classList.add("show");
    setTimeout(function(){document.getElementById("password-reset-value").focus();},30);
  }
  function closePasswordResetModal(){passwordResetModal.classList.remove("show");}
  document.getElementById("password-reset-close").addEventListener("click",closePasswordResetModal);
  document.getElementById("password-reset-cancel").addEventListener("click",closePasswordResetModal);
  passwordResetModal.addEventListener("click",function(e){if(e.target===passwordResetModal)closePasswordResetModal();});
  document.getElementById("password-reset-form").addEventListener("submit",async function(e){
    e.preventDefault();
    if(!opPerm(currentUser(),"users_reset_password")){toast("Você não possui permissão para redefinir senhas.","error");return;}
    var id=document.getElementById("password-reset-user-id").value,password=document.getElementById("password-reset-value").value,confirmPassword=document.getElementById("password-reset-confirm").value,button=document.getElementById("password-reset-submit"),target=db.users.find(function(u){return u.id===id;});
    if(password.length<8){toast("A senha precisa ter pelo menos 8 caracteres.","error");return;}
    if(password!==confirmPassword){toast("As senhas informadas não coincidem.","error");return;}
    button.disabled=true;button.textContent="Redefinindo...";
    try{
      if(db.supabaseConnected){
        var result=await supabaseClient.functions.invoke("admin-manage-user",{body:{action:"reset-password",user_id:id,password:password}});
        if(result.error)throw new Error(await edgeFunctionErrorMessage(result.error,"Não foi possível redefinir a senha."));
      }else if(target){target.senha=password;target.mustChangePassword=true;saveDB(db);}
      addLog("Senha temporária criada para "+(target?target.usuario:id));
      addChangeLog("Senha temporária criada","Uma senha temporária foi criada para "+(target?target.usuario:id)+" por usuário autorizado.",id,target?target.nome:"");
      closePasswordResetModal();toast("Senha temporária criada com segurança.","success");
    }catch(error){console.error("Falha ao redefinir senha",error);toast(error.message||"Não foi possível redefinir a senha.","error");}
    finally{button.disabled=false;button.textContent="Salvar senha temporária";}
  });

  function readNotificationPrefs(){
    return {
      sinistro: document.getElementById("um-notif-sinistro").checked,
      ferias: document.getElementById("um-notif-ferias").checked,
      sistema: document.getElementById("um-notif-sistema").checked,
      alertas: document.getElementById("um-notif-alertas").checked
    };
  }

  document.getElementById("user-modal-form").addEventListener("submit", async function(e){
    e.preventDefault();
    document.getElementById("um-cargo").value=document.getElementById("um-funcao").value;
    var selectedRole=selectedUserRole();
    if(selectedRole!=="Cliente"&&!document.getElementById("um-manager").value){toast("Selecione o gestor responsável.","error");return;}
    if(selectedRole==="Operador"&&!document.getElementById("um-unidade").value){toast("Selecione a base do operador.","error");return;}
    if(selectedRole==="Cliente"&&!document.getElementById("um-transporter").value){toast("Selecione a transportadora do cliente.","error");return;}
    var id = document.getElementById("um-id").value;
    var usuario = document.getElementById("um-usuario").value.trim();
    var submitButton=document.getElementById("user-modal-submit");
    var dup = db.users.find(function(x){ return x.usuario.toLowerCase() === usuario.toLowerCase() && x.id !== id; });
    if(dup){ toast("Já existe um usuário com esse login.", "error"); return; }

    if(db.supabaseConnected){
      submitButton.disabled=true;
      submitButton.textContent=id?"SALVANDO...":"CRIANDO...";
      try{
        var notificationPrefs=readNotificationPrefs();
        if(id){
          var profileUpdate={
            action:"update",
            user_id:id,
            full_name:document.getElementById("um-nome").value.trim(),
            username:usuario,
            employee_code:document.getElementById("um-matricula").value.trim()||(db.users.find(function(x){return x.id===id;})||{}).matricula||null,
            email:document.getElementById("um-email").value.trim().toLowerCase(),
            password:document.getElementById("um-senha").value,
            job_title:document.getElementById("um-funcao").value,
            access_role:document.getElementById("um-funcao").value,
            base_id:document.getElementById("um-unidade").value||null,
            transporter_id:document.getElementById("um-transporter").value||null,
            manager_id:selectedRole==="Cliente"?null:(document.getElementById("um-manager").value||null),
            hire_date:document.getElementById("um-data-contratacao").value||null,
            notes:document.getElementById("um-obs").value.trim()||null,
            notifications_enabled:document.getElementById("um-notif-enabled").checked,
            notification_preferences:notificationPrefs
          };
          var updateResult=await supabaseClient.functions.invoke("admin-manage-user",{body:profileUpdate});
          if(updateResult.error)throw new Error(await edgeFunctionErrorMessage(updateResult.error,"Não foi possível atualizar o usuário."));
          addLog("Usuário Supabase editado: "+usuario);
          toast("Usuário atualizado e compartilhado.","success");
        }else{
          var password=document.getElementById("um-senha").value;
          if(password.length<8)throw new Error("A senha precisa ter pelo menos 8 caracteres.");
          var createResult=await supabaseClient.functions.invoke("admin-create-user",{body:{
            full_name:document.getElementById("um-nome").value.trim(),
            username:usuario,
            employee_code:document.getElementById("um-matricula").value.trim()||null,
            email:document.getElementById("um-email").value.trim().toLowerCase(),
            password:password,
            job_title:document.getElementById("um-funcao").value,
            access_role:document.getElementById("um-funcao").value,
            base_id:document.getElementById("um-unidade").value||null,
            transporter_id:document.getElementById("um-transporter").value||null,
            manager_id:selectedRole==="Cliente"?null:(document.getElementById("um-manager").value||null),
            notifications_enabled:document.getElementById("um-notif-enabled").checked,
            notification_preferences:notificationPrefs
          }});
          if(createResult.error)throw new Error(await edgeFunctionErrorMessage(createResult.error,"Não foi possível criar o usuário."));
          if(!createResult.data||!createResult.data.profile)throw new Error((createResult.data&&createResult.data.error)||"A função não retornou o perfil criado.");
          var extraProfile={hire_date:document.getElementById("um-data-contratacao").value||null,notes:document.getElementById("um-obs").value.trim()||null};
          var extraResult=await supabaseClient.from("profiles").update(extraProfile).eq("id",createResult.data.profile.id);if(extraResult.error)throw extraResult.error;
          addLog("Novo usuário criado: "+usuario);
          toast("Usuário criado.","success");
        }
        var currentAuth=await supabaseClient.auth.getUser();
        if(currentAuth.error||!currentAuth.data.user)throw currentAuth.error||new Error("Sessão administrativa não encontrada.");
        await syncSupabaseProfiles(currentAuth.data.user);
        closeUserModal();
        if(window._refreshUsersTable)window._refreshUsersTable();
        return;
      }catch(error){
        console.error("Falha ao salvar usuário no Supabase",error);
        toast(error&&error.message?error.message:"Não foi possível salvar o usuário.","error");
        return;
      }finally{
        submitButton.disabled=false;
        submitButton.textContent=id?"Salvar alterações":"Criar usuário";
      }
    }

    if(id){
      var u = db.users.find(function(x){ return x.id === id; });
      var before = {nome:u.nome, usuario:u.usuario, email:u.email, cargo:u.cargo, funcao:u.funcao, unidade:u.unidade, obs:u.obs||"", matricula:u.matricula||"", dataContratacao:u.dataContratacao||""};
      var senhaAntes = u.senha;
      u.nome = document.getElementById("um-nome").value.trim();
      u.usuario = usuario;
      u.matricula = document.getElementById("um-matricula").value.trim();
      u.email = document.getElementById("um-email").value.trim();
      u.senha = document.getElementById("um-senha").value;
      u.cargo = document.getElementById("um-funcao").value;
      u.funcao = document.getElementById("um-funcao").value;
      u.baseId = document.getElementById("um-unidade").value||null;
      u.unidade = (db.operationalBases.find(function(b){return b.id===u.baseId;})||{}).name||"";
      u.transporterId=document.getElementById("um-transporter").value||null;
      u.dataContratacao = document.getElementById("um-data-contratacao").value;
      u.obs = document.getElementById("um-obs").value.trim();
      u.managerId = selectedRole==="Cliente" ? null : (document.getElementById("um-manager").value || null);
      u.notificationsEnabled = document.getElementById("um-notif-enabled").checked;
      u.notificationPrefs = readNotificationPrefs();
      u.notifySinistro = u.notificationsEnabled && u.notificationPrefs.sinistro;
      addLog("Usuário editado: " + u.usuario);
      logProfileDiffs(before, u, u.nome);
      if(senhaAntes !== u.senha){ addProfileLog(u.id, u.nome, "Senha", "••••••", "••••••"); }
      addChangeLog("Usuário editado", "Dados de " + u.nome + " (" + u.usuario + ") foram atualizados por um administrador.", u.id, u.nome);
      toast("Usuário atualizado.", "success");
    } else {
      var newUser = {
        id: "u-" + Date.now(),
        nome: document.getElementById("um-nome").value.trim(),
        usuario: usuario,
        matricula: document.getElementById("um-matricula").value.trim(),
        email: document.getElementById("um-email").value.trim(),
        senha: document.getElementById("um-senha").value,
        cargo: document.getElementById("um-funcao").value,
        funcao: document.getElementById("um-funcao").value,
        baseId: document.getElementById("um-unidade").value||null,
        unidade: (db.operationalBases.find(function(b){return b.id===document.getElementById("um-unidade").value;})||{}).name||"",
        transporterId:document.getElementById("um-transporter").value||null,
        dataContratacao: document.getElementById("um-data-contratacao").value,
        obs: document.getElementById("um-obs").value.trim(),
        managerId: selectedRole==="Cliente" ? null : (document.getElementById("um-manager").value || null),
        notificationsEnabled: document.getElementById("um-notif-enabled").checked,
        notificationPrefs: readNotificationPrefs(),
        notifySinistro: document.getElementById("um-notif-enabled").checked && document.getElementById("um-notif-sinistro").checked,
        perms: null
      };
      db.users.push(newUser);
      addLog("Novo usuário criado: " + newUser.usuario);
      addChangeLog("Usuário criado", newUser.nome + " (" + newUser.usuario + ") foi cadastrado.", newUser.id, newUser.nome);
      addNotification(newUser.id, "sistema", "Bem-vindo(a) ao sistema!", "Sua conta foi criada e suas preferências de notificação já estão configuradas.", "perfil", newUser.id);
      toast("Usuário criado com sucesso.", "success");
    }
    saveDB(db);
    closeUserModal();
    if(window._refreshUsersTable) window._refreshUsersTable();
    refreshNotifBadge();
  });

  var ALERTA_TYPES = [
    "ABANDONO DE COMBOIO","MOTORISTA ENVOLVIDO EM ACIDENTE","AGUARDANDO DESCARGA","ARROMBAMENTO DE BAÚ",
    "DESENGATE NÃO AUTORIZADO","ANTENA GPS COM DEFEITO","ATRASO DE INÍCIO DE VIAGEM","BLOQUEIO INATIVO",
    "BOTÃO DE PÂNICO","ABERTURA PORTA MOTORISTA NÃO AUTORIZADA","ABERTURA PORTA CARONA NÃO AUTORIZADA",
    "COMANDOS NÃO ATUAM NO VEÍCULO","COMBOIO NÃO AUTORIZADO","PROBLEMAS NO RASTREADOR","DESVIO DE ROTA",
    "DEVOLUÇÃO DA CARGA","ENTREGA FORA DA DATA","ESPELHAMENTO INCORRETO","FATOR DE CALIBRAÇÃO",
    "FIM DE VIAGEM COM VEÍCULO CARREGADO","MACRO DE FIM DE VIAGEM NÃO ENVIADA","FIM DE VIAGEM FORA DO LOCAL DE DESTINO",
    "SOLICITAÇÃO DE MONITORAMENTO INCORRETA","MACRO DE INÍCIO DE VIAGEM NÃO INFORMADA","INÍCIO DE VIAGEM SEM LIBERAÇÃO DA CENTRAL",
    "MACRO FORA DO PADRÃO","ID DO EQUIPAMENTO INCORRETO","MENSAGEM DE COAÇÃO","MOTORISTA INDISCIPLINADO",
    "NÃO SE APRESENTOU AO PACR","PARADA EM ÁREA DE RISCO","PARADA INDEVIDA","MACRO DE PARADA NÃO INFORMADA",
    "PERDA DE SINAL","PERDA DE GPS","PROBLEMA MECÂNICO","MACRO DE REINÍCIO DE VIAGEM NÃO INFORMADA",
    "REINÍCIO COM OCORRÊNCIA","SIRENE INOPERANTE","TECLADO INOPERANTE","TRAFEGANDO FORA DO HORÁRIO",
    "INTERFERÊNCIA NO MONITORAMENTO","TRAVA DE BAÚ - (EQUIPAMENTO)","TROCA DA CARRETA NÃO INFORMADA",
    "TROCA DE CAVALO MECÂNICO NÃO INFORMADA","TROCA DE MOTORISTA NÃO INFORMADA","VEÍCULO RETIRADO DA CONTA EM VIAGEM",
    "VEÍCULO SEM RASTREADOR","VEÍCULO SEM SMP","SINAL NÃO DISPONÍVEL","PERNOITE EM LOCAL NÃO AUTORIZADO",
    "SENSOR DE PAINEL","FALTA ORDEM DE COLETA","NÚMERO DE TRANSPORTE INCORRETO",
    "DOCUMENTO CRLV VENCIDO - VEÍCULO TOCO/TRUCK","DOCUMENTO CRLV VENCIDO - CAVALO MECÂNICO","DOCUMENTO CRLV VENCIDO - CARRETA",
    "MOTORISTA NÃO POSSUI CADASTRO PAMCARY","PAMCARY VENCIDA","LIBERAÇÃO PAMCARY BAIXA","MANUTENÇÃO",
    "RETIDO EM POSTO FISCAL","ROUBO DE CARGA","ROUBO DE CARGA COM RECUPERAÇÃO","TENTATIVA DE ROUBO DE CARGA (FRUSTRADO)",
    "ROUBO PARCIAL DE CARGA","FURTO","SUSPEITA DE ROUBO","PERSEGUIÇÃO","TEMPERATURA (CONGELADO)",
    "TEMPERATURA (RESFRIADO)","TEMPERATURA (CLIMATIZADO)","ESCOLTA","TRANSBORDO AUTORIZADO","ABANDONO DE VEÍCULO",
    "INTEGRAÇÃO MV","LIBERAÇÃO EXCEPCIONAL","ACIDENTE NA PISTA","MOTORISTA SEM VÍNCULO PAMCARY COM A DHL",
    "SUSPEITA DE SINISTRO","ROUBO CONFIRMADO","SEM CONTATO COM O MOTORISTA","MOTORISTA NÃO IRÁ ATENDER A DEMANDA",
    "AGUARDANDO DESCARGA NO HUB","AGUARDANDO FINALIZAÇÃO DE OUTRA DEMANDA","MOTORISTA ESCALADO PARA DUAS COLETAS",
    "OUTRAS","MOTORISTA NÃO ESTÁ CIENTE DA DEMANDA","VEÍCULO SEM ESPELHAMENTO","VEÍCULO SEM CHECKLIST"
  ];

  var ALERTA_SITUACAO_EXTRA = [
    "PERDA DE SINAL","PERDA DE GPS","SINAL NÃO DISPONÍVEL","VEÍCULO SEM RASTREADOR","PROBLEMAS NO RASTREADOR",
    "INTERFERÊNCIA NO MONITORAMENTO","VEÍCULO SEM ESPELHAMENTO","ACIDENTE NA PISTA","TROCA DA CARRETA NÃO INFORMADA",
    "TROCA DE CAVALO MECÂNICO NÃO INFORMADA","TROCA DE MOTORISTA NÃO INFORMADA","ARROMBAMENTO DE BAÚ",
    "ABERTURA PORTA CARONA NÃO AUTORIZADA","ABERTURA PORTA MOTORISTA NÃO AUTORIZADA","BOTÃO DE PÂNICO","DESENGATE NÃO AUTORIZADO"
  ];
  var ALERTA_EXTRA_ONLY = [
    "REINÍCIO COM OCORRÊNCIA","DESVIO DE ROTA","PARADA INDEVIDA","PARADA EM ÁREA DE RISCO",
    "PERNOITE EM LOCAL NÃO AUTORIZADO","PROBLEMA MECÂNICO","OUTRAS"
  ];

  function saudacaoHorario(){
    var h = new Date().getHours();
    if(h < 12) return "Bom Dia";
    if(h < 18) return "Boa Tarde";
    return "Boa Noite";
  }

  function renderOcorrencia(){
    var tipoSel=document.getElementById("oc-tipo");
    tipoSel.innerHTML=settingOptions("alertas","Selecione o tipo de alerta");
    var contatoSel=document.getElementById("oc-contato");
    function updateConditionalFields(){
      var alerta=(tipoSel.value||"").toUpperCase(), showSituacao=ALERTA_SITUACAO_EXTRA.indexOf(alerta)!==-1;
      var showExtra=showSituacao||ALERTA_EXTRA_ONLY.indexOf(alerta)!==-1;
      document.getElementById("oc-situacao-wrap").style.display=showSituacao?"flex":"none";
      document.getElementById("oc-extra-wrap").style.display=showExtra?"flex":"none";
    }
    tipoSel.onchange=updateConditionalFields; updateConditionalFields();
    contatoSel.onchange=function(){var g=document.getElementById("oc-gestao");if(contatoSel.value==="Não"){g.checked=true;g.disabled=true}else g.disabled=false};
    document.getElementById("oc-gerar").onclick=function(){
      var alerta=tipoSel.value,nome=fieldValue("oc-nome"),numero=fieldValue("oc-numero"),sm=fieldValue("oc-sm"),rota=fieldValue("oc-rota"),local=fieldValue("oc-local"),via=fieldValue("oc-via"),contato=fieldValue("oc-contato"),ref=fieldValue("oc-referencia"),extra=fieldValue("oc-info"),situacao=fieldValue("oc-situacao");
      if(!alerta||!nome||!numero||!sm||!rota||!local||!via||!contato){toast("Preencha todos os campos obrigatórios.","error");return}
      var texto="SM: "+sm+"\nNome do condutor: "+nome+"\nRota: "+rota+"\n\n";
      texto+="Identificamos que o "+ref.toLowerCase()+" veio a gerar "+alerta.toLowerCase()+".\n";
      if(contato==="Sim") texto+="Realizamos contato com o condutor "+nome+" via "+via+" através do número "+numero+", com sucesso.";
      else texto+="Realizamos tentativa de contato com o condutor "+nome+" via "+via+" através do número "+numero+", porém não conseguimos contato.";
      if(extra) texto+="\nInformação da tratativa: "+extra+".";
      if(situacao) texto+="\nSituação do veículo: "+situacao+".";
      if(document.getElementById("oc-gestao").checked) texto+="\nSituação repassada à gestão.";
      texto+="\n\nLocal: "+local;
      document.getElementById("ocorrencia-output").value=texto;
      addLog("Descritivo gerado ("+alerta+")"); addChangeLog("Descritivo gerado",alerta+" — condutor: "+nome,null,""); toast("Descritivo gerado.","success");
    };
    document.getElementById("oc-copiar").onclick=function(){var ta=document.getElementById("ocorrencia-output");if(!ta.value){toast("Gere o descritivo antes de copiar.","error");return}navigator.clipboard.writeText(ta.value).then(function(){toast("Texto copiado.","success")}).catch(function(){ta.select();document.execCommand("copy");toast("Texto copiado.","success")})};
  }

  /* ---------- assistente operacional ---------- */
  function renderAssistente(){
    var user=currentUser(), key=user?user.id:"anon"; if(!db.aiConversations[key]) db.aiConversations[key]=[];
    var tabs=document.querySelectorAll("[data-ai-tab]");
    function canAdmin(){return user&&opPerm(user,"ai_config");}
    function switchAI(tab){tabs.forEach(function(b){b.classList.toggle("active",b.dataset.aiTab===tab);});["chat","config","manuals"].forEach(function(t){document.getElementById("ai-tab-"+t).style.display=t===tab?"block":"none";});if(tab==="config")drawConfig();if(tab==="manuals")initTechnologyManuals(document.getElementById("ai-tab-manuals"),showAIHub);}
    tabs.forEach(function(b){if((b.dataset.aiTab==="config"&&!canAdmin()))b.style.display="none";b.onclick=function(){switchAI(b.dataset.aiTab);};});
    var aiShell=document.querySelector(".ai-modern"),aiSide=aiShell.querySelector(".ops-side"),aiMain=aiShell.querySelector(".ops-main");aiSide.style.display="none";aiMain.style.display="none";var aiHub=document.createElement("section");aiHub.className="assistant-hub";aiHub.innerHTML='<div class="assistant-menu-grid"><button class="menu-card" data-ai-choice="chat"><span>Conversa operacional<small>Orientação, organização de tratativas e resumos</small></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+icon("chat")+'</svg></button><button class="menu-card '+(canAdmin()?'':'locked')+'" data-ai-choice="config"><span>Configuração IA<small>Instruções e base de conhecimento</small></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+icon("shield")+'</svg></button><button class="menu-card" data-ai-choice="manuals"><span>Manuais tecnologias<small>Procedimentos de desbloqueio por equipamento</small></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z"/></svg></button></div>';aiShell.insertBefore(aiHub,aiMain);function showAIHub(){aiMain.style.display="none";aiHub.style.display="block";["chat","config","manuals"].forEach(function(t){document.getElementById("ai-tab-"+t).style.display="none";});}function openAIArea(tab){aiHub.style.display="none";aiMain.style.display="block";switchAI(tab);var section=document.getElementById("ai-tab-"+tab);if(!section.querySelector("[data-ai-home]")){var back=document.createElement("button");back.className="subpage-back";back.setAttribute("data-ai-home","");back.textContent="← Voltar às opções do Assistente";section.insertBefore(back,section.firstChild);back.onclick=showAIHub;}}aiHub.querySelectorAll("[data-ai-choice]:not(.locked)").forEach(function(b){b.onclick=function(){openAIArea(b.dataset.aiChoice);};});showAIHub();
    function drawMessages(){var box=document.getElementById("ai-messages"),msgs=db.aiConversations[key];box.innerHTML=msgs.length?msgs.map(function(m,i){return '<div class="ai-msg '+m.role+'">'+escapeHtml(m.text)+'<small>'+new Date(m.at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+(m.role==="assistant"?' · <button class="link-btn" data-copy-ai="'+i+'">Copiar</button>':'')+'</small></div>';}).join(""):'<div class="ai-msg assistant">Olá! Sou o Assistente operacional. Explique a situação com placa, horário, base e o que já foi feito. Vou ajudar a organizar a tratativa sem inventar procedimentos internos.</div>';box.querySelectorAll("[data-copy-ai]").forEach(function(b){b.onclick=function(){navigator.clipboard.writeText(msgs[Number(b.dataset.copyAi)].text);toast("Resposta copiada.","success");};});box.scrollTop=box.scrollHeight;}
    function topic(text){text=text.toLowerCase();if(/mecân|guincho|pane/.test(text))return"Problema mecânico";if(/contato|comunica|motorista/.test(text))return"Comunicação";if(/parad|risco|rota/.test(text))return"Parada e risco";if(/ocorr|registr|descrit/.test(text))return"Registro de alerta";if(/resum/.test(text))return"Resumo";return"Orientação geral";}
    function localAnswer(text){return CSRFlows.answer(text);}
    function send(){var input=document.getElementById("ai-input"),text=input.value.trim();if(!text)return;var msgs=db.aiConversations[key];msgs.push({role:"user",text:text,at:Date.now()});db.aiQueries.push({userId:user.id,userNome:user.nome,topic:topic(text),text:text,at:Date.now()});input.value="";drawMessages();setTimeout(function(){msgs.push({role:"assistant",text:localAnswer(text),at:Date.now()});saveDB(db);drawMessages();},250);saveDB(db);}
    document.getElementById("ai-send").onclick=send;document.getElementById("ai-input").onkeydown=function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}};document.querySelectorAll(".quick-chip").forEach(function(b){b.onclick=function(){document.getElementById("ai-input").value=b.textContent;document.getElementById("ai-input").focus();};});document.getElementById("ai-new-chat").onclick=function(){if(confirm("Iniciar nova conversa? O histórico desta conversa será limpo neste dispositivo.")){db.aiConversations[key]=[];saveDB(db);drawMessages();}};document.getElementById("ai-attach-btn").onclick=function(){document.getElementById("ai-attach").click();};document.getElementById("ai-attach").onchange=function(){if(this.files[0])document.getElementById("ai-input").value+="\n[Arquivo anexado localmente: "+this.files[0].name+"]";};
    function drawAnalysis(){var q=db.aiQueries||[],mine=canAdmin()?q:q.filter(function(x){return x.userId===user.id;}),counts={};mine.forEach(function(x){counts[x.topic]=(counts[x.topic]||0)+1;});var pairs=Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];});document.getElementById("ai-analysis-cards").innerHTML='<div class="ops-card"><b>'+mine.length+'</b><span>Consultas registradas</span></div><div class="ops-card"><b>'+new Set(mine.map(function(x){return x.userId;})).size+'</b><span>Operadores com dados</span></div><div class="ops-card"><b>'+(pairs[0]||"—")+'</b><span>Tema mais consultado</span></div><div class="ops-card"><b>'+(mine.length<3?"Insuficiente":"Disponível")+'</b><span>Base para análise</span></div>';document.getElementById("ai-analysis-list").innerHTML=mine.length<3?'<div class="empty-state">Ainda não há dados suficientes para conclusões confiáveis.</div>':pairs.map(function(p){return '<div class="fr-chart-row"><span class="fr-chart-label">'+escapeHtml(p)+'</span><div class="fr-chart-track"><div class="fr-chart-fill" style="width:'+Math.round(counts[p]/mine.length*100)+'%"></div></div><b>'+Math.round(counts[p]/mine.length*100)+'%</b></div>';}).join("");}
    function drawConfig(){CSRFlows.manualEditor();document.getElementById("ai-instructions").value=db.aiInstructions||"";var list=document.getElementById("ai-kb-list");list.innerHTML=db.aiKnowledge.map(function(f){return '<div class="kb-item"><div><b>'+escapeHtml(f.name)+'</b><br><small>'+escapeHtml(f.type||"arquivo")+' · '+new Date(f.at).toLocaleString("pt-BR")+' · '+escapeHtml(f.by)+'</small></div><span class="status-pill tratado">'+escapeHtml(f.status)+'</span>'+(f.storagePath?'<button class="btn btn-secondary btn-sm" data-kb-view="'+f.id+'">Visualizar</button>':'')+'<button class="btn btn-danger btn-sm" data-kb-del="'+f.id+'">Excluir</button></div>';}).join("")||'<div class="empty-state">Nenhum arquivo cadastrado.</div>';list.querySelectorAll("[data-kb-view]").forEach(function(b){b.onclick=async function(){var item=db.aiKnowledge.find(function(x){return x.id===b.dataset.kbView;});if(!item||!item.storagePath)return;var signed=await supabaseClient.storage.from("ai-knowledge").createSignedUrl(item.storagePath,120);if(signed.error){toast(signed.error.message,"error");return;}window.open(signed.data.signedUrl,"_blank","noopener");};});list.querySelectorAll("[data-kb-del]").forEach(function(b){b.onclick=async function(){var item=db.aiKnowledge.find(function(x){return x.id===b.dataset.kbDel;});if(item&&item.storagePath&&db.supabaseConnected){var removed=await supabaseClient.storage.from("ai-knowledge").remove([item.storagePath]);if(removed.error){toast(removed.error.message,"error");return;}}db.aiKnowledge=db.aiKnowledge.filter(function(x){return x.id!==b.dataset.kbDel;});addLog("Arquivo removido da base de IA");saveDB(db);drawConfig();};});}
    document.getElementById("ai-save-instructions").onclick=function(){db.aiInstructions=document.getElementById("ai-instructions").value.trim();addLog("Instruções do Assistente operacional atualizadas");saveDB(db);toast("Instruções salvas.","success");};document.getElementById("ai-kb-add").onclick=async function(){var f=document.getElementById("ai-kb-file").files[0];if(!f){toast("Selecione um arquivo.","error");return;}if(f.size>20971520){toast("O arquivo deve ter no máximo 20 MB.","error");return;}var item={id:"kb-"+Date.now(),name:f.name,type:f.type||f.name.split(".").pop(),size:f.size,at:Date.now(),by:user.nome,status:"Cadastrado"};if(db.supabaseConnected){var safe=f.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"-");item.storagePath=Date.now()+"-"+safe;var upload=await supabaseClient.storage.from("ai-knowledge").upload(item.storagePath,f,{upsert:false,contentType:f.type||undefined});if(upload.error){toast(upload.error.message,"error");return;}item.status="Armazenado com segurança";}if(/text|json/.test(f.type)||/\.(txt|md)$/i.test(f.name))item.text=await f.text();db.aiKnowledge.push(item);addLog("Arquivo adicionado à base de IA: "+f.name);saveDB(db);drawConfig();toast("Arquivo adicionado à base de conhecimento.","success");};document.getElementById("ai-propose").onclick=function(){var d=document.getElementById("ai-admin-draft").value.trim();if(!d)return;document.getElementById("ai-proposal").textContent=d;document.getElementById("ai-proposal").style.display="block";document.getElementById("ai-confirm-rule").style.display="inline-flex";};document.getElementById("ai-confirm-rule").onclick=function(){var d=document.getElementById("ai-proposal").textContent;if(d){db.aiInstructions+=(db.aiInstructions?"\n":"")+d;saveDB(db);toast("Instrução adicionada à base.","success");drawConfig();}};drawMessages();
  }

  /* ---------- alertas operacionais ---------- */
  function renderClientAlerts(){
    var user=currentUser(),root=document.getElementById('view-root'),alerts=(db.trackingAlerts||[]).filter(function(a){return a.transporter_id===user.transporterId&&a.status==='WAITING_CLIENT';});
    root.innerHTML='<div class="page-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+icon('alert')+'</svg><h1>Alertas</h1><button class="back-btn" id="client-alert-back">← Voltar</button></div><main><section class="panel" style="max-width:100%"><div class="ops-head"><div><h2>Solicitações de retorno</h2><p class="hint-text">Após responder, o alerta volta para a equipe operacional responsável.</p></div></div><div style="overflow:auto"><table class="users-table"><thead><tr><th>Data/hora</th><th>Placa</th><th>Tipo</th><th>Severidade</th><th>Situação</th><th>Ação</th></tr></thead><tbody id="client-alert-rows"></tbody></table></div></section></main>';
    document.getElementById('client-alert-back').onclick=function(){navigate('menu');};
    document.getElementById('client-alert-rows').innerHTML=alerts.map(function(a){return '<tr><td>'+escapeHtml(new Date(a.occurred_at).toLocaleString('pt-BR'))+'</td><td><b>'+escapeHtml(a.plate||'—')+'</b></td><td>'+escapeHtml(a.alert_type||'—')+'</td><td><span class="status-pill '+String(a.severity||'').toLowerCase()+'">'+escapeHtml(a.severity||'—')+'</span></td><td>'+escapeHtml(a.occurrence_summary||a.description||'Retorno solicitado')+'</td><td><button class="btn btn-primary btn-sm" data-client-reply="'+a.id+'">Responder</button></td></tr>';}).join('')||'<tr><td colspan="6" class="empty-state">Nenhum alerta aguardando resposta.</td></tr>';
    root.querySelectorAll('[data-client-reply]').forEach(function(button){button.onclick=function(){var alert=alerts.find(function(a){return a.id===button.dataset.clientReply;});if(!alert)return;document.body.insertAdjacentHTML('beforeend','<div class="modal-overlay show" id="client-response-modal"><div class="modal-card"><div class="modal-head"><div><small>RETORNO DA TRANSPORTADORA</small><h2>'+escapeHtml(alert.plate||'Alerta')+'</h2></div><button id="client-response-close">×</button></div><div class="record-detail-grid"><div><span>Tipo</span><b>'+escapeHtml(alert.alert_type||'—')+'</b></div><div><span>Data e hora</span><b>'+escapeHtml(new Date(alert.occurred_at).toLocaleString('pt-BR'))+'</b></div><div><span>Motorista</span><b>'+escapeHtml(alert.driver_name||'Não informado')+'</b></div><div><span>Localização</span><b>'+escapeHtml(alert.location_text||'Não informada')+'</b></div><div class="span-all"><span>Situação do veículo</span><b>'+escapeHtml(alert.occurrence_summary||alert.description||'Retorno solicitado pela operação.')+'</b></div></div><form id="client-response-form"><div class="fgroup"><label>Resposta / tratativa *</label><textarea id="client-response-text" minlength="3" rows="5" required placeholder="Informe o contato realizado e a situação atual"></textarea></div><div class="actions-row"><button type="button" class="btn btn-secondary" id="client-response-cancel">Cancelar</button><button class="btn btn-primary">Enviar resposta</button></div></form></div></div>');var modal=document.getElementById('client-response-modal'),close=function(){modal.remove();};document.getElementById('client-response-close').onclick=close;document.getElementById('client-response-cancel').onclick=close;document.getElementById('client-response-form').onsubmit=async function(e){e.preventDefault();var submit=e.currentTarget.querySelector('[type=submit]');submit.disabled=true;var result=await supabaseClient.rpc('respond_tracking_alert',{requested_alert:alert.id,response_text:document.getElementById('client-response-text').value.trim()});if(result.error){submit.disabled=false;toast(result.error.message,'error');return;}close();await loadCloudData();toast('Resposta enviada à equipe responsável.','success');renderClientAlerts();};};});
  }

  function renderCentralOcorrencias(){
    if(CSRRules.role(currentUser())==='Cliente'){renderClientAlerts();return;}
    var tab="all",user=currentUser();
    var trackingPanel=document.createElement("section");trackingPanel.className="panel";trackingPanel.style.marginBottom="16px";var main=document.querySelector("#view-root main");if(main)main.insertBefore(trackingPanel,main.firstChild);
    function occurrenceLabel(value){return ({PENDING:"Aguardando verificação",INCORRECT:"Tratativa incorreta",CORRECT:"Tratativa correta"})[value]||"Aguardando verificação";}
    function contactLabel(value){return ({SUCCESS:"Sucesso",NO_SUCCESS:"Sem sucesso"})[value]||"Não informado";}
    function drawTrackingAlerts(){
      var rows=(db.trackingAlerts||[]).filter(function(a){return a.status!=="ARCHIVED";});
      trackingPanel.innerHTML='<div class="ops-head"><div><span class="eyebrow">INTEGRADOR DE RASTREAMENTO</span><h2>Alertas recebidos pela API</h2><p class="hint-text">Eventos normalizados e controlados pelo workflow do backend.</p></div><span class="badge">'+rows.length+' ativo(s)</span></div><div style="overflow:auto"><table class="users-table"><thead><tr><th>Data/hora</th><th>Placa</th><th>Tipo</th><th>Ocorrência</th><th>Contato</th><th>Status</th><th>Prazo</th><th>Ação</th></tr></thead><tbody>'+rows.map(function(a){var canRequest=!!a.transporter_id&&["PENDING_TREATMENT","IN_TREATMENT","CLIENT_RESPONDED"].indexOf(a.status)!==-1,canTake=["PENDING_TREATMENT","CLIENT_RESPONDED"].indexOf(a.status)!==-1,canTreat=["IN_TREATMENT","CLIENT_RESPONDED"].indexOf(a.status)!==-1,canRegister=["Operador","Lider","Supervisor","Coordenador","Gerente","Administrador"].indexOf(CSRRules.role(user))!==-1&&["TREATED","ARCHIVED","DISCARDED"].indexOf(a.status)===-1;return '<tr><td>'+escapeHtml(new Date(a.occurred_at).toLocaleString("pt-BR"))+'</td><td><b>'+escapeHtml(a.plate||"—")+'</b><br><small>'+escapeHtml(a.alert_type)+'</small></td><td><span class="status-pill '+String(a.severity).toLowerCase()+'">'+escapeHtml(a.severity)+'</span></td><td><b>'+escapeHtml(occurrenceLabel(a.occurrence_check_status))+'</b></td><td>'+escapeHtml(contactLabel(a.contact_result))+'</td><td>'+escapeHtml(a.status.replaceAll("_"," "))+'</td><td>'+escapeHtml(new Date(a.deadline_at).toLocaleString("pt-BR"))+'</td><td><div class="row-actions"><button data-tracking-view="'+a.id+'">Detalhes</button>'+(canRegister?'<button data-tracking-occurrence="'+a.id+'">Registrar ocorrência</button>':'')+(canTake?'<button data-tracking-take="'+a.id+'">Assumir</button>':'')+(canRequest?'<button data-tracking-client="'+a.id+'">Solicitar retorno</button>':'')+(canTreat?'<button data-tracking-treat="'+a.id+'">Concluir</button>':'')+'</div></td></tr>';}).join("")+'</tbody></table></div>';
      trackingPanel.querySelectorAll("[data-tracking-view]").forEach(function(button){button.onclick=function(){var a=rows.find(function(x){return x.id===button.dataset.trackingView;});if(!a)return;document.body.insertAdjacentHTML("beforeend",'<div class="modal-overlay show" id="tracking-detail"><div class="modal-card"><div class="modal-head"><div><small>ALERTA DO INTEGRADOR</small><h2>'+escapeHtml(a.plate||"Alerta")+'</h2></div><button data-track-close>×</button></div><div class="record-detail-grid"><div><span>Tipo</span><b>'+escapeHtml(a.alert_type)+'</b></div><div><span>Status</span><b>'+escapeHtml(a.status.replaceAll("_"," "))+'</b></div><div><span>Verificação</span><b>'+escapeHtml(occurrenceLabel(a.occurrence_check_status))+'</b></div><div><span>Contato</span><b>'+escapeHtml(contactLabel(a.contact_result))+'</b></div><div><span>Motorista</span><b>'+escapeHtml(a.driver_name||"Não informado")+'</b></div><div><span>Origem</span><b>'+escapeHtml(a.provider)+'</b></div><div class="span-all"><span>Descrição do integrador</span><p>'+escapeHtml(a.description||"Sem descrição")+'</p></div><div class="span-all"><span>Ocorrência verificada</span><p>'+escapeHtml(a.occurrence_summary||"Ainda não registrada")+'</p></div>'+(a.client_response?'<div class="span-all"><span>Retorno da transportadora</span><p>'+escapeHtml(a.client_response)+'</p></div>':'')+'</div></div></div>');document.querySelector("[data-track-close]").onclick=function(){document.getElementById("tracking-detail").remove();};};});
      trackingPanel.querySelectorAll("[data-tracking-occurrence]").forEach(function(button){button.onclick=function(){var a=rows.find(function(x){return x.id===button.dataset.trackingOccurrence;});if(!a)return;document.body.insertAdjacentHTML("beforeend",'<div class="modal-overlay show" id="tracking-occurrence-modal"><div class="modal-card"><div class="modal-head"><div><small>VERIFICAÇÃO DA OCORRÊNCIA</small><h2>'+escapeHtml(a.plate||"Alerta")+'</h2></div><button data-track-occurrence-close>×</button></div><form id="tracking-occurrence-form"><div class="form-grid two"><div class="fgroup"><label>Resultado da verificação *</label><select id="tracking-occurrence-result" required><option value="">Selecione</option><option value="incorrect">Tratativa incorreta</option><option value="correct">Tratativa correta</option></select></div><div class="fgroup"><label>Contato *</label><select id="tracking-occurrence-contact" required><option value="">Selecione</option><option value="SUCCESS">Sucesso</option><option value="NO_SUCCESS">Sem sucesso</option></select></div></div><div class="fgroup"><label>Descrição da ocorrência *</label><textarea id="tracking-occurrence-text" required minlength="3" rows="5" placeholder="Informe o que foi verificado e a situação atual do veículo"></textarea></div><p class="hint-text">Tratativa correta com contato sem sucesso será enviada automaticamente à transportadora após 1 minuto.</p><div class="actions-row"><button type="button" class="btn btn-secondary" data-track-occurrence-close>Cancelar</button><button class="btn btn-primary">Registrar resultado</button></div></form></div></div>');function close(){document.getElementById("tracking-occurrence-modal").remove();}document.querySelectorAll("[data-track-occurrence-close]").forEach(function(x){x.onclick=close;});document.getElementById("tracking-occurrence-form").onsubmit=async function(e){e.preventDefault();var submit=e.currentTarget.querySelector('[type="submit"]');submit.disabled=true;var result=await supabaseClient.rpc("register_tracking_occurrence_result",{requested_alert:a.id,result_is_correct:document.getElementById("tracking-occurrence-result").value==="correct",contact_value:document.getElementById("tracking-occurrence-contact").value,occurrence_text:document.getElementById("tracking-occurrence-text").value.trim()});if(result.error){submit.disabled=false;toast(result.error.message,"error");return;}close();await loadCloudData();drawTrackingAlerts();toast("Ocorrência registrada.","success");};};});
      trackingPanel.querySelectorAll("[data-tracking-client]").forEach(function(button){button.onclick=function(){var a=rows.find(function(x){return x.id===button.dataset.trackingClient;});if(!a)return;document.body.insertAdjacentHTML("beforeend",'<div class="modal-overlay show" id="tracking-client-modal"><div class="modal-card"><div class="modal-head"><div><small>SOLICITAR RETORNO</small><h2>'+escapeHtml(a.plate||"Alerta")+'</h2></div><button data-track-client-close>×</button></div><form id="tracking-client-form"><div class="fgroup"><label>Situação do veículo *</label><textarea id="tracking-client-summary" required minlength="3" rows="5" placeholder="Descreva a ocorrência e o retorno necessário da transportadora"></textarea></div><div class="actions-row"><button type="button" class="btn btn-secondary" data-track-client-close>Cancelar</button><button class="btn btn-primary">Enviar ao cliente</button></div></form></div></div>');function close(){document.getElementById("tracking-client-modal").remove();}document.querySelectorAll("[data-track-client-close]").forEach(function(x){x.onclick=close;});document.getElementById("tracking-client-form").onsubmit=async function(e){e.preventDefault();var result=await supabaseClient.rpc("request_client_tracking_response",{requested_alert:a.id,situation_summary:document.getElementById("tracking-client-summary").value.trim()});if(result.error){toast(result.error.message,"error");return;}close();await loadCloudData();drawTrackingAlerts();toast("Solicitação enviada à transportadora.","success");};};});
      trackingPanel.querySelectorAll("[data-tracking-take]").forEach(function(button){button.onclick=async function(){var result=await supabaseClient.rpc("take_tracking_alert",{requested_alert:button.dataset.trackingTake});if(result.error){toast(result.error.message,"error");return;}await loadCloudData();drawTrackingAlerts();toast("Tratamento assumido.","success");};});
      trackingPanel.querySelectorAll("[data-tracking-treat]").forEach(function(button){button.onclick=function(){var a=rows.find(function(x){return x.id===button.dataset.trackingTreat;});if(!a)return;document.body.insertAdjacentHTML("beforeend",'<div class="modal-overlay show" id="tracking-treat-modal"><div class="modal-card"><div class="modal-head"><div><small>CONCLUIR TRATAMENTO</small><h2>'+escapeHtml(a.plate||"Alerta")+'</h2></div><button data-track-treat-close>×</button></div><form id="tracking-treat-form"><div class="fgroup"><label>Descrição do tratamento *</label><textarea id="tracking-treatment-text" required minlength="3" rows="5"></textarea></div><div class="actions-row"><button type="button" class="btn btn-secondary" data-track-treat-close>Cancelar</button><button class="btn btn-primary">Concluir tratamento</button></div></form></div></div>');function close(){document.getElementById("tracking-treat-modal").remove();}document.querySelectorAll("[data-track-treat-close]").forEach(function(x){x.onclick=close;});document.getElementById("tracking-treat-form").onsubmit=async function(e){e.preventDefault();var result=await supabaseClient.rpc("treat_tracking_alert",{requested_alert:a.id,treatment_text:document.getElementById("tracking-treatment-text").value.trim()});if(result.error){toast(result.error.message,"error");return;}close();await loadCloudData();drawTrackingAlerts();toast("Alerta tratado. Ele permanecerá visível por 10 minutos.","success");};};});
    }
    drawTrackingAlerts();
    document.getElementById("occ-kind").parentElement.insertAdjacentHTML("afterend",'<div class="fgroup"><label>Contato *</label><select id="occ-contact" required><option value="">Selecione</option><option>Sucesso</option><option>Sem sucesso</option></select></div>');
    var oldBase=document.getElementById("occ-base"),baseSelect=document.createElement("select");baseSelect.id="occ-base";baseSelect.required=true;baseSelect.innerHTML=settingOptions("clientes","Selecione a base");oldBase.parentNode.replaceChild(baseSelect,oldBase);var kind=document.getElementById("occ-kind");kind.innerHTML=settingOptions("alertas","Selecione o alerta");var kindLabel=kind.parentNode.querySelector("label");if(kindLabel)kindLabel.textContent="Alerta";
    function showForm(o){document.getElementById("occ-list-panel").style.display="none";document.getElementById("occ-form-panel").style.display="block";document.getElementById("occ-form-title").textContent=o?"Editar alerta":"Novo alerta";document.getElementById("occ-id").value=o?o.id:"";var now=new Date();[["occ-base",o?o.base:(user.unidade||"")],["occ-placa",o?o.placa:""],["occ-sm",o?o.sm:""],["occ-condutor",o?o.condutor:""],["occ-date",o?o.date:now.toISOString().slice(0,10)],["occ-time",o?o.time:now.toTimeString().slice(0,5)],["occ-description",o?o.description:""],["occ-treatment",o?o.treatment:""]].forEach(function(x){document.getElementById(x[0]).value=x[1]||"";});document.getElementById("occ-kind").value=o?o.kind:"";document.getElementById("occ-contact").value=o?o.contact||"":"";}
    function closeForm(){document.getElementById("occ-list-panel").style.display="block";document.getElementById("occ-form-panel").style.display="none";draw();}
    function draw(){db.operationalOccurrences.forEach(function(o){o.status=o.status||'Pendente';o.history=Array.isArray(o.history)?o.history:[];o.createdAt=Number(o.createdAt)||Date.now();o.date=o.date||todayISO();o.time=o.time||'';});var canFinish=["Administrador","Gerente","Coordenador","Supervisor","Lider","Líder"].indexOf(user.funcao||user.cargo)!==-1;var q=document.getElementById("occ-search").value.toLowerCase(),base=document.getElementById("occ-base-filter").value,status=document.getElementById("occ-status-filter").value,date=document.getElementById("occ-date-filter").value,rows=db.operationalOccurrences.filter(function(o){if(tab==="current"&&String(o.status).trim().toLowerCase()!=="pendente")return false;if(tab==="treated"&&["tratado","encerrado","finalizado"].indexOf(String(o.status).trim().toLowerCase())===-1)return false;if(base&&o.base!==base)return false;if(status&&o.status!==status)return false;if(date&&o.date!==date)return false;return !q||[o.placa,o.sm,o.condutor,o.createdBy,o.description].join(" ").toLowerCase().indexOf(q)!==-1;}).sort(function(a,b){return b.createdAt-a.createdAt;});document.getElementById("occ-tbody").innerHTML=rows.map(function(o){return '<tr><td>'+fmtDateBR(o.date)+' '+escapeHtml(o.time)+'</td><td>'+escapeHtml(o.base)+'</td><td><b>'+escapeHtml(o.placa)+'</b><br><small>'+escapeHtml(o.sm||"—")+'</small></td><td>'+escapeHtml(o.condutor||"—")+'</td><td>'+alertDot(o)+escapeHtml(o.kind)+'<br><small>'+escapeHtml(o.contact||'Contato não informado')+'</small>'+'</td><td>'+escapeHtml(o.createdBy)+'</td><td><span class="status-pill '+String(o.status||'Pendente').toLowerCase()+'">'+escapeHtml(o.status||'Pendente')+'</span></td><td><div class="row-actions"><button data-occ-edit="'+o.id+'">Editar</button>'+(o.status==="Pendente"&&canFinish?'<button data-occ-finish="'+o.id+'">Finalizar</button>':'')+'</div></td></tr>';}).join("")||'<tr><td colspan="8" class="empty-state">Nenhum alerta encontrado</td></tr>';document.querySelectorAll("[data-occ-edit]").forEach(function(b){b.onclick=function(){showForm(db.operationalOccurrences.find(function(o){return o.id===b.dataset.occEdit;}));};});document.querySelectorAll("[data-occ-finish]").forEach(function(b){b.onclick=function(){var o=db.operationalOccurrences.find(function(x){return x.id===b.dataset.occFinish;});CSRFlows.finish(o,draw);};});CSRFlows.alertHistory(document.getElementById("occ-tbody"),rows);}
    var bases=db.users.map(function(u){return u.unidade;}).concat(db.operationalOccurrences.map(function(o){return o.base;})).filter(function(v,i,a){return v&&a.indexOf(v)===i;});document.getElementById("occ-base-filter").innerHTML='<option value="">Todas as bases</option>'+bases.map(function(b){return '<option>'+escapeHtml(b)+'</option>';}).join("");document.querySelectorAll("#occ-list-panel input,#occ-list-panel select").forEach(function(e){e.oninput=draw;e.onchange=draw;});document.getElementById("occ-new").onclick=function(){showForm(null);};document.getElementById("occ-back").onclick=function(){if(document.getElementById("occ-form-panel").style.display==="block")closeForm();else navigate("menu");};document.getElementById("occ-form-close").onclick=closeForm;document.getElementById("occ-form").onsubmit=function(e){e.preventDefault();var id=document.getElementById("occ-id").value,o=id?db.operationalOccurrences.find(function(x){return x.id===id;}):{id:"occ-"+Date.now(),createdAt:Date.now(),createdBy:user.nome,createdById:user.id,status:"Pendente",history:[]},before=o.status;["base","placa","sm","condutor","date","time","description","treatment","kind","contact"].forEach(function(k){o[k]=document.getElementById("occ-"+k).value.trim();});if(!id)db.operationalOccurrences.push(o);o.updatedAt=Date.now();o.history.push({at:Date.now(),by:user.nome,from:before||"—",to:o.status,note:id?"Registro editado":"Registro criado"});addLog((id?"Alerta editado: ":"Alerta criado: ")+o.placa);saveDB(db);toast("Alerta salvo.","success");closeForm();draw();};window.csrAlertsDraw=draw;try{draw();}catch(error){console.error("Falha ao renderizar alertas",error);document.getElementById("occ-tbody").innerHTML='<tr><td colspan="8" class="empty-state">Não foi possível carregar os registros. Atualize a página.</td></tr>';}
  }

  function renderMecanicos(){var user=currentUser(),selected=null;function draw(){var rows=db.operationalOccurrences.filter(function(o){return o.kind==="Problema mecânico";});document.getElementById("mech-tbody").innerHTML=rows.map(function(o){return '<tr><td>'+fmtDateBR(o.date)+' '+escapeHtml(o.time)+'</td><td>'+escapeHtml(o.base)+'</td><td><b>'+escapeHtml(o.placa)+'</b><br>'+escapeHtml(o.sm||"—")+'</td><td>'+escapeHtml(o.description)+'</td><td><span class="status-pill '+o.status.toLowerCase()+'">'+o.status+'</span></td><td><button class="btn btn-secondary btn-sm" data-mech-mail="'+o.id+'">Prévia / enviar</button></td></tr>';}).join("")||'<tr><td colspan="6" class="empty-state">Nenhum problema mecânico registrado</td></tr>';document.querySelectorAll("[data-mech-mail]").forEach(function(b){b.onclick=function(){selected=db.operationalOccurrences.find(function(o){return o.id===b.dataset.mechMail;});openMail();};});}function openMail(){document.getElementById("mech-recipients").innerHTML=db.users.map(function(u){return '<option value="'+escapeHtml(u.email)+'">'+escapeHtml(u.nome)+' — '+escapeHtml(u.cargo)+'</option>';}).join("");document.getElementById("mech-email-preview").textContent='Assunto: Problema Mecânico — Placa '+selected.placa+' — SM '+(selected.sm||"não informada")+'\n\nBase: '+selected.base+'\nPlaca: '+selected.placa+'\nSM: '+(selected.sm||"—")+'\nCondutor: '+(selected.condutor||"—")+'\nData/Hora: '+fmtDateBR(selected.date)+' '+selected.time+'\nDescrição: '+selected.description+'\nTratativa: '+(selected.treatment||"Não registrada")+'\nResponsável: '+selected.createdBy+'\nStatus: '+selected.status;document.getElementById("mech-email-modal").classList.add("show");}document.getElementById("mech-new").onclick=function(){navigate("central-ocorrencias");setTimeout(function(){document.getElementById("occ-new").click();document.getElementById("occ-kind").value="Problema mecânico";},0);};document.getElementById("mech-email-close").onclick=function(){document.getElementById("mech-email-modal").classList.remove("show");};document.getElementById("mech-email-send").onclick=function(){var rec=Array.from(document.getElementById("mech-recipients").selectedOptions).map(function(o){return o.value;}),manual=document.getElementById("mech-manual-email").value.split(/[;,]/).map(function(x){return x.trim();}).filter(Boolean);rec=rec.concat(manual);if(!rec.length){toast("Informe ao menos um destinatário.","error");return;}db.emailHistory.push({id:"mail-"+Date.now(),occurrenceId:selected.id,by:user.nome,at:Date.now(),recipients:rec,subject:"Problema Mecânico — Placa "+selected.placa+" — SM "+(selected.sm||"não informada"),status:"Registrado localmente — envio externo não configurado"});addLog("Envio de e-mail mecânico registrado: "+selected.placa);saveDB(db);toast("Envio registrado. Serviço de e-mail externo ainda precisa ser configurado.","success");document.getElementById("mech-email-modal").classList.remove("show");};draw();}

  /* ---------- passagem de plantão ---------- */
  function renderPassagem(){var user=currentUser(),items=[];function userOpts(){return db.users.filter(function(u){return u.id!==user.id;}).map(function(u){return '<option value="'+u.id+'">'+escapeHtml(u.nome)+' — '+escapeHtml(u.matricula||"")+' — '+escapeHtml(u.cargo)+'</option>';}).join("");}document.getElementById("shift-to").innerHTML='<option value="">Selecione</option>'+userOpts();document.getElementById("shift-cc").innerHTML=userOpts();document.getElementById("shift-date").value=new Date().toISOString().slice(0,10);document.getElementById("shift-base").value=user.unidade||"";function drawItems(){document.getElementById("shift-items").innerHTML=items.map(function(o,i){return '<div class="kb-item"><div><b>'+(i+1)+' — '+escapeHtml(o.placa||"Sem placa")+'</b><br><small>SM '+escapeHtml(o.sm||"—")+' · '+escapeHtml(o.condutor||"—")+'</small><p style="margin:5px 0">'+escapeHtml(o.description||"")+'</p></div><button class="btn btn-danger btn-sm" data-shift-del="'+i+'">Remover</button></div>';}).join("")||'<div class="empty-state">Nenhum alerta adicionado.</div>';document.querySelectorAll("[data-shift-del]").forEach(function(b){b.onclick=function(){items.splice(Number(b.dataset.shiftDel),1);drawItems();};});}function text(){var base=document.getElementById("shift-base").value,date=document.getElementById("shift-date").value,s='PASSAGEM DE PLANTÃO\n\nBase: '+base+'\nData: '+fmtDateBR(date)+'\n\nOCORRÊNCIAS PENDENTES\n';if(!items.length)s+='Nenhum alerta incluído.';items.forEach(function(o,i){s+='\n\n'+(i+1)+' — Placa '+(o.placa||"—")+'\nSM: '+(o.sm||"—")+'\nCondutor: '+(o.condutor||"—")+'\nData/hora: '+fmtDateBR(o.date)+' '+(o.time||"")+'\n\nAlerta:\n'+(o.description||"—")+'\n\nTratativa:\n'+(o.treatment||"Não registrada")+'\n\nStatus: '+(o.status||"Pendente");});return s;}function drawLists(){var mine=db.shiftPassages.filter(function(p){return p.toId===user.id||p.ccIds.indexOf(user.id)!==-1;}).reverse();document.getElementById("shift-received-list").innerHTML=mine.map(card).join("")||'<div class="empty-state">Nenhuma passagem recebida.</div>';drawHistory();}function card(p){return '<div class="kb-item"><div><b>'+escapeHtml(p.base)+' — '+new Date(p.sentAt).toLocaleString("pt-BR")+'</b><br><small>De '+escapeHtml(p.fromName)+' · '+p.items.length+' alerta(s) · '+escapeHtml(p.status)+'</small></div><button class="btn btn-secondary btn-sm" data-shift-open="'+p.id+'">Abrir</button></div>';}function drawHistory(){var q=(document.getElementById("shift-search").value||"").toLowerCase(),rows=db.shiftPassages.filter(function(p){return !q||[p.base,p.fromName,p.toName].join(" ").toLowerCase().indexOf(q)!==-1;}).reverse();document.getElementById("shift-history-list").innerHTML=rows.map(card).join("")||'<div class="empty-state">Nenhuma passagem no histórico.</div>';document.querySelectorAll("[data-shift-open]").forEach(function(b){b.onclick=function(){var p=db.shiftPassages.find(function(x){return x.id===b.dataset.shiftOpen;});alert(p.content);if(p.toId===user.id&&p.status!=="Lido"){p.status="Lido";p.readAt=Date.now();saveDB(db);drawLists();}};});}document.querySelectorAll("[data-shift-tab]").forEach(function(b){b.onclick=function(){document.querySelectorAll("[data-shift-tab]").forEach(function(x){x.classList.toggle("active",x===b);});["create","received","history"].forEach(function(t){document.getElementById("shift-"+t).style.display=t===b.dataset.shiftTab?"block":"none";});drawLists();};});document.getElementById("shift-pull").onclick=function(){var base=document.getElementById("shift-base").value.trim(),date=document.getElementById("shift-date").value;if(!base||!date){toast("Informe Base e Data.","error");return;}var found=db.operationalOccurrences.filter(function(o){return o.base.toLowerCase()===base.toLowerCase()&&o.date===date&&o.status==="Pendente";});items=found.slice();toast(found.length+" alerta(s) pendente(s) encontrada(s).","success");drawItems();};document.getElementById("shift-add-manual").onclick=function(){var placa=prompt("Placa:");if(placa===null)return;var desc=prompt("Descrição do alerta:");if(!desc)return;items.push({id:"manual-"+Date.now(),placa:placa,sm:prompt("SM:")||"",condutor:prompt("Condutor:")||"",date:document.getElementById("shift-date").value,time:prompt("Hora (HH:MM):")||"",description:desc,treatment:prompt("Tratativa realizada:")||"",status:"Pendente",manual:true});drawItems();};document.getElementById("shift-preview-btn").onclick=function(){var p=document.getElementById("shift-preview");p.textContent=text();p.style.display="block";};document.getElementById("shift-send").onclick=function(){var to=document.getElementById("shift-to").value,base=document.getElementById("shift-base").value.trim(),date=document.getElementById("shift-date").value;if(!to||!base||!date){toast("Preencha Base, Data e Destinatário.","error");return;}var dest=db.users.find(function(u){return u.id===to;}),cc=Array.from(document.getElementById("shift-cc").selectedOptions).map(function(o){return o.value;});var p={id:"shift-"+Date.now(),fromId:user.id,fromName:user.nome,toId:to,toName:dest.nome,ccIds:cc,base:base,date:date,items:JSON.parse(JSON.stringify(items)),content:text(),sentAt:Date.now(),status:"Enviado"};db.shiftPassages.push(p);addLog("Passagem de plantão enviada para "+dest.nome);addNotification(to,"sistema","Nova passagem de plantão",user.nome+" enviou uma passagem da base "+base+".");saveDB(db);items=[];drawItems();toast("Passagem enviada internamente.","success");refreshNotifBadge();};document.getElementById("shift-search").oninput=drawHistory;drawItems();drawLists();}

  /* ---------- férias ---------- */
  var MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  function renderFerias(){
    var searchEl = document.getElementById("fr-search");
    var gestorEl = document.getElementById("fr-gestor-filter");

    function showList(){
      document.getElementById("fr-list-view").style.display = "block";
      document.getElementById("fr-form-view").style.display = "none";
    }
    function showForm(){
      document.getElementById("fr-list-view").style.display = "none";
      document.getElementById("fr-form-view").style.display = "block";
    }

    var gestoresUsados = db.users.slice().sort(function(a,b){ return a.nome.localeCompare(b.nome); });
    gestorEl.innerHTML = '<option value="">Todos os gestores</option>' + gestoresUsados.map(function(g){ return '<option value="'+g.id+'">'+g.nome+'</option>'; }).join("");

    function nomeUsuario(id){ var u = db.users.find(function(x){ return x.id === id; }); return u ? u.nome : "—"; }

    function draw(){
      var tbody = document.getElementById("fr-tbody");
      var q = (searchEl.value || "").trim().toLowerCase();
      var gestorFilter = gestorEl.value;
      var rows = db.ferias.slice().reverse().filter(function(f){
        if(gestorFilter && f.gestorId !== gestorFilter) return false;
        if(!q) return true;
        var hay = [nomeUsuario(f.operadorId), f.matricula].join(" ").toLowerCase();
        return hay.indexOf(q) !== -1;
      });
      if(!rows.length){
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhuma programação cadastrada</td></tr>';
        return;
      }
      tbody.innerHTML = "";
      rows.forEach(function(f){
        var operador = db.users.find(function(u){ return u.id === f.operadorId; });
        var tr = document.createElement("tr");
        tr.innerHTML =
          '<td>'+(operador ? operador.nome : "—")+'</td>'+
          '<td>'+(f.matricula||"—")+'</td>'+
          '<td>'+nomeUsuario(f.gestorId)+'</td>'+
          '<td>'+fmtDateBR(operador ? operador.dataContratacao : "")+'</td>'+
          '<td><span class="badge">'+(f.mesFerias||"—")+'</span></td>'+
          '<td><span class="badge">'+(f.status||"Pendente")+'</span></td>'+
          '<td><div class="row-actions"><button data-edit="'+f.id+'">Editar</button><button data-del="'+f.id+'" class="del">Excluir</button></div></td>';
        tbody.appendChild(tr);
      });
      tbody.querySelectorAll("[data-edit]").forEach(function(b){
        b.addEventListener("click", function(){ openFRForm(b.getAttribute("data-edit")); showForm(); });
      });
      tbody.querySelectorAll("[data-del]").forEach(function(b){
        b.addEventListener("click", function(){
          var id = b.getAttribute("data-del");
          var f = db.ferias.find(function(x){ return x.id === id; });
          if(confirm('Excluir esta programação de férias?')){
            db.ferias = db.ferias.filter(function(x){ return x.id !== id; });
            saveDB(db);
            addLog("Programação de férias excluída");
            toast("Registro excluído.", "success");
            draw();
          }
        });
      });
    }

    draw();
    showList();
    searchEl.addEventListener("input", draw);
    gestorEl.addEventListener("change", draw);
    document.getElementById("fr-novo-btn").addEventListener("click", function(){ openFRForm(null); showForm(); });
    document.getElementById("fr-form-cancel").addEventListener("click", function(){ showList(); });

    document.getElementById("fm-operador").addEventListener("change", updateFRAquisitivo);
    document.getElementById("fm-data-inicio").addEventListener("change", updateFRDuracaoESumario);
    document.getElementById("fm-data-termino").addEventListener("change", updateFRDuracaoESumario);
    document.getElementById("fm-gestor").addEventListener("change", updateFRSummary);
    document.getElementById("fm-mes-ferias").addEventListener("change", updateFRSummary);
    document.getElementById("fm-obs").addEventListener("input", function(){
      document.getElementById("fm-obs-counter").textContent = this.value.length + "/255 caracteres";
    });

    document.getElementById("fr-form").addEventListener("submit", function(e){
      e.preventDefault();
      var operadorId = document.getElementById("fm-operador").value;
      var gestorId = document.getElementById("fm-gestor").value;
      var mesFerias = document.getElementById("fm-mes-ferias").value;
      var dataInicio = document.getElementById("fm-data-inicio").value;
      var dataTermino = document.getElementById("fm-data-termino").value;
      if(!operadorId){ toast("Selecione o operador.", "error"); return; }
      if(!gestorId){ toast("Selecione o gestor responsável.", "error"); return; }
      if(!mesFerias || !dataInicio || !dataTermino){ toast("Preencha o período de férias completo.", "error"); return; }
      if(new Date(dataTermino) < new Date(dataInicio)){ toast("A data de término não pode ser antes da data de início.", "error"); return; }

      var id = document.getElementById("fm-id").value;
      var operador = db.users.find(function(u){ return u.id === operadorId; });
      var payload = {
        operadorId: operadorId,
        matricula: operador ? (operador.matricula||"") : "",
        gestorId: gestorId,
        mesFerias: mesFerias,
        dataInicio: dataInicio,
        dataTermino: dataTermino,
        obs: document.getElementById("fm-obs").value.trim(),
        status: "Pendente"
      };
      if(id){
        var f = db.ferias.find(function(x){ return x.id === id; });
        Object.assign(f, payload);
        addLog("Programação de férias editada: " + (operador?operador.nome:""));
        toast("Programação atualizada.", "success");
      } else {
        payload.id = "fr-" + Date.now();
        db.ferias.push(payload);
        addLog("Programação de férias criada: " + (operador?operador.nome:""));
        addNotification(gestorId, "ferias", "Nova programação de férias", (operador?operador.nome:"Operador") + " programou férias em " + mesFerias + ".", "ferias", payload.id);
        toast("Programação salva.", "success");
      }
      saveDB(db);
      showList();
      draw();
      refreshNotifBadge();
    });

    window._refreshFRTable = draw;
  }

  function updateFRAquisitivo(){
    var operadorId = document.getElementById("fm-operador").value;
    var operador = db.users.find(function(u){ return u.id === operadorId; });
    document.getElementById("fm-matricula").value = operador ? (operador.matricula||"") : "";
    document.getElementById("fm-data-contratacao").value = operador ? fmtDateBR(operador.dataContratacao) : "";
    var card = document.getElementById("fr-periodo-aquisitivo-text");
    if(!operador || !operador.dataContratacao){
      card.textContent = "Selecione um operador com data de contratação cadastrada.";
    } else {
      var per = periodoAquisitivo(operador.dataContratacao);
      if(!per.completed){
        card.textContent = "Período aquisitivo em andamento — completa em " + fmtDateObj(per.end) + ".";
      } else {
        card.textContent = fmtDateObj(per.start) + " até " + fmtDateObj(per.end) + " · " + per.dias + " dias disponíveis";
      }
    }
    updateFRSummary();
  }

  function updateFRDuracaoESumario(){
    var inicio = document.getElementById("fm-data-inicio").value;
    var termino = document.getElementById("fm-data-termino").value;
    var box = document.getElementById("fr-duracao-text");
    if(inicio && termino){
      var d1 = new Date(inicio + "T00:00:00");
      var d2 = new Date(termino + "T00:00:00");
      var dias = Math.round((d2 - d1) / 86400000) + 1;
      box.textContent = dias > 0 ? dias + " dias corridos" : "Datas inválidas";
    } else {
      box.textContent = "— dias corridos";
    }
    updateFRSummary();
  }

  function updateFRSummary(){
    var operadorId = document.getElementById("fm-operador").value;
    var operador = db.users.find(function(u){ return u.id === operadorId; });
    document.getElementById("fr-sum-operador").textContent = operador ? operador.nome : "—";
    document.getElementById("fr-sum-matricula").textContent = operador ? (operador.matricula||"—") : "—";

    if(operador && operador.dataContratacao){
      var per = periodoAquisitivo(operador.dataContratacao);
      document.getElementById("fr-sum-aquisitivo").textContent = per.completed ? (fmtDateObj(per.start) + " – " + fmtDateObj(per.end)) : "Em andamento";
    } else {
      document.getElementById("fr-sum-aquisitivo").textContent = "—";
    }

    var inicio = document.getElementById("fm-data-inicio").value;
    var termino = document.getElementById("fm-data-termino").value;
    if(inicio && termino){
      document.getElementById("fr-sum-periodo").textContent = fmtDateBR(inicio) + " – " + fmtDateBR(termino);
      var dias = Math.round((new Date(termino+"T00:00:00") - new Date(inicio+"T00:00:00")) / 86400000) + 1;
      document.getElementById("fr-sum-duracao").textContent = (dias > 0 ? dias : "—") + " dias";
    } else {
      document.getElementById("fr-sum-periodo").textContent = "—";
      document.getElementById("fr-sum-duracao").textContent = "— dias";
    }
  }

  function openFRForm(id){
    var isEdit = !!id;
    var f = isEdit ? db.ferias.find(function(x){ return x.id === id; }) : null;
    document.getElementById("fr-form-title").textContent = isEdit ? "Editar programação de férias" : "Nova programação de férias";
    document.getElementById("fr-form-crumb").textContent = isEdit ? "Editar programação" : "Nova programação";
    document.getElementById("fm-id").value = id || "";

    var opSel = document.getElementById("fm-operador");
    opSel.innerHTML = '<option value="">Selecione o operador</option>' + db.users.map(function(u){ return '<option value="'+u.id+'">'+u.nome+(u.matricula ? " ("+u.matricula+")" : "")+'</option>'; }).join("");
    opSel.value = f ? f.operadorId : "";

    var gestorSel = document.getElementById("fm-gestor");
    gestorSel.innerHTML = '<option value="">Selecione o gestor</option>' + db.users.map(function(u){ return '<option value="'+u.id+'">'+u.nome+'</option>'; }).join("");
    gestorSel.value = f ? (f.gestorId||"") : "";

    var mfSel = document.getElementById("fm-mes-ferias");
    mfSel.innerHTML = '<option value="">Selecione o mês</option>' + MESES.map(function(m){ return '<option>'+m+'</option>'; }).join("");
    mfSel.value = f ? (f.mesFerias||"") : "";

    document.getElementById("fm-data-inicio").value = f ? (f.dataInicio||"") : "";
    document.getElementById("fm-data-termino").value = f ? (f.dataTermino||"") : "";
    document.getElementById("fm-obs").value = f ? (f.obs||"") : "";
    document.getElementById("fm-obs-counter").textContent = (f && f.obs ? f.obs.length : 0) + "/255 caracteres";
    document.getElementById("fr-sum-status").textContent = f ? (f.status||"Programada") : "Programada";

    updateFRAquisitivo();
    updateFRDuracaoESumario();
  }

  /* ---------- módulo de gestão de férias ---------- */
  function renderFerias(){
    var state = {tab:"overview", calDate:new Date(), calView:"month", cardFilter:""};
    var user = currentUser();
    var isAdmin = CSRRules.allTeams(user);
    function visibleUsers(){return CSRRules.team(user,db.users);}
    function visibleVacations(){var ids=new Set(visibleUsers().map(u=>u.id));return db.ferias.filter(f=>ids.has(f.operadorId));}
    function visibleHistory(){var ids=new Set(visibleVacations().map(f=>f.id));return db.feriasHistory.filter(f=>ids.has(f.feriasId));}
    var canApprove = feriasPerm(user,"ferias_approve");
    var canReject = feriasPerm(user,"ferias_reject"), canCancel = feriasPerm(user,"ferias_cancel"), canEdit = feriasPerm(user,"ferias_edit"), canCreate = feriasPerm(user,"ferias_create"), canExport = feriasPerm(user,"ferias_export"), canHistory = feriasPerm(user,"ferias_history"), canAllBases = feriasPerm(user,"ferias_all_bases");
    var listView = document.getElementById("fr-list-view"), formView = document.getElementById("fr-form-view");

    function uById(id){ return db.users.find(function(u){ return u.id === id; }); }
    function snap(f){
      var u = uById(f.operadorId) || {};
      return {nome:f.nomeSnapshot||u.nome||"—", matricula:f.matricula||u.matricula||"—", cargo:f.cargoSnapshot||u.cargo||"—", base:f.baseSnapshot||u.unidade||"—", gestor:f.gestorNomeSnapshot||(uById(f.gestorId)||{}).nome||"—"};
    }
    function isoDate(v){ return v ? new Date(v+"T00:00:00") : null; }
    function today0(){ var d=new Date(); d.setHours(0,0,0,0); return d; }
    function days(f){ var a=isoDate(f.dataInicio),b=isoDate(f.dataTermino); return a&&b ? Math.round((b-a)/86400000)+1 : 0; }
    function effectiveStatus(f){
      var raw=f.status||"Pendente", now=today0(), a=isoDate(f.dataInicio), b=isoDate(f.dataTermino);
      if(["Recusada","Cancelada"].indexOf(raw)!==-1) return raw;
      if(b && b<now) return "Encerrada";
      if(a && b && a<=now && b>=now && raw!=="Pendente") return "Em andamento";
      return raw;
    }
    function statusHtml(f){ var s=effectiveStatus(f); return '<span class="fr-status '+s.toLowerCase().replace(/ /g,"-")+'">'+escapeHtml(s)+'</span>'; }
    function activeRecords(){ return visibleVacations().filter(function(f){ return ["Recusada","Cancelada"].indexOf(effectiveStatus(f))===-1; }); }
    function overlaps(a1,a2,b1,b2){ return a1<=b2 && a2>=b1; }
    function addHistory(f, action, fromStatus, toStatus){
      var s=snap(f); db.feriasHistory.unshift({id:"fh-"+Date.now()+Math.random(),feriasId:f.id,at:Date.now(),colaborador:s.nome,periodo:fmtDateBR(f.dataInicio)+" – "+fmtDateBR(f.dataTermino),actor:user?user.nome:"—",action:action,fromStatus:fromStatus||"—",toStatus:toStatus||effectiveStatus(f)});
    }
    function showList(tab){ listView.style.display="block"; formView.style.display="none"; if(tab) switchTab(tab); }
    function showForm(id){ openFRForm(id||null); listView.style.display="none"; formView.style.display="block"; }
    function switchTab(tab){
      state.tab=tab; document.querySelectorAll("[data-fr-tab]").forEach(function(b){ b.classList.toggle("active",b.dataset.frTab===tab); });
      document.querySelectorAll(".fr-pane").forEach(function(p){ p.style.display=p.id==="fr-pane-"+tab?"block":"none"; });
      if(tab==="calendar") drawCalendar(); if(tab==="people") drawPeople(); if(tab==="bases") drawBases(); if(tab==="history") drawHistory();
    }
    function criticalPeriod(records){
      var counts={}; records.forEach(function(f){ var a=isoDate(f.dataInicio),b=isoDate(f.dataTermino); if(!a||!b)return; for(var d=new Date(a);d<=b;d.setDate(d.getDate()+1)){ var k=d.toISOString().slice(0,10); counts[k]=(counts[k]||0)+1; } });
      var keys=Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a] || a.localeCompare(b); }); return keys.length?{date:keys[0],count:counts[keys[0]]}:null;
    }
    function renderBars(el, pairs){
      var max=Math.max.apply(null,pairs.map(function(x){return x[1];}).concat([1])); el.innerHTML=pairs.length?pairs.map(function(x){return '<div class="fr-chart-row"><span class="fr-chart-label" title="'+escapeHtml(x[0])+'">'+escapeHtml(x[0])+'</span><div class="fr-chart-track"><div class="fr-chart-fill" style="width:'+Math.round(x[1]/max*100)+'%"></div></div><span class="fr-chart-count">'+x[1]+'</span></div>';}).join(""):'<div class="empty-state">Sem dados para exibir</div>';
    }
    function grouped(records, getter){ var m={}; records.forEach(function(f){var k=getter(f)||"—";m[k]=(m[k]||0)+1;}); return Object.keys(m).map(function(k){return[k,m[k]];}).sort(function(a,b){return b[1]-a[1];}); }
    function drawOverview(){
      var now=today0(), limit=new Date(now); limit.setDate(limit.getDate()+30); var rec=activeRecords();
      var ongoing=rec.filter(function(f){return effectiveStatus(f)==="Em andamento";});
      var upcoming=rec.filter(function(f){var d=isoDate(f.dataInicio);return d&&d>now&&d<=limit;});
      var month=rec.filter(function(f){var d=isoDate(f.dataInicio);return d&&d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
      var pending=visibleVacations().filter(function(f){return effectiveStatus(f)==="Programada";}); var crit=criticalPeriod(rec);
      var cards=[{key:"ongoing",n:ongoing.length,l:"Férias em andamento",s:"Colaboradores afastados hoje"},{key:"upcoming",n:upcoming.length,l:"Próximas férias",s:"Nos próximos 30 dias"},{key:"month",n:month.length,l:"Férias neste mês",s:MESES[now.getMonth()]},{key:"pending",n:pending.length,l:"Férias programadas",s:"Planejamento da equipe"},{key:"critical",n:crit?crit.count:0,l:"Próximo período crítico",s:crit?fmtDateBR(crit.date):"Sem concentração"}];
      document.getElementById("fr-kpis").innerHTML=cards.map(function(c){return '<button class="fr-kpi" data-kpi="'+c.key+'"><span>'+c.l+'</span><b>'+c.n+'</b><small>'+c.s+'</small></button>';}).join("");
      document.querySelectorAll("[data-kpi]").forEach(function(b){b.onclick=function(){state.cardFilter=b.dataset.kpi;switchTab("people");applyCardFilter();drawPeople();};});
      var upBody=document.getElementById("fr-upcoming-tbody"); upBody.innerHTML=upcoming.slice(0,8).map(function(f){var s=snap(f);return '<tr data-fr-open="'+f.id+'"><td><b>'+escapeHtml(s.nome)+'</b></td><td>'+escapeHtml(s.cargo)+'</td><td>'+escapeHtml(s.base)+'</td><td>'+fmtDateBR(f.dataInicio)+'</td><td>'+fmtDateBR(f.dataTermino)+'</td><td>'+statusHtml(f)+'</td></tr>';}).join("")||'<tr><td colspan="6" class="empty-state">Nenhuma programação de férias nos próximos 30 dias</td></tr>';
      var team=visibleUsers().filter(function(u){return u.managerId===(user&&user.id);}); if(isAdmin) team=visibleUsers();
      var teamIds=team.map(function(u){return u.id;}); var teamAway=ongoing.filter(function(f){return teamIds.indexOf(f.operadorId)!==-1;}).length; var teamPending=pending.filter(function(f){return teamIds.indexOf(f.operadorId)!==-1;}).length;
      document.getElementById("fr-team-stats").innerHTML='<div class="fr-mini-stat"><b>'+team.length+'</b><span>Total da equipe</span></div><div class="fr-mini-stat"><b>'+teamAway+'</b><span>Em férias</span></div><div class="fr-mini-stat"><b>'+(team.length-teamAway)+'</b><span>Disponíveis hoje</span></div>';
      document.getElementById("fr-team-chart").innerHTML='<div class="hint-text" style="margin:0;">Cobertura atual: <b>'+Math.round((team.length-teamAway)/Math.max(team.length,1)*100)+'%</b> · Pendências para análise: <b>'+teamPending+'</b></div>';
      var alerts=[]; grouped(rec,function(f){return snap(f).base;}).forEach(function(x){if(x[1]>=3)alerts.push('Existem '+x[1]+' programações de férias na base '+x[0]+'.');}); if(crit&&crit.count>=2)alerts.push('Em '+fmtDateBR(crit.date)+' haverá '+crit.count+' colaboradores de férias simultaneamente.');
      document.getElementById("fr-alerts").innerHTML=alerts.length?alerts.map(function(a){return '<div class="fr-alert">⚠️ '+escapeHtml(a)+'</div>';}).join(""):'<div class="empty-state">Nenhuma concentração relevante identificada.</div>';
      var byMonth=MESES.map(function(m,i){return[m,rec.filter(function(f){var d=isoDate(f.dataInicio);return d&&d.getFullYear()===now.getFullYear()&&d.getMonth()===i;}).length];}); renderBars(document.getElementById("fr-month-chart"),byMonth);
      document.querySelectorAll("[data-fr-open]").forEach(function(r){r.onclick=function(){openDetail(r.dataset.frOpen);};});
      var config=document.getElementById("fr-config-panel"); config.style.display="none"; var ap=document.getElementById("fr-approval-enabled"); ap.checked=false;
    }
    function populateFilters(){
      function opts(id,label,vals){var e=document.getElementById(id);e.innerHTML='<option value="">'+label+'</option>'+vals.filter(function(v,i,a){return v&&a.indexOf(v)===i;}).sort().map(function(v){return '<option>'+escapeHtml(v)+'</option>';}).join("");}
      opts("fr-base-filter","Todas as bases",visibleUsers().map(function(u){return u.unidade;})); opts("fr-cargo-filter","Todos os cargos",visibleUsers().map(function(u){return u.cargo;}));
      var g=document.getElementById("fr-gestor-filter");g.innerHTML='<option value="">Todos os gestores</option>'+visibleUsers().map(function(u){return '<option value="'+u.id+'">'+escapeHtml(u.nome)+'</option>';}).join("");
      document.getElementById("fr-status-filter").innerHTML='<option value="">Todos os status</option>'+["Programada","Pendente","Aprovada","Em andamento","Encerrada","Recusada","Cancelada"].map(function(s){return '<option>'+s+'</option>';}).join("");
      document.getElementById("fr-month-filter").innerHTML='<option value="">Todos os meses</option>'+MESES.map(function(m,i){return '<option value="'+i+'">'+m+'</option>';}).join("");
    }
    function applyCardFilter(){ var s=document.getElementById("fr-status-filter"),m=document.getElementById("fr-month-filter");s.value="";m.value="";if(state.cardFilter==="ongoing")s.value="Em andamento";if(state.cardFilter==="pending")s.value="Programada";if(state.cardFilter==="month")m.value=String(new Date().getMonth()); }
    function filtered(){
      var q=document.getElementById("fr-search").value.toLowerCase().trim(),base=document.getElementById("fr-base-filter").value,cargo=document.getElementById("fr-cargo-filter").value,gestor=document.getElementById("fr-gestor-filter").value,status=document.getElementById("fr-status-filter").value,month=document.getElementById("fr-month-filter").value;
      var now=today0(),limit=new Date(now);limit.setDate(limit.getDate()+30);
      return visibleVacations().slice().reverse().filter(function(f){var x=snap(f),d=isoDate(f.dataInicio);if(q&&((x.nome+" "+x.matricula).toLowerCase().indexOf(q)===-1))return false;if(base&&x.base!==base)return false;if(cargo&&x.cargo!==cargo)return false;if(gestor&&f.gestorId!==gestor)return false;if(status&&effectiveStatus(f)!==status)return false;if(month!==""&&(!d||d.getMonth()!==Number(month)))return false;if(state.cardFilter==="upcoming"&&(!d||d<=now||d>limit))return false;return true;});
    }
    function drawPeople(){
      var rows=filtered(),tbody=document.getElementById("fr-tbody");tbody.innerHTML=rows.map(function(f){var x=snap(f);return '<tr><td><button class="link-btn" data-detail="'+f.id+'"><b>'+escapeHtml(x.nome)+'</b><br><small>'+escapeHtml(x.matricula)+'</small></button></td><td>'+escapeHtml(x.cargo)+'<br><small>'+escapeHtml(x.base)+'</small></td><td>'+escapeHtml(x.gestor)+'</td><td>'+fmtDateBR(f.dataInicio)+'<br><small>até '+fmtDateBR(f.dataTermino)+'</small></td><td>'+days(f)+'</td><td>'+statusHtml(f)+'</td><td><div class="row-actions"><button data-detail="'+f.id+'">Detalhes</button><button data-edit-fr="'+f.id+'">Editar</button></div></td></tr>';}).join("")||'<tr><td colspan="7" class="empty-state">Nenhuma programação encontrada</td></tr>';
      tbody.querySelectorAll("[data-detail]").forEach(function(b){b.onclick=function(){openDetail(b.dataset.detail);};});tbody.querySelectorAll("[data-edit-fr]").forEach(function(b){b.style.display=canEdit?"":"none";b.onclick=function(){showForm(b.dataset.editFr);};});
    }
    function openDetail(id){
      var f=visibleVacations().find(function(x){return x.id===id;}),x=snap(f);if(!f)return;document.getElementById("fr-detail-title").textContent=x.nome;document.getElementById("fr-detail-body").innerHTML='<div style="margin-top:8px;">'+statusHtml(f)+'</div><div class="fr-detail-grid"><div class="fr-detail-field"><span>Matrícula</span><b>'+escapeHtml(x.matricula)+'</b></div><div class="fr-detail-field"><span>Cargo</span><b>'+escapeHtml(x.cargo)+'</b></div><div class="fr-detail-field"><span>Gestor</span><b>'+escapeHtml(x.gestor)+'</b></div><div class="fr-detail-field"><span>Base</span><b>'+escapeHtml(x.base)+'</b></div><div class="fr-detail-field"><span>Início</span><b>'+fmtDateBR(f.dataInicio)+'</b></div><div class="fr-detail-field"><span>Término</span><b>'+fmtDateBR(f.dataTermino)+' · '+days(f)+' dias</b></div></div><div class="fr-detail-field"><span>Observações</span><b>'+escapeHtml(f.obs||"Sem observações")+'</b></div>';
      var actions=document.getElementById("fr-detail-actions"),s=f.status||"Pendente";actions.innerHTML=(canEdit?'<button class="btn btn-secondary" data-dedit>Editar</button>':'')+(canApprove&&s==="Pendente"?'<button class="btn btn-success" data-approve>Aprovar</button>':'')+(canReject&&s==="Pendente"?'<button class="btn btn-danger" data-reject>Recusar</button>':'')+(canCancel&&s!=="Cancelada"&&effectiveStatus(f)!=="Encerrada"?'<button class="btn btn-secondary" data-cancel>Cancelar programação</button>':'');
      function changeStatus(to,reason){var from=f.status||"Pendente";f.status=to;f.decisionBy=user?user.nome:"—";f.decisionAt=Date.now();f.refusalReason=reason||"";addHistory(f,to,from,to);saveDB(db);addNotification(f.operadorId,"ferias","Férias "+to.toLowerCase(),"Sua programação de "+fmtDateBR(f.dataInicio)+" a "+fmtDateBR(f.dataTermino)+" foi atualizada para "+to+".","ferias",f.id);closeDetail();refreshAll();refreshNotifBadge();}
      var e=actions.querySelector("[data-dedit]");if(e)e.onclick=function(){closeDetail();showForm(id);};e=actions.querySelector("[data-approve]");if(e)e.onclick=function(){changeStatus("Aprovada");};e=actions.querySelector("[data-reject]");if(e)e.onclick=function(){var r=prompt("Informe o motivo da recusa:");if(r!==null&&r.trim())changeStatus("Recusada",r.trim());};e=actions.querySelector("[data-cancel]");if(e)e.onclick=function(){if(confirm("Cancelar esta programação?"))changeStatus("Cancelada");};document.getElementById("fr-detail").classList.add("show");
    }
    function closeDetail(){document.getElementById("fr-detail").classList.remove("show");}
    function drawHistory(){var body=document.getElementById("fr-history-tbody");var hist=(db.feriasHistory||[]).slice();visibleVacations().filter(function(f){return effectiveStatus(f)==="Encerrada";}).forEach(function(f){if(!hist.some(function(h){return h.feriasId===f.id;})){var x=snap(f);hist.push({at:isoDate(f.dataTermino).getTime(),colaborador:x.nome,periodo:fmtDateBR(f.dataInicio)+" – "+fmtDateBR(f.dataTermino),actor:"Sistema",action:"Férias encerradas",fromStatus:f.status||"Aprovada",toStatus:"Encerrada"});}});body.innerHTML=hist.sort(function(a,b){return b.at-a.at;}).map(function(h){return '<tr><td>'+new Date(h.at).toLocaleString("pt-BR")+'</td><td>'+escapeHtml(h.colaborador)+'</td><td>'+escapeHtml(h.periodo)+'</td><td>'+escapeHtml(h.actor)+'</td><td>'+escapeHtml(h.action)+'</td><td>'+escapeHtml(h.fromStatus)+' → '+escapeHtml(h.toStatus)+'</td></tr>';}).join("")||'<tr><td colspan="6" class="empty-state">Nenhuma alteração registrada</td></tr>';}
    function drawBases(){
      var sel=document.getElementById("fr-base-view-filter"),bases=visibleUsers().map(function(u){return u.unidade;}).filter(function(v,i,a){return v&&a.indexOf(v)===i;}).sort();if(!canAllBases)bases=bases.filter(function(b){return b===(user&&user.unidade);});if(!sel.options.length)sel.innerHTML='<option value="">Todas as bases permitidas</option>'+bases.map(function(b){return '<option>'+escapeHtml(b)+'</option>';}).join("");var base=sel.value||(!canAllBases&&user?user.unidade:""),users=base?visibleUsers().filter(function(u){return u.unidade===base;}):db.users,ids=users.map(function(u){return u.id;}),records=visibleVacations().filter(function(f){return ids.indexOf(f.operadorId)!==-1;}),now=today0(),lim=new Date(now);lim.setDate(lim.getDate()+30);var vals=[["Colaboradores",users.length],["Em férias",records.filter(function(f){return effectiveStatus(f)==="Em andamento";}).length],["Próximas",records.filter(function(f){var d=isoDate(f.dataInicio);return d&&d>now&&d<=lim;}).length],["Neste mês",records.filter(function(f){var d=isoDate(f.dataInicio);return d&&d.getMonth()===now.getMonth();}).length],["Pendentes",records.filter(function(f){return effectiveStatus(f)==="Pendente";}).length]];document.getElementById("fr-base-kpis").innerHTML=vals.map(function(v){return '<div class="fr-kpi"><span>'+v[0]+'</span><b>'+v[1]+'</b></div>';}).join("");renderBars(document.getElementById("fr-base-chart"),grouped(records,function(f){return snap(f).base;}));renderBars(document.getElementById("fr-role-chart"),grouped(records,function(f){return snap(f).cargo;}));
    }
    function drawCalendar(){
      var box=document.getElementById("fr-calendar"),d=state.calDate;document.getElementById("fr-cal-title").textContent=state.calView==="month"?MESES[d.getMonth()]+" de "+d.getFullYear():state.calView==="week"?"Semana de "+d.toLocaleDateString("pt-BR"):d.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"});
      if(state.calView!=="month"){var start=new Date(d);if(state.calView==="week")start.setDate(start.getDate()-start.getDay());var end=new Date(start);if(state.calView==="week")end.setDate(end.getDate()+6);var rows=activeRecords().filter(function(f){return overlaps(isoDate(f.dataInicio),isoDate(f.dataTermino),start,end);});box.innerHTML=rows.map(function(f){var x=snap(f);return '<button class="fr-kpi" style="width:100%;margin-bottom:8px" data-cal-event="'+f.id+'"><span>'+escapeHtml(x.base)+'</span><b style="font-size:16px">'+escapeHtml(x.nome)+'</b><small>'+fmtDateBR(f.dataInicio)+' – '+fmtDateBR(f.dataTermino)+' · '+effectiveStatus(f)+'</small></button>';}).join("")||'<div class="empty-state">Nenhuma programação de férias neste período</div>';}
      else {var first=new Date(d.getFullYear(),d.getMonth(),1),gridStart=new Date(first);gridStart.setDate(1-first.getDay());var html=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(function(w){return '<div class="fr-cal-week">'+w+'</div>';}).join("");for(var i=0;i<42;i++){var day=new Date(gridStart);day.setDate(gridStart.getDate()+i);var iso=day.toISOString().slice(0,10),events=activeRecords().filter(function(f){return f.dataInicio<=iso&&f.dataTermino>=iso;});html+='<div class="fr-cal-day '+(day.getMonth()!==d.getMonth()?"muted ":"")+(day.toDateString()===today0().toDateString()?"today":"")+'"><div class="fr-cal-num">'+day.getDate()+'</div>'+events.slice(0,3).map(function(f){return '<button class="fr-cal-event" data-cal-event="'+f.id+'">'+escapeHtml(snap(f).nome)+'</button>';}).join("")+(events.length>3?'<small>+'+(events.length-3)+' mais</small>':'')+'</div>';}box.innerHTML='<div class="fr-calendar-grid">'+html+'</div>';}
      box.querySelectorAll("[data-cal-event]").forEach(function(b){b.onclick=function(){openDetail(b.dataset.calEvent);};});
    }
    function refreshAll(){drawOverview();drawPeople();drawBases();drawHistory();if(state.tab==="calendar")drawCalendar();}
    function exportRows(){return filtered().map(function(f){var x=snap(f);return[x.nome,x.matricula,x.cargo,x.gestor,x.base,fmtDateBR(f.dataInicio),fmtDateBR(f.dataTermino),days(f),effectiveStatus(f)];});}
    function exportExcel(){var rows=[["Colaborador","Matrícula","Cargo","Gestor","Base","Início","Término","Dias","Status"]].concat(exportRows()),csv="\ufeff"+rows.map(function(r){return r.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"';}).join(";");}).join("\r\n"),a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download="ferias-filtradas.csv";a.click();URL.revokeObjectURL(a.href);}
    function exportPDF(){var rows=exportRows(),w=window.open("","_blank");if(!w){toast("Permita pop-ups para exportar o PDF.","error");return;}w.document.write('<!doctype html><html><head><title>Relatório de Férias</title></head><body><h1>Relatório de Férias</h1><p>Gerado em '+new Date().toLocaleString("pt-BR")+'</p><table><tr><th>Colaborador</th><th>Matrícula</th><th>Cargo</th><th>Gestor</th><th>Base</th><th>Início</th><th>Término</th><th>Dias</th><th>Status</th></tr>'+rows.map(function(r){return '<tr>'+r.map(function(v){return '<td>'+escapeHtml(v)+'</td>';}).join("")+'</tr>';}).join("")+'</table><script>onload=function(){print()}<\/script></body></html>');w.document.close();}

    populateFilters(); document.querySelectorAll("[data-fr-tab]").forEach(function(b){b.onclick=function(){switchTab(b.dataset.frTab);};});document.querySelectorAll("#fr-pane-people input,#fr-pane-people select").forEach(function(e){e.oninput=function(){state.cardFilter="";drawPeople();};e.onchange=function(){state.cardFilter="";drawPeople();};});
    document.getElementById("fr-novo-btn").style.display=canCreate?"":"none";document.getElementById("fr-novo-btn").onclick=function(){showForm(null);};document.querySelector('[data-fr-tab="history"]').style.display=canHistory?"":"none";document.getElementById("fr-export-excel").style.display=canExport?"":"none";document.getElementById("fr-export-pdf").style.display=canExport?"":"none";document.getElementById("fr-form-cancel").onclick=function(){showList(state.tab);refreshAll();};document.getElementById("fr-detail-close").onclick=closeDetail;document.getElementById("fr-detail").onclick=function(e){if(e.target===this)closeDetail();};document.getElementById("fr-base-view-filter").onchange=drawBases;document.getElementById("fr-export-excel").onclick=exportExcel;document.getElementById("fr-export-pdf").onclick=exportPDF;
    document.querySelectorAll("[data-cal-view]").forEach(function(b){b.onclick=function(){state.calView=b.dataset.calView;document.querySelectorAll("[data-cal-view]").forEach(function(x){x.classList.toggle("active",x===b);});drawCalendar();};});document.getElementById("fr-cal-prev").onclick=function(){state.calDate.setMonth(state.calDate.getMonth()-(state.calView==="month"?1:0));state.calDate.setDate(state.calDate.getDate()-(state.calView==="week"?7:state.calView==="day"?1:0));drawCalendar();};document.getElementById("fr-cal-next").onclick=function(){state.calDate.setMonth(state.calDate.getMonth()+(state.calView==="month"?1:0));state.calDate.setDate(state.calDate.getDate()+(state.calView==="week"?7:state.calView==="day"?1:0));drawCalendar();};document.getElementById("fr-cal-today").onclick=function(){state.calDate=new Date();drawCalendar();};
    document.getElementById("fm-operador").onchange=updateFRAquisitivo;document.getElementById("fm-data-inicio").onchange=updateFRDuracaoESumario;document.getElementById("fm-data-termino").onchange=updateFRDuracaoESumario;document.getElementById("fm-gestor").onchange=updateFRSummary;document.getElementById("fm-mes-ferias").onchange=updateFRSummary;document.getElementById("fm-obs").oninput=function(){document.getElementById("fm-obs-counter").textContent=this.value.length+"/255 caracteres";};
    document.getElementById("fr-form").onsubmit=function(e){e.preventDefault();var opId=document.getElementById("fm-operador").value,gId=document.getElementById("fm-gestor").value,a=document.getElementById("fm-data-inicio").value,b=document.getElementById("fm-data-termino").value,id=document.getElementById("fm-id").value;if(!opId||!gId||!a||!b){toast("Preencha colaborador, gestor e período completo.","error");return;}if(b<a){toast("A data final não pode ser anterior à inicial.","error");return;}var conflict=visibleVacations().find(function(f){return f.id!==id&&f.operadorId===opId&&["Recusada","Cancelada"].indexOf(effectiveStatus(f))===-1&&overlaps(a,b,f.dataInicio,f.dataTermino);});if(conflict){toast("Este colaborador já possui férias no período informado.","error");return;}var op=uById(opId),gest=uById(gId),old=id?visibleVacations().find(function(f){return f.id===id;}):null,oldStatus=old?(old.status||"Pendente"):"—",payload={operadorId:opId,matricula:op.matricula||"",gestorId:gId,mesFerias:MESES[isoDate(a).getMonth()],dataInicio:a,dataTermino:b,obs:document.getElementById("fm-obs").value.trim(),nomeSnapshot:op.nome,cargoSnapshot:op.cargo,baseSnapshot:op.unidade,gestorNomeSnapshot:gest?gest.nome:"—",createdBy:old?old.createdBy:(user?user.nome:"—"),createdAt:old?old.createdAt:Date.now(),status:old?old.status:(db.feriasConfig.approvalEnabled===false?"Programada":"Pendente")};if(old){Object.assign(old,payload);addHistory(old,"Programação editada",oldStatus,old.status);}else{payload.id="fr-"+Date.now();db.ferias.push(payload);addHistory(payload,"Programação criada","—",payload.status);addNotification(gId,"ferias","Nova programação de férias aguardando aprovação",op.nome+" solicitou férias de "+fmtDateBR(a)+" a "+fmtDateBR(b)+".","ferias",payload.id);}saveDB(db);toast(old?"Programação atualizada.":"Programação criada.","success");showList("overview");refreshAll();refreshNotifBadge();};
    showList("overview");refreshAll();
  }

  /* ---------- configurações de abas ---------- */
  function renderBaseConfiguration(){
    var root=document.getElementById("base-config-root");
    root.innerHTML='<div class="split-layout"><section class="section-card"><h2>Transportadoras</h2><p class="hint-text">Cadastre as empresas que poderão receber solicitações de tratamento.</p><form id="carrier-form" class="route-toolbar"><input id="carrier-name" required maxlength="120" placeholder="Nome da transportadora"><button class="btn btn-primary">Adicionar</button></form><div id="carrier-list" class="record-grid compact-records"></div></section><section class="section-card"><h2>Bases operacionais</h2><p class="hint-text">Cada base pode atender uma ou mais transportadoras.</p><form id="base-form"><div class="form-grid two"><div class="fgroup"><label>Nome da base *</label><input id="base-name" required maxlength="120"></div><div class="fgroup"><label>Código *</label><input id="base-code" required maxlength="30"></div></div><div class="fgroup"><label>Transportadoras vinculadas</label><div id="base-carriers" class="member-picker"></div></div><button class="btn btn-primary">Criar base</button></form><div id="base-list" class="record-grid compact-records" style="margin-top:16px"></div></section></div>';
    function requireConnection(){if(!supabaseClient||!db.supabaseConnected){toast("Conecte o SmartRisk ao Supabase antes de configurar bases.","error");return false;}return true;}
    function draw(){
      document.getElementById("carrier-list").innerHTML=db.transporters.map(function(c){return '<article class="record-card"><h3>'+escapeHtml(c.name)+'</h3><small>ID '+escapeHtml(c.id)+'</small><button class="btn btn-danger btn-sm" data-carrier-disable="'+c.id+'">Desativar</button></article>';}).join('')||'<div class="empty-state">Nenhuma transportadora cadastrada.</div>';
      document.getElementById("base-carriers").innerHTML=db.transporters.map(function(c){return '<label class="member-row"><input type="checkbox" value="'+c.id+'" data-base-carrier> <span><b>'+escapeHtml(c.name)+'</b></span></label>';}).join('')||'<div class="empty-state">Cadastre uma transportadora primeiro.</div>';
      document.getElementById("base-list").innerHTML=db.operationalBases.map(function(base){var names=db.baseTransporters.filter(function(link){return link.base_id===base.id;}).map(function(link){return (db.transporters.find(function(c){return c.id===link.transporter_id;})||{}).name;}).filter(Boolean);return '<article class="record-card"><h3>'+escapeHtml(base.name)+'</h3><p>'+escapeHtml(base.code)+' · '+escapeHtml(names.join(', ')||'Sem transportadoras')+'</p><button class="btn btn-danger btn-sm" data-base-disable="'+base.id+'">Desativar</button></article>';}).join('')||'<div class="empty-state">Nenhuma base cadastrada.</div>';
      root.querySelectorAll('[data-carrier-disable]').forEach(function(button){button.onclick=async function(){if(!requireConnection()||!confirm('Desativar esta transportadora?'))return;var result=await supabaseClient.from('transporters').update({active:false}).eq('id',button.dataset.carrierDisable);if(result.error){toast(result.error.message,'error');return;}await loadCloudData();draw();};});
      root.querySelectorAll('[data-base-disable]').forEach(function(button){button.onclick=async function(){if(!requireConnection()||!confirm('Desativar esta base?'))return;var result=await supabaseClient.from('operational_bases').update({active:false}).eq('id',button.dataset.baseDisable);if(result.error){toast(result.error.message,'error');return;}await loadCloudData();draw();};});
    }
    document.getElementById('carrier-form').onsubmit=async function(e){e.preventDefault();if(!requireConnection())return;var name=document.getElementById('carrier-name').value.trim(),result=await supabaseClient.from('transporters').insert({name:name});if(result.error){toast(result.error.message,'error');return;}e.target.reset();await loadCloudData();draw();toast('Transportadora cadastrada.','success');};
    document.getElementById('base-form').onsubmit=async function(e){e.preventDefault();if(!requireConnection())return;var ids=Array.from(root.querySelectorAll('[data-base-carrier]:checked')).map(function(x){return x.value;}),created=await supabaseClient.from('operational_bases').insert({name:document.getElementById('base-name').value.trim(),code:document.getElementById('base-code').value.trim().toUpperCase()}).select('id').single();if(created.error){toast(created.error.message,'error');return;}if(ids.length){var links=ids.map(function(id){return {base_id:created.data.id,transporter_id:id};}),linked=await supabaseClient.from('base_transporters').insert(links);if(linked.error){toast(linked.error.message,'error');return;}}e.target.reset();await loadCloudData();draw();toast('Base cadastrada e vinculada.','success');};
    draw();
  }

  function renderConfigAbas(){
    var root=document.getElementById("config-abas-v2-root");
    if(!root)return;
    root.innerHTML='<section class="section-card"><div class="section-title"><span class="eyebrow">INTEGRAÇÃO DE RASTREAMENTO</span><h2>Configuração de alertas do integrador</h2><p class="hint-text">Mapeie os códigos enviados pelo fornecedor para os tipos internos do SmartRisk. O evento original será preservado para auditoria.</p></div><form id="tracking-mapping-form"><div class="form-grid three"><div class="fgroup"><label>Código no fornecedor *</label><input id="mapping-code" maxlength="100" required></div><div class="fgroup"><label>Nome no fornecedor *</label><input id="mapping-name" maxlength="160" required></div><div class="fgroup"><label>Tipo normalizado *</label><select id="mapping-type" required><option value="">Selecione</option><option>PANIC_BUTTON</option><option>TRAILER_DETACHMENT</option><option>VIOLATION</option><option>ROUTE_DEVIATION</option><option>RISK_AREA_ENTRY</option><option>RISK_AREA_EXIT</option><option>COMMUNICATION_LOSS</option><option>GPS_LOSS</option><option>IGNITION</option><option>DOOR_OPEN</option><option>TRACKING_EVENT</option><option>OTHER</option></select></div><div class="fgroup"><label>Severidade *</label><select id="mapping-severity"><option>LOW</option><option selected>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></div><div class="fgroup"><label>Prioridade *</label><select id="mapping-priority"><option>LOW</option><option selected>NORMAL</option><option>HIGH</option><option>URGENT</option></select></div><div class="fgroup"><label>Descrição</label><input id="mapping-description" maxlength="300"></div></div><div class="form-grid three"><label class="setting-toggle"><span><b>Ativo</b><small>Considerar eventos deste código</small></span><input id="mapping-active" type="checkbox" checked></label><label class="setting-toggle"><span><b>Gerar alerta</b><small>Criar alerta operacional</small></span><input id="mapping-occurrence" type="checkbox" checked></label><label class="setting-toggle"><span><b>Necessita tratamento</b><small>Manter prazo e escalonamento ativos</small></span><input id="mapping-treatment" type="checkbox" checked></label><label class="setting-toggle"><span><b>Usar Groq</b><small>Somente se houver texto não estruturado</small></span><input id="mapping-ai" type="checkbox"></label></div><div class="fgroup"><label>Instruções adicionais para a IA</label><textarea id="mapping-ai-instructions" rows="3" maxlength="1000" placeholder="Opcional. Não inclua regras de prazo, escalonamento ou permissão."></textarea></div><button class="btn btn-primary">Salvar mapeamento</button></form></section><section class="section-card" style="margin-top:16px"><div class="section-title"><h2>Mapeamentos cadastrados</h2><p class="hint-text">O provider de teste usa estes mesmos códigos; depois, o adaptador real poderá ser trocado sem alterar o workflow.</p></div><div id="tracking-mapping-list" class="record-grid compact-records"></div></section>';
    root.insertAdjacentHTML("beforeend",'<section class="section-card" style="margin-top:16px"><div class="section-title"><span class="eyebrow">AMBIENTE DE TESTE</span><h2>Simulador do integrador</h2><p class="hint-text">Gera um evento HTTP real pelo provider TEST_PROVIDER. Disponível somente para Administrador.</p></div><form id="tracking-simulator-form"><div class="form-grid three"><div class="fgroup"><label>Placa de teste *</label><input id="tracking-sim-plate" value="TEST123" required maxlength="10"></div><div class="fgroup"><label>Transportadora *</label><select id="tracking-sim-transporter" required><option value="">Selecione</option>'+db.transporters.map(function(item){return '<option value="'+item.id+'" '+(item.name.toUpperCase()==="LEMAR TRANSPORTES"?'selected':'')+'>'+escapeHtml(item.name)+'</option>';}).join("")+'</select></div><div class="fgroup"><label>Base *</label><select id="tracking-sim-base" required><option value="">Selecione</option>'+db.operationalBases.map(function(item){return '<option value="'+item.id+'" '+(item.name.toUpperCase()==="DIVERSOS"?'selected':'')+'>'+escapeHtml(item.name)+'</option>';}).join("")+'</select></div></div><button class="btn btn-primary">Gerar alerta de teste</button></form></section>');
    function requireConnection(){if(!supabaseClient||!db.supabaseConnected){toast("Conecte o SmartRisk ao Supabase para configurar os alertas.","error");return false;}return true;}
    async function loadMappings(){if(!requireConnection())return;var result=await supabaseClient.from("tracking_alert_mappings").select("*").order("provider_alert_name");if(result.error){toast(result.error.message,"error");return;}draw(result.data||[]);}
    function draw(rows){var list=document.getElementById("tracking-mapping-list");list.innerHTML=rows.map(function(row){return '<article class="record-card"><div class="record-card-head"><span class="badge">'+escapeHtml(row.severity)+'</span><span class="badge">'+escapeHtml(row.active?"Ativo":"Inativo")+'</span></div><h3>'+escapeHtml(row.provider_alert_name)+'</h3><p><b>'+escapeHtml(row.provider_alert_code)+'</b> → '+escapeHtml(row.normalized_type)+'</p><small>'+escapeHtml(row.description||"Sem descrição")+'</small><div class="actions-row"><button class="btn btn-secondary btn-sm" data-map-toggle="'+row.id+'" data-map-active="'+row.active+'">'+(row.active?'Desativar':'Ativar')+'</button></div></article>';}).join("")||'<div class="empty-state">Nenhum alerta do integrador configurado.</div>';list.querySelectorAll("[data-map-toggle]").forEach(function(button){button.onclick=async function(){var result=await supabaseClient.from("tracking_alert_mappings").update({active:button.dataset.mapActive!=="true"}).eq("id",button.dataset.mapToggle);if(result.error){toast(result.error.message,"error");return;}await loadMappings();};});}
    document.getElementById("tracking-mapping-form").onsubmit=async function(e){e.preventDefault();if(!requireConnection())return;var payload={provider:"TEST_PROVIDER",provider_alert_code:document.getElementById("mapping-code").value.trim(),provider_alert_name:document.getElementById("mapping-name").value.trim(),normalized_type:document.getElementById("mapping-type").value,severity:document.getElementById("mapping-severity").value,priority:document.getElementById("mapping-priority").value,description:document.getElementById("mapping-description").value.trim(),active:document.getElementById("mapping-active").checked,creates_operational_alert:document.getElementById("mapping-occurrence").checked,requires_treatment:document.getElementById("mapping-treatment").checked,requires_ai:document.getElementById("mapping-ai").checked,ai_instructions:document.getElementById("mapping-ai-instructions").value.trim()};var result=await supabaseClient.from("tracking_alert_mappings").upsert(payload,{onConflict:"provider,provider_alert_code"});if(result.error){toast(result.error.message,"error");return;}e.target.reset();document.getElementById("mapping-active").checked=true;document.getElementById("mapping-occurrence").checked=true;document.getElementById("mapping-treatment").checked=true;toast("Mapeamento salvo.","success");await loadMappings();};
    document.getElementById("tracking-simulator-form").onsubmit=async function(e){e.preventDefault();if(!requireConnection())return;var button=e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;button.textContent="Enviando evento...";try{var mapping=await supabaseClient.from("tracking_alert_mappings").upsert({provider:"TEST_PROVIDER",provider_alert_code:"PANIC_BUTTON",provider_alert_name:"Botão de pânico — teste",normalized_type:"PANIC_BUTTON",description:"Evento simulado para validar o workflow do SmartRisk.",severity:"CRITICAL",priority:"URGENT",active:true,creates_operational_alert:true,requires_treatment:true,requires_ai:false},{onConflict:"provider,provider_alert_code"});if(mapping.error)throw mapping.error;var result=await supabaseClient.functions.invoke("tracking-test-provider",{body:{provider_event_id:"SMART-RISK-TEST-"+Date.now(),vehicle:{plate:document.getElementById("tracking-sim-plate").value.trim().toUpperCase()},driver:{name:"Condutor de teste"},transporter_id:document.getElementById("tracking-sim-transporter").value,base_id:document.getElementById("tracking-sim-base").value,event_type:"PANIC_BUTTON",description:"Botão de pânico recebido na simulação do integrador.",location:"Rota de teste SmartRisk"}});if(result.error)throw result.error;if(result.data&&result.data.smart_risk_response&&result.data.smart_risk_response.error)throw new Error(result.data.smart_risk_response.error);await loadCloudData();toast("Alerta de teste recebido pelo SmartRisk.","success");navigate("central-ocorrencias");}catch(error){console.error("Falha no simulador do integrador",error);toast(error.message||"Não foi possível gerar o alerta de teste.","error");}finally{button.disabled=false;button.textContent="Gerar alerta de teste";}};
    if(supabaseClient&&db.supabaseConnected)loadMappings();else draw([]);
  }

  /* ---------- dashboard ---------- */
  function renderDashboard(){
    var grid = document.getElementById("dash-stat-grid");
    var totalSinistros = db.sinistros.length;
    var totalPR = db.prontaResposta.length;
    var totalUsuarios = db.users.length;
    var totalOcorrencias = db.changeLogs.filter(function(c){ return c.tipo === "Alerta gerado" || c.tipo === "Alerta gerada"; }).length;
    var occPending = db.operationalOccurrences.filter(function(o){ return o.status === "Pendente"; }).length;
    var occTreatedToday = db.operationalOccurrences.filter(function(o){ return o.status === "Tratado" && o.closedAt && new Date(o.closedAt).toDateString() === new Date().toDateString(); }).length;
    var passagesReceived = db.shiftPassages.filter(function(p){ var u=currentUser(); return u && p.toId===u.id && p.status!=="Lido"; }).length;
    var mechPending = db.operationalOccurrences.filter(function(o){ return o.kind === "Problema mecânico" && o.status === "Pendente"; }).length;

    var stats = [
      {label:"Sinistros registrados", value: totalSinistros, color:"var(--danger)"},
      {label:"Pronta resposta acionadas", value: totalPR, color:"var(--orange)"},
      {label:"Alertas geradas", value: totalOcorrencias, color:"var(--blue)"},
      {label:"Usuários cadastrados", value: totalUsuarios, color:"var(--green)"},
      {label:"Alertas pendentes", value: occPending, color:"var(--orange)"},
      {label:"Alertas encerrados hoje", value: occTreatedToday, color:"var(--green)"},
      {label:"Passagens não lidas", value: passagesReceived, color:"var(--blue)"},
      {label:"Problemas mecânicos atuais", value: mechPending, color:"var(--danger)"}
    ];
    grid.innerHTML = "";
    stats.forEach(function(s){
      var div = document.createElement("div");
      div.className = "stat-card";
      div.innerHTML = '<div class="stat-accent" style="background:'+s.color+';"></div><div class="stat-value">'+s.value+'</div><div class="stat-label">'+s.label+'</div>';
      grid.appendChild(div);
    });

    function breakdown(items, key, colorMap, defaultColor){
      var counts = {};
      items.forEach(function(it){
        var k = it[key] || "—";
        counts[k] = (counts[k]||0) + 1;
      });
      var max = Math.max.apply(null, Object.values(counts).concat([1]));
      var html = "";
      Object.keys(counts).forEach(function(k){
        var color = (colorMap && colorMap[k]) || defaultColor;
        var pct = Math.round((counts[k]/max)*100);
        html += '<div class="dash-bar-row"><span class="dash-bar-label">'+k+'</span><div class="dash-bar-track"><div class="dash-bar-fill" style="width:'+pct+'%;background:'+color+';"></div></div><span class="dash-bar-count">'+counts[k]+'</span></div>';
      });
      return html || '<div class="empty-state" style="padding:14px 4px;">Sem dados ainda.</div>';
    }

    var snColors = {"Aberto":"var(--orange)","Em análise":"var(--blue)","Encerrado":"var(--green)"};
    var prColors = {"Em deslocamento":"var(--blue)","Em preservação":"var(--orange)","Finalizada":"var(--green)","Cancelada":"var(--danger)"};

    var row = document.getElementById("dash-breakdown-row");
    row.innerHTML =
      '<div class="dash-panel"><h3>Sinistros por status</h3>' + breakdown(db.sinistros, "status", snColors, "var(--muted)") + '</div>' +
      '<div class="dash-panel"><h3>Pronta resposta por status</h3>' + breakdown(db.prontaResposta, "status", prColors, "var(--muted)") + '</div>' +
      '<div class="dash-panel"><h3>Alertas por base</h3>' + breakdown(db.operationalOccurrences, "base", null, "var(--orange)") + '</div>' +
      '<div class="dash-panel"><h3>Temas consultados no Assistente operacional</h3>' + breakdown(db.aiQueries, "topic", null, "var(--blue)") + '</div>';
  }

  function renderDashboard(){
    function counts(items,key){var out={};items.forEach(function(item){var value=item[key]||"Não informado";out[value]=(out[value]||0)+1;});return out;}
    function top(items,key){var entries=Object.entries(counts(items,key)).sort(function(a,b){return b[1]-a[1];});return entries.length?entries[0][0]:"Sem dados";}
    function stats(target,items){document.getElementById(target).innerHTML=items.map(function(s){return '<div class="stat-card"><div class="stat-accent" style="background:'+s.color+'"></div><div class="stat-value">'+escapeHtml(s.value)+'</div><div class="stat-label">'+escapeHtml(s.label)+'</div></div>';}).join("");}
    function breakdown(title,data,color){var entries=Object.entries(data).sort(function(a,b){return b[1]-a[1];}),max=Math.max.apply(null,entries.map(function(x){return x[1];}).concat([1]));return '<div class="dash-panel"><h3>'+escapeHtml(title)+'</h3>'+(entries.map(function(x){return '<div class="dash-bar-row"><span class="dash-bar-label">'+escapeHtml(x[0])+'</span><div class="dash-bar-track"><div class="dash-bar-fill" style="width:'+(x[1]/max*100)+'%;background:'+color+'"></div></div><span class="dash-bar-count">'+x[1]+'</span></div>';}).join("")||'<div class="empty-state">Sem dados ainda.</div>')+'</div>';}
    var pending=db.operationalOccurrences.filter(function(o){return o.status==="Pendente";}),treatedToday=db.operationalOccurrences.filter(function(o){return o.status==="Tratado"&&o.closedAt&&new Date(o.closedAt).toDateString()===new Date().toDateString();});
    stats("dash-stat-grid",[{label:"Problemas atuais",value:String(pending.length),color:"var(--orange)"},{label:"Problemas tratados hoje",value:String(treatedToday.length),color:"var(--green)"},{label:"Bases afetadas",value:String(Object.keys(counts(pending,"base")).length),color:"var(--blue)"},{label:"Alerta mais recorrente",value:top(pending,"kind"),color:"var(--danger)"}]);
    var byAlert=counts(pending,"kind"),entries=Object.entries(byAlert),max=Math.max.apply(null,entries.map(function(x){return x[1];}).concat([1]));document.getElementById("dash-breakdown-row").innerHTML='<div class="dash-panel" style="grid-column:1/-1"><h3>Gráfico dos problemas atuais da central</h3><div class="dash-chart">'+(entries.map(function(x){return '<div class="dash-chart-col"><b>'+x[1]+'</b><div class="dash-chart-bar" style="height:'+(x[1]/max*145)+'px"></div><small>'+escapeHtml(x[0])+'</small></div>';}).join("")||'<div class="empty-state" style="width:100%">Nenhum problema pendente no momento.</div>')+'</div></div>'+breakdown("Problemas por base",counts(pending,"base"),"var(--orange)");
    var openSn=db.sinistros.filter(function(s){return s.status!=="Encerrado";});stats("dash-sinistro-stats",[{label:"Total de sinistros",value:String(db.sinistros.length),color:"var(--danger)"},{label:"Sinistros abertos",value:String(openSn.length),color:"var(--orange)"},{label:"Situação mais recorrente",value:top(db.sinistros,"situacao"),color:"var(--blue)"},{label:"Estado mais afetado",value:top(db.sinistros,"uf"),color:"var(--navy)"}]);document.getElementById("dash-sinistro-breakdowns").innerHTML=breakdown("Sinistros por situação",counts(db.sinistros,"situacao"),"var(--danger)")+breakdown("Sinistros por cliente",counts(db.sinistros,"cliente"),"var(--blue)");
    stats("dash-pr-stats",[{label:"Total de pronta resposta",value:String(db.prontaResposta.length),color:"var(--orange)"},{label:"Estado mais acionado",value:top(db.prontaResposta,"uf"),color:"var(--blue)"},{label:"Operação mais acionada",value:top(db.prontaResposta,"operacao"),color:"var(--navy)"},{label:"Quem mais aciona",value:top(db.prontaResposta,"solicitanteNome"),color:"var(--green)"},{label:"Motivo mais acionado",value:top(db.prontaResposta,"motivo"),color:"var(--danger)"}]);document.getElementById("dash-pr-breakdowns").innerHTML=breakdown("Pronta resposta por motivo",counts(db.prontaResposta,"motivo"),"var(--orange)")+breakdown("Pronta resposta por operação",counts(db.prontaResposta,"operacao"),"var(--blue)");
    var dashNav=document.querySelector(".dash-nav");dashNav.style.display="none";["geral","sinistro","pronta"].forEach(function(tab){document.getElementById("dash-pane-"+tab).style.display="none";});var dashHub=document.createElement("section");dashHub.className="dashboard-hub";dashHub.innerHTML='<div class="choice-hub-intro"><h2>Qual dashboard deseja visualizar?</h2><p class="hint-text">Abra somente a visão necessária para sua análise.</p></div><div class="assistant-menu-grid"><button class="menu-card" data-dashboard-choice="geral"><span>Dashboard geral<small>Problemas atuais e cenário da central</small></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+icon("chart")+'</svg></button><button class="menu-card" data-dashboard-choice="sinistro"><span>Sinistro<small>Alertas, situações e clientes afetados</small></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+icon("file")+'</svg></button><button class="menu-card" data-dashboard-choice="pronta"><span>Pronta resposta<small>Acionamentos, motivos e operações</small></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+icon("truck")+'</svg></button></div>';dashNav.parentNode.insertBefore(dashHub,dashNav);function showDashboardHub(){dashHub.style.display="block";["geral","sinistro","pronta"].forEach(function(tab){document.getElementById("dash-pane-"+tab).style.display="none";});}function openDashboardArea(tab){dashHub.style.display="none";var pane=document.getElementById("dash-pane-"+tab);pane.style.display="block";if(!pane.querySelector("[data-dashboard-home]")){var back=document.createElement("button");back.className="subpage-back dashboard-area-back";back.setAttribute("data-dashboard-home","");back.textContent="← Voltar aos dashboards";pane.insertBefore(back,pane.firstChild);back.onclick=showDashboardHub;}}dashHub.querySelectorAll("[data-dashboard-choice]").forEach(function(button){button.onclick=function(){openDashboardArea(button.dataset.dashboardChoice);};});showDashboardHub();
  }

  function renderProntaResposta(){
    var searchEl = document.getElementById("pr-search");
    var statusEl = document.getElementById("pr-status-filter");

    function fmtDate(iso){
      if(!iso) return "—";
      var parts = iso.split("-");
      if(parts.length !== 3) return iso;
      return parts[2]+"/"+parts[1]+"/"+parts[0];
    }

    function draw(){
      var tbody = document.getElementById("pr-tbody");
      var q = (searchEl.value || "").trim().toLowerCase();
      var statusFilter = statusEl.value;
      var rows = db.prontaResposta.slice().reverse().filter(function(pr){
        if(statusFilter && pr.status !== statusFilter) return false;
        if(!q) return true;
        var hay = [pr.cavalo, pr.sm, pr.motivo, pr.transportadora, pr.solicitanteNome, pr.operacao].join(" ").toLowerCase();
        return hay.indexOf(q) !== -1;
      });
      if(!rows.length){
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhum registro</td></tr>';
        return;
      }
      tbody.innerHTML = "";
      rows.forEach(function(pr){
        var tr = document.createElement("tr");
        tr.innerHTML =
          '<td>'+fmtDate(pr.data)+(pr.horario ? " "+pr.horario : "")+'</td>'+
          '<td>'+(pr.cavalo||"—")+'</td>'+
          '<td>'+(pr.sm||"—")+'</td>'+
          '<td>'+(pr.solicitanteNome||"—")+'</td>'+
          '<td>'+(pr.motivo||"—")+'</td>'+
          '<td>'+(pr.operacao||"—")+'</td>'+
          '<td><span class="status-badge '+(STATUS_CLASS[pr.status]||"st-desloc")+'">'+pr.status+'</span></td>'+
          '<td><div class="row-actions"><button data-edit="'+pr.id+'">Editar</button><button data-del="'+pr.id+'" class="del">Excluir</button></div></td>';
        tbody.appendChild(tr);if(pr.alertId){const b=document.createElement('button');b.textContent=pr.status==='Encerrada'?'Detalhes':'Finalizar atendimento';b.onclick=()=>CSRFlows.prDetails(pr,draw);tr.lastElementChild.append(b);}
      });
      tbody.querySelectorAll("[data-edit]").forEach(function(b){
        b.addEventListener("click", function(){ openPRModal(b.getAttribute("data-edit")); });
      });
      tbody.querySelectorAll("[data-del]").forEach(function(b){
        b.addEventListener("click", function(){
          var id = b.getAttribute("data-del");
          var pr = db.prontaResposta.find(function(x){ return x.id === id; });
          if(pr.alertId){toast("O registro está vinculado a um alerta. Preserve o histórico e finalize o atendimento.","error");return;}if(confirm('Excluir o registro da placa "'+pr.cavalo+'"?')){
            db.prontaResposta = db.prontaResposta.filter(function(x){ return x.id !== id; });
            saveDB(db);
            addLog("Pronta resposta excluída: " + pr.cavalo);
            addChangeLog("Pronta resposta excluída", "Placa " + pr.cavalo + " (" + (pr.motivo||"sem motivo") + ")", null, "");
            toast("Registro excluído.", "success");
            draw();
          }
        });
      });
    }

    draw();
    searchEl.addEventListener("input", draw);
    statusEl.addEventListener("change", draw);
    document.getElementById("pr-nova-btn").addEventListener("click", function(){ openPRModal(null); });
    document.getElementById("pr-export").addEventListener("click", function(){
      var header = ["Data","Placa","SM","Solicitante","Motivo","Operação","Transportadora","Status"];
      var lines = [header.join(";")];
      db.prontaResposta.forEach(function(pr){
        lines.push([fmtDate(pr.data), pr.cavalo||"", pr.sm||"", pr.solicitanteNome||"", pr.motivo||"", pr.operacao||"", pr.transportadora||"", pr.status||""].join(";"));
      });
      var blob = new Blob(["\uFEFF" + lines.join("\n")], {type:"text/csv;charset=utf-8;"});
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "pronta_resposta.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
    window._refreshPRTable = draw;
  }

  var prModalOverlay = document.getElementById("pr-modal-overlay");
  function openPRModal(id){
    var isEdit = !!id;
    var pr = isEdit ? db.prontaResposta.find(function(x){ return x.id === id; }) : null;
    document.getElementById("pm-id").value = id || "";
    document.getElementById("pm-cavalo").value = pr ? pr.cavalo : "";
    document.getElementById("pm-sm").value = pr ? pr.sm : "";
    var users=db.users.slice().sort(function(a,b){return a.nome.localeCompare(b.nome,"pt-BR");});document.getElementById("pm-solicitante").innerHTML='<option value="">Selecione o solicitante</option>'+users.map(function(u){return '<option value="'+u.id+'">'+escapeHtml(u.nome)+' — '+escapeHtml(u.matricula||"")+'</option>';}).join("");
    setSelectOptions("pm-transportadora","transportadoras","Selecione a transportadora",pr?pr.transportadora:"");setSelectOptions("pm-tecnologia","tecnologias","Selecione a tecnologia",pr?pr.tecnologia:"");setSelectOptions("pm-operacao","clientes","Selecione a operação",pr?pr.operacao:"");setSelectOptions("pm-motivo","deslocamentoMotivos","Selecione o motivo",pr?pr.motivo:"");setSelectOptions("pm-motivo2","deslocamentoMotivos","Selecione o motivo secundário",pr?pr.motivo2:"");
    document.getElementById("pm-solicitante").value=pr?(pr.solicitanteId||""):(currentUser()?currentUser().id:"");document.getElementById("pm-datetime").value=pr&&pr.data?(pr.data+"T"+(pr.horario||"00:00")):new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);document.getElementById("pm-pronta").value=pr?(pr.pronta||""):"";document.getElementById("pm-motorista").value=pr?(pr.motorista||""):"";document.getElementById("pm-cpf").value=pr?(pr.cpf||""):"";document.getElementById("pm-valor").value=pr?(pr.valor||""):"";document.getElementById("pm-uf").value=pr?(pr.uf||""):"";document.getElementById("pm-cidade").value=pr?(pr.cidade||""):"";document.getElementById("pm-autorizou").value=pr?(pr.autorizou||""):"";
    document.getElementById("pm-status").value = pr ? pr.status : "Em deslocamento";
    document.getElementById("pm-obs").value = pr ? (pr.obs||"") : "";if(!pr&&window.csrPrAlert){var alert=db.operationalOccurrences.find(function(x){return x.id===window.csrPrAlert;});if(alert){document.getElementById("pm-cavalo").value=alert.placa||"";document.getElementById("pm-sm").value=alert.sm||"";document.getElementById("pm-motorista").value=alert.condutor||"";document.getElementById("pm-operacao").value=alert.base||"";document.getElementById("pm-status").value="Em deslocamento";document.querySelector("#pr-modal-overlay h3").textContent="Acionar pronta resposta";}}else document.querySelector("#pr-modal-overlay h3").textContent="Nova pronta resposta";
    prModalOverlay.classList.add("show");
  }
  function closePRModal(){ prModalOverlay.classList.remove("show");window.csrPrAlert=null; }
  document.getElementById("pr-modal-close").addEventListener("click", closePRModal);
  document.getElementById("pr-modal-cancel").addEventListener("click", closePRModal);
  prModalOverlay.addEventListener("click", function(e){ if(e.target === prModalOverlay) closePRModal(); });

  document.getElementById("pr-modal-form").addEventListener("submit", function(e){
    e.preventDefault();
    var cavalo = document.getElementById("pm-cavalo").value.trim();
    if(!cavalo){ toast("Informe a placa do cavalo.", "error"); return; }
    var id = document.getElementById("pm-id").value;
    var existingPR=db.prontaResposta.find(x=>x.id===id);if(existingPR&&existingPR.alertId&&['Encerrada','Encerrado','Finalizada','Cancelada'].includes(document.getElementById('pm-status').value)){closePRModal();CSRFlows.finish(db.operationalOccurrences.find(a=>a.id===existingPR.alertId),()=>renderProntaResposta());return;}
    var dt=document.getElementById("pm-datetime").value,solicitante=db.users.find(function(u){return u.id===document.getElementById("pm-solicitante").value;});var payload = {
      cavalo: cavalo.toUpperCase(),
      sm: document.getElementById("pm-sm").value.trim(),
      motivo: document.getElementById("pm-motivo").value,
      motivo2: document.getElementById("pm-motivo2").value,data:dt.slice(0,10),horario:dt.slice(11,16),solicitanteId:solicitante?solicitante.id:"",solicitanteNome:solicitante?solicitante.nome:"",pronta:document.getElementById("pm-pronta").value.trim(),motorista:document.getElementById("pm-motorista").value.trim(),cpf:document.getElementById("pm-cpf").value.trim(),tecnologia:document.getElementById("pm-tecnologia").value,operacao:document.getElementById("pm-operacao").value,valor:document.getElementById("pm-valor").value.trim(),uf:document.getElementById("pm-uf").value,cidade:document.getElementById("pm-cidade").value.trim(),autorizou:document.getElementById("pm-autorizou").value.trim(),
      status: document.getElementById("pm-status").value,
      transportadora: document.getElementById("pm-transportadora").value,
      obs: document.getElementById("pm-obs").value.trim()
    };
    if(!id&&window.csrPrAlert){if(!document.getElementById("pm-pronta").value.trim()||["Finalizada","Cancelada","Encerrada"].includes(document.getElementById("pm-status").value)){toast("Informe a equipe e mantenha a pronta em atendimento.","error");return;}var sourceAlert=db.operationalOccurrences.find(function(x){return x.id===window.csrPrAlert;});if(!sourceAlert){toast("Alerta não encontrado.","error");return;}payload.id="pr-"+Date.now();payload.equipe=payload.pronta;var submitPR=document.querySelector("#pr-modal-form [type=submit]");submitPR.disabled=true;CSRFlows.transition(sourceAlert,payload,"pronta",payload.obs||payload.motivo||"Pronta resposta acionada",false).then(function(){closePRModal();if(window.csrAlertsDraw)window.csrAlertsDraw();if(window._refreshPRTable)window._refreshPRTable();}).catch(function(error){toast(error.message||"Não foi possível vincular a pronta resposta.","error");}).finally(function(){submitPR.disabled=false;});return;}
    if(id){
      var pr = db.prontaResposta.find(function(x){ return x.id === id; });
      if(pr.alertId)payload.equipe=payload.pronta;Object.assign(pr, payload);
      addLog("Pronta resposta editada: " + pr.cavalo);
      addChangeLog("Pronta resposta editada", "Placa " + pr.cavalo + " — status: " + pr.status, null, "");
      toast("Registro atualizado.", "success");
    } else {
      payload.id = "pr-" + Date.now();
      db.prontaResposta.push(payload);
      addLog("Pronta resposta acionada: " + payload.cavalo);
      addChangeLog("Pronta resposta criada", "Placa " + payload.cavalo + " — motivo: " + (payload.motivo||"não informado"), null, "");
      toast("Pronta resposta salva.", "success");
    }
    saveDB(db);
    closePRModal();
    if(window._refreshPRTable) window._refreshPRTable();
  });

  function nowTimeStr(){
    var d = new Date();
    function p(n){return String(n).padStart(2,"0");}
    return p(d.getHours())+":"+p(d.getMinutes());
  }

  /* ---------- anotações ---------- */
  /* ---------- logs do sistema ---------- */
  var CHANGE_TIPOS = ["Usuário criado","Usuário editado","Usuário excluído","Permissões atualizadas","Pronta resposta criada","Pronta resposta editada","Pronta resposta excluída","Alerta gerado","Sinistro criado","Sinistro editado","Sinistro excluído","Perfil atualizado"];
  var CAMPO_LABELS = ["Nome","Usuário","Matrícula","E-mail","Cargo","Função de acesso","Unidade","Data de contratação","Observação","Senha"];

  function addChangeLog(tipo, detalhe, targetUserId, targetNome){
    var actor = currentUser();
    db.changeLogs.unshift({
      id:"cl-"+Date.now()+"-"+Math.random().toString(36).slice(2,6),
      at: nowStr(),
      tipo: tipo,
      detalhe: detalhe,
      actorNome: actor ? actor.nome : "—",
      targetNome: targetNome || ""
    });
    saveDB(db);
  }
  function addProfileLog(targetUserId, targetNome, campo, de, para){
    var actor = currentUser();
    db.profileLogs.unshift({
      id:"pl-"+Date.now()+"-"+Math.random().toString(36).slice(2,6),
      at: nowStr(),
      targetNome: targetNome,
      actorNome: actor ? actor.nome : "—",
      campo: campo,
      de: de || "—",
      para: para || "—"
    });
    saveDB(db);
  }

  /* ---------- notificações ---------- */
  function addNotification(targetUserId, type, title, message, route, recordId){
    if(!targetUserId) return;
    var targetUser = db.users.find(function(u){ return u.id === targetUserId; });
    if(targetUser){
      if(targetUser.notificationsEnabled === false) return;
      var prefs = targetUser.notificationPrefs || {sinistro:targetUser.notifySinistro !== false, ferias:true, sistema:true, alertas:true};
      if(prefs[type] === false) return;
    }
    db.notifications.unshift({
      id:"nf-"+Date.now()+"-"+Math.random().toString(36).slice(2,6),
      userId: targetUserId,
      type: type,
      title: title,
      message: message,
      route: route || "",
      recordId: recordId || "",
      at: Date.now(),
      read: false
    });
    saveDB(db);
  }

  function notificationRoute(n){
    if(n.type === "chat") return "chat";
    if(n.route) return n.route;
    if(n.type === "sinistro") return "sinistro";
    if(n.type === "ferias") return "ferias";
    if(/passagem/i.test(n.title||"")) return "passagem";
    if(/ocorr[eê]ncia/i.test(n.title||"")) return "central-ocorrencias";
    return "menu";
  }

  function refreshNotifBadge(){
    var user = currentUser();
    var badge = document.getElementById("notif-badge");
    if(!badge)return;
    if(!user){ badge.style.display = "none"; return; }
    (db.checklists||[]).forEach(function(c){if(c.validade&&c.validade<todayISO()&&!(c.expiryNotified||{})[user.id]){addNotification(user.id,'sistema','Checklist vencido','O checklist da placa '+c.placa+' venceu em '+fmtDateBR(c.validade)+'.','checklist',c.id);c.expiryNotified=c.expiryNotified||{};c.expiryNotified[user.id]=true;saveDB(db);}});
    var count = db.notifications.filter(function(n){ return n.userId === user.id && !n.read; }).length;
    if(count > 0){ badge.style.display = "flex"; badge.textContent = count > 99 ? "99+" : String(count); }
    else{ badge.style.display = "none"; }
  }

  function fmtNotifTime(ts){
    var diff = Date.now() - ts;
    var min = Math.floor(diff/60000);
    if(min < 1) return "agora";
    if(min < 60) return min + "min atrás";
    var h = Math.floor(min/60);
    if(h < 24) return h + "h atrás";
    var d = new Date(ts);
    function p(n){ return String(n).padStart(2,"0"); }
    return p(d.getDate())+"/"+p(d.getMonth()+1)+"/"+d.getFullYear();
  }

  function renderNotifDropdown(){
    var user = currentUser();
    if(!user) return;
    var list = document.getElementById("notif-list");
    var mine = db.notifications.filter(function(n){ return n.userId === user.id; }).slice(0, 40);
    if(!mine.length){
      list.innerHTML = '<div class="empty-state" style="padding:26px 14px;">Nenhuma notificação por aqui.</div>';
      return;
    }
    list.innerHTML = "";
    mine.forEach(function(n){
      var div = document.createElement("div");
      div.className = "notif-item " + (n.read ? "read" : "unread");
      div.innerHTML =
        '<span class="notif-dot"></span>'+
        '<div><div class="notif-title">'+escapeHtml(n.title)+'</div>'+
        '<div class="notif-msg">'+escapeHtml(n.message)+'</div>'+
        '<div class="notif-time">'+fmtNotifTime(n.at)+'</div></div>';
      div.addEventListener("click", function(){
        if(!n.read){ n.read = true; if(n.serverNotification&&supabaseClient)supabaseClient.from("user_notifications").update({read_at:new Date().toISOString()}).eq("id",n.id).then(function(){});else saveDB(db); refreshNotifBadge(); div.classList.remove("unread"); div.classList.add("read"); }
        document.getElementById("notif-dropdown").classList.remove("show");
        navigate(notificationRoute(n));
      });
      list.appendChild(div);
    });
  }

  /* datas auxiliares */
  function addYears(date, n){ var d = new Date(date); d.setFullYear(d.getFullYear()+n); return d; }
  function addMonths(date, n){ var d = new Date(date); d.setMonth(d.getMonth()+n); return d; }

  function periodoAquisitivo(dataContratacaoStr){
    if(!dataContratacaoStr) return null;
    var hire = new Date(dataContratacaoStr + "T00:00:00");
    if(isNaN(hire.getTime())) return null;
    var today = new Date();
    var years = today.getFullYear() - hire.getFullYear();
    var anniv = addYears(hire, years);
    if(anniv > today){ years -= 1; }
    if(years < 1){
      return {start: hire, end: addYears(hire, 1), limite: addYears(hire, 2), completed:false, dias:30};
    }
    var start = addYears(hire, years - 1);
    var end = addYears(hire, years);
    var limite = addYears(end, 1);
    return {start:start, end:end, limite:limite, completed:true, dias:30};
  }
  function fmtDateObj(d){
    function p(n){ return String(n).padStart(2,"0"); }
    return p(d.getDate())+"/"+p(d.getMonth()+1)+"/"+d.getFullYear();
  }

  function checkFeriasDeadlines(){
    var today = new Date();
    var changed = false;
    db.ferias.forEach(function(f){
      if(!f.operadorId || !f.gestorId) return;
      var operador = db.users.find(function(u){ return u.id === f.operadorId; });
      if(!operador || !operador.dataContratacao) return;
      var per = periodoAquisitivo(operador.dataContratacao);
      if(!per || !per.completed) return;
      var diffDays = Math.floor((per.limite - today) / 86400000);
      if(diffDays >= 0 && diffDays <= 30 && f.deadlineAlertKey !== per.limite.toISOString().slice(0,10)){
        addNotification(f.gestorId, "ferias", "Férias próximas do limite", operador.nome + " precisa tirar férias até " + fmtDateObj(per.limite) + " (" + diffDays + " dia(s)).", "ferias", f.id);
        f.deadlineAlertKey = per.limite.toISOString().slice(0,10);
        changed = true;
      }
    });
    if(changed){ saveDB(db); }
  }

  function renderLogs(user){
    var hub=document.getElementById("logs-hub"),content=document.getElementById("logs-content");function showHub(){hub.style.display="block";content.style.display="none";}function openTab(tab){hub.style.display="none";content.style.display="block";["acessos","alteracoes","perfil"].forEach(function(t){document.getElementById("logtab-"+t).style.display=t===tab?"block":"none";});}document.querySelectorAll("[data-log-choice]").forEach(function(btn){btn.onclick=function(){openTab(btn.dataset.logChoice);};});document.getElementById("logs-home").onclick=showHub;showHub();

    /* --- tab: acessos --- */
    var list = document.getElementById("logs-list");
    if(!db.logs.length){
      list.innerHTML = '<div class="empty-state">Nenhum log registrado.</div>';
    } else {
      list.innerHTML = "";
      db.logs.slice(0, 60).forEach(function(l){
        var d = document.createElement("div");
        d.className = "log-item";
        d.innerHTML = '<span class="log-date">'+l.data+'</span><span class="log-action">'+l.acao+'</span><span class="log-user">'+l.usuario+'</span>';
        list.appendChild(d);
      });
    }

    /* --- tab: alterações realizadas --- */
    var altSearch = document.getElementById("alt-search");
    var altTipo = document.getElementById("alt-tipo-filter");
    var altAutor = document.getElementById("alt-autor-filter");
    altTipo.innerHTML = '<option value="">Todos os tipos</option>' + CHANGE_TIPOS.map(function(t){ return '<option>'+t+'</option>'; }).join("");
    var autores = Array.from(new Set(db.changeLogs.map(function(c){ return c.actorNome; }))).sort();
    altAutor.innerHTML = '<option value="">Todos os autores</option>' + autores.map(function(a){ return '<option>'+a+'</option>'; }).join("");

    function drawAlt(){
      var tbody = document.getElementById("alt-tbody");
      var q = (altSearch.value||"").trim().toLowerCase();
      var rows = db.changeLogs.filter(function(c){
        if(altTipo.value && c.tipo !== altTipo.value) return false;
        if(altAutor.value && c.actorNome !== altAutor.value) return false;
        if(q && (c.tipo+" "+c.detalhe).toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
      if(!rows.length){
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhuma alteração registrada.</td></tr>';
        return;
      }
      tbody.innerHTML = "";
      rows.slice(0,150).forEach(function(c){
        var tr = document.createElement("tr");
        tr.innerHTML = '<td>'+c.at+'</td><td>'+c.actorNome+'</td><td><span class="badge">'+c.tipo+'</span></td><td>'+c.detalhe+'</td>';
        tbody.appendChild(tr);
      });
    }
    drawAlt();
    altSearch.addEventListener("input", drawAlt);
    altTipo.addEventListener("change", drawAlt);
    altAutor.addEventListener("change", drawAlt);

    /* --- tab: mudanças de perfil --- */
    var pfUserFilter = document.getElementById("pf-log-user-filter");
    var pfAutorFilter = document.getElementById("pf-log-autor-filter");
    var pfCampoFilter = document.getElementById("pf-log-campo-filter");
    var alterados = Array.from(new Set(db.profileLogs.map(function(p){ return p.targetNome; }))).sort();
    var autoresPf = Array.from(new Set(db.profileLogs.map(function(p){ return p.actorNome; }))).sort();
    pfUserFilter.innerHTML = '<option value="">Usuário alterado: todos</option>' + alterados.map(function(n){ return '<option>'+n+'</option>'; }).join("");
    pfAutorFilter.innerHTML = '<option value="">Realizado por: todos</option>' + autoresPf.map(function(n){ return '<option>'+n+'</option>'; }).join("");
    pfCampoFilter.innerHTML = '<option value="">Campo: todos</option>' + CAMPO_LABELS.map(function(c){ return '<option>'+c+'</option>'; }).join("");

    function drawPf(){
      var tbody = document.getElementById("pf-log-tbody");
      var rows = db.profileLogs.filter(function(p){
        if(pfUserFilter.value && p.targetNome !== pfUserFilter.value) return false;
        if(pfAutorFilter.value && p.actorNome !== pfAutorFilter.value) return false;
        if(pfCampoFilter.value && p.campo !== pfCampoFilter.value) return false;
        return true;
      });
      if(!rows.length){
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma mudança de perfil registrada.</td></tr>';
        return;
      }
      tbody.innerHTML = "";
      rows.slice(0,150).forEach(function(p){
        var tr = document.createElement("tr");
        tr.innerHTML = '<td>'+p.at+'</td><td>'+p.targetNome+'</td><td>'+p.actorNome+'</td><td><span class="badge">'+p.campo+'</span></td><td>'+p.de+'</td><td>'+p.para+'</td>';
        tbody.appendChild(tr);
      });
    }
    drawPf();
    pfUserFilter.addEventListener("change", drawPf);
    pfAutorFilter.addEventListener("change", drawPf);
    pfCampoFilter.addEventListener("change", drawPf);
  }

  /* ---------- login handlers ---------- */
  document.getElementById("login-form").addEventListener("submit", async function(e){
    e.preventDefault();
    var username = document.getElementById("login-user").value.trim();
    var senha = document.getElementById("login-pass").value;
    var errEl = document.getElementById("login-error");
    var submitBtn=document.querySelector("#login-form button[type=submit]");
    errEl.classList.remove("show","success");
    submitBtn.disabled=true;
    submitBtn.textContent="ENTRANDO...";
    if(!supabaseClient){
      errEl.textContent="Conexão com o Supabase indisponível. Atualize a página.";
      errEl.classList.add("show");
      submitBtn.disabled=false;submitBtn.textContent="ENTRAR";
      return;
    }
    try{
      var loginResult=await supabaseClient.functions.invoke("login-username",{body:{username:username,password:senha}});
      if(loginResult.error)throw new Error(await edgeFunctionErrorMessage(loginResult.error,"Usuário ou senha incorretos."));
      if(!loginResult.data||!loginResult.data.access_token||!loginResult.data.refresh_token)throw new Error((loginResult.data&&loginResult.data.error)||"Usuário ou senha incorretos.");
      var sessionResult=await supabaseClient.auth.setSession({access_token:loginResult.data.access_token,refresh_token:loginResult.data.refresh_token});
      if(sessionResult.error||!sessionResult.data.user)throw sessionResult.error||new Error("Não foi possível iniciar a sessão.");
      var user=await syncSupabaseProfiles(sessionResult.data.user);
      if(user.mustChangePassword){
        clearSession();
        showTemporaryPasswordChange(user);
        return;
      }
      addLog("Login Supabase realizado");
      navigate("menu");
      render();
    }catch(error){
      console.error("Falha no login Supabase",error);
      clearSession();
      errEl.textContent=error&&error.message?error.message:"Usuário ou senha incorretos.";
      errEl.classList.add("show");
    }finally{
      submitBtn.disabled=false;
      submitBtn.textContent="ENTRAR";
    }
  });

  document.getElementById("temporary-password-form").addEventListener("submit",async function(e){
    e.preventDefault();
    var password=document.getElementById("temporary-password-value").value;
    var confirmation=document.getElementById("temporary-password-confirm").value;
    var errorElement=document.getElementById("temporary-password-error");
    var button=document.getElementById("temporary-password-submit");
    errorElement.classList.remove("show");
    if(password.length<8){errorElement.textContent="A nova senha precisa ter pelo menos 8 caracteres.";errorElement.classList.add("show");return;}
    if(password!==confirmation){errorElement.textContent="As senhas informadas não coincidem.";errorElement.classList.add("show");return;}
    button.disabled=true;button.textContent="SALVANDO...";
    try{
      if(!supabaseClient||!pendingTemporaryPasswordUser)throw new Error("Sua sessão expirou. Entre novamente com a senha temporária.");
      var result=await supabaseClient.functions.invoke("admin-manage-user",{body:{action:"complete-password-change",user_id:pendingTemporaryPasswordUser.id,password:password}});
      if(result.error)throw new Error(await edgeFunctionErrorMessage(result.error,"Não foi possível salvar a nova senha."));
      await supabaseClient.auth.signOut();
      pendingTemporaryPasswordUser=null;
      clearSession();
      navigate("login");
      showLogin();
      var loginError=document.getElementById("login-error");
      loginError.textContent="Senha criada com sucesso. Entre novamente usando sua nova senha.";
      loginError.classList.add("show","success");
    }catch(error){
      console.error("Falha ao concluir a troca da senha temporária",error);
      errorElement.textContent=error&&error.message?error.message:"Não foi possível salvar a nova senha.";
      errorElement.classList.add("show");
    }finally{button.disabled=false;button.textContent="SALVAR NOVA SENHA";}
  });

  document.getElementById("forgot-link").addEventListener("click", function(){
    toast("Entre em contato com o administrador do sistema para redefinir sua senha.", "");
  });

  /* fake IP for visual parity with original screen */
  document.getElementById("user-ip").textContent = "192.168." + (Math.floor(Math.random()*200)+10) + "." + (Math.floor(Math.random()*250)+1);

  /* ---------- topbar interactions ---------- */
  /* Evita qualquer flash de tema escuro na tela pública de login. */
  document.body.classList.remove("theme-dark");
  document.getElementById("theme-toggle").addEventListener("click",function(e){e.stopPropagation();applyTheme(document.body.classList.contains("theme-dark")?"light":"dark");});
  document.getElementById("profile-menu-link").addEventListener("click",function(e){e.stopPropagation();document.getElementById("avatar-menu").classList.remove("show");navigate("perfil");});
  document.getElementById("avatar-btn").addEventListener("click", function(e){
    e.stopPropagation();
    document.getElementById("avatar-menu").classList.toggle("show");
  });
  document.addEventListener("click", function(){
    document.getElementById("avatar-menu").classList.remove("show");
  });
  document.getElementById("logout-link").addEventListener("click", async function(){
    addLog("Logout realizado");
    try{await syncAllCloudModules();}catch(ignore){}
    await stopCloudRealtime();
    if(supabaseClient) await supabaseClient.auth.signOut();
    clearSession();
    navigate("login");
    render();
  });


  function smartRiskRole(user){return (user&&(user.funcao||user.cargo))||"Operador";}
  function smartRiskLevel(user){return {Cliente:0,Operador:1,Lider:2,"Líder":2,Supervisor:3,Coordenador:4,Gerente:5,Administrador:6}[smartRiskRole(user)]||0;}
  function canCoordinate(){return smartRiskLevel(currentUser())>=3;}
  function fieldValue(id){var el=document.getElementById(id);return el?el.value.trim():"";}
  function todayISO(){var d=new Date(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return d.getFullYear()+"-"+m+"-"+day;}
  function renderAbsenceV3(){var root=document.getElementById("efetivo-v2-root"),editing=null;root.className="compact-shell";root.innerHTML='<div class="subpage-toolbar"><button class="subpage-back" id="ab-home">← Efetivo</button><h2>Faltas</h2></div><div class="split-layout"><form class="section-card" id="ab-form">'+userDatalist("ab-users")+'<h3 id="ab-title">Registrar falta</h3><div class="fgroup"><label>Colaborador *</label><input id="ab-name" list="ab-users" required></div><div class="form-grid two"><div class="fgroup"><label>Data *</label><input type="date" id="ab-date" required></div><div class="fgroup"><label>Atestado</label><select id="ab-note"><option>Sem atestado</option><option>Com atestado</option><option>Aguardando atestado</option></select></div></div><div class="fgroup"><label>Motivo da falta *</label><textarea id="ab-reason" required rows="4"></textarea></div><div class="actions-row"><button type="button" class="btn btn-secondary hidden" id="ab-cancel-edit">Cancelar edição</button><button class="btn btn-primary">Salvar falta</button></div></form><div class="section-card"><div class="bat-filterbar"><input id="ab-search" placeholder="Pesquisar colaborador ou motivo..."><input id="ab-filter-date" type="date"></div><div id="ab-list"></div></div></div>';document.getElementById("ab-home").onclick=renderEfetivoV3;upgradeSearchBars(root);var search=document.getElementById("ab-search"),date=document.getElementById("ab-filter-date");function reset(){editing=null;document.getElementById("ab-form").reset();document.getElementById("ab-title").textContent="Registrar falta";document.getElementById("ab-cancel-edit").classList.add("hidden");}document.getElementById("ab-cancel-edit").onclick=reset;function draw(){var q=search.value.toLowerCase();document.getElementById("ab-list").innerHTML=db.absences.slice().reverse().filter(function(a){return (!date.value||a.date===date.value)&&(!q||[a.name,a.reason,a.obs].join(" ").toLowerCase().includes(q));}).map(function(a){return '<article class="record-card clickable"><h3>'+escapeHtml(a.name)+'</h3><p>'+fmtDateBR(a.date)+' · '+escapeHtml(a.certificate)+'</p><p>'+escapeHtml(a.reason||a.obs||"Motivo não informado")+'</p><div class="actions-inline"><button class="btn btn-secondary btn-sm" data-ab-edit="'+a.id+'">Editar</button><button class="btn btn-danger btn-sm" data-ab-delete="'+a.id+'">Excluir</button></div></article>';}).join("")||'<div class="empty-state">Nenhuma falta encontrada.</div>';document.querySelectorAll("[data-ab-edit]").forEach(function(b){b.onclick=function(){editing=db.absences.find(function(a){return a.id===b.dataset.abEdit;});document.getElementById("ab-name").value=editing.name;document.getElementById("ab-date").value=editing.date;document.getElementById("ab-note").value=editing.certificate;document.getElementById("ab-reason").value=editing.reason||editing.obs||"";document.getElementById("ab-title").textContent="Editar falta";document.getElementById("ab-cancel-edit").classList.remove("hidden");};});document.querySelectorAll("[data-ab-delete]").forEach(function(b){b.onclick=function(){if(confirm("Excluir este registro de falta?")){db.absences=db.absences.filter(function(a){return a.id!==b.dataset.abDelete;});saveDB(db);addLog("Registro de falta excluído");draw();}};});}search.oninput=draw;date.onchange=draw;document.getElementById("ab-form").onsubmit=function(e){e.preventDefault();var payload={id:editing?editing.id:"absence-"+Date.now(),name:fieldValue("ab-name"),date:fieldValue("ab-date"),certificate:fieldValue("ab-note"),reason:fieldValue("ab-reason"),by:editing?editing.by:currentUser().nome,at:editing?editing.at:Date.now(),updatedBy:currentUser().nome,updatedAt:Date.now()};if(editing)Object.assign(editing,payload);else db.absences.push(payload);saveDB(db);addLog((editing?"Falta editada: ":"Falta registrada: ")+payload.name);reset();draw();toast("Registro salvo.","success");};draw();}
  function renderEfetivoV3(){renderEfetivoV2();var root=document.getElementById("efetivo-v2-root");root.classList.add("subtabs-thin");var absence=root.querySelector('[data-choice="absence"]');if(absence)absence.onclick=renderAbsenceV3;upgradeSearchBars(root);}

  function renderEfetivoV4(){
    var root=document.getElementById("efetivo-v2-root"),active=window.csrEffectiveSection||"control";
    root.className="effective-v4";
    function nav(){return '<nav class="effective-nav" aria-label="Áreas do efetivo">'+[
      ["dashboard","Dashboard do efetivo"],["absence","Faltas"],["sanction","Sanções"],["overtime","Horas extras"],["control","Controle de efetivo"]
    ].map(function(item){return '<button class="effective-nav-item '+(active===item[0]?"active":"")+'" data-eff-nav="'+item[0]+'">'+item[1]+'</button>';}).join("")+'</nav>';}
    function wireNav(){root.querySelectorAll("[data-eff-nav]").forEach(function(btn){btn.onclick=function(){show(btn.dataset.effNav);};});upgradeSearchBars(root);}
    function show(which){active=which;window.csrEffectiveSection=which;if(which==="absence")absence();else if(which==="sanction")sanction();else if(which==="overtime")overtime();else if(which==="control")control();else dashboard();}
    function modalShell(title,body){return '<div class="modal-overlay show effective-record-modal" id="effective-modal"><div class="modal-card effective-modal-card"><div class="modal-head"><div><small>CONTROLE DE EFETIVO</small><h2>'+escapeHtml(title)+'</h2></div><button type="button" data-eff-close aria-label="Fechar">×</button></div><div id="effective-modal-body">'+body+'</div></div></div>';}
    function closeModal(){var m=document.getElementById("effective-modal");if(m)m.remove();}
    function monthKey(value){return String(value||"").slice(0,7);}
    function dashboard(){
      root.innerHTML=nav()+'<section class="effective-dashboard"><div class="effective-dashboard-head"><div><span class="eyebrow">GESTÃO DA EQUIPE</span><h2>Dashboard do efetivo</h2><p>Horas extras e faltas no período selecionado.</p></div><div class="effective-filters"><label>Período<select id="eff-period"><option value="day">Dia</option><option value="week">Semana</option><option value="month" selected>Mês</option><option value="year">Ano</option></select></label><label>Data<input id="eff-reference" type="date" value="'+todayISO()+'"></label></div></div><div id="eff-dashboard-content"></div></section>';wireNav();document.getElementById('eff-period').onchange=draw;document.getElementById('eff-reference').onchange=draw;
      function draw(){var mode=fieldValue('eff-period'),reference=fieldValue('eff-reference'),ref=new Date(reference+'T12:00:00');function within(value){if(!value)return false;var d=new Date(value+'T12:00:00');if(mode==='day')return value===reference;if(mode==='year')return d.getFullYear()===ref.getFullYear();if(mode==='month')return d.getFullYear()===ref.getFullYear()&&d.getMonth()===ref.getMonth();var a=new Date(ref);a.setDate(a.getDate()-((a.getDay()+6)%7));var b=new Date(a);b.setDate(b.getDate()+6);return d>=a&&d<=b;}function vacation(v){return v.start<=reference&&v.end>=reference||within(v.start)||within(v.end);}var abs=db.absences.filter(function(x){return within(x.date);}),vac=db.effectiveVacations.filter(vacation),extra=(db.overtime||[]).filter(function(x){return within(x.date);}),ctrl=db.staffControls.filter(function(x){return within(x.date);});var hours=extra.reduce(function(n,x){return n+Number(x.hours||0);},0);document.getElementById('eff-dashboard-content').innerHTML='<div class="effective-kpis"><article><span>Faltas</span><b>'+abs.length+'</b><small>No período</small></article><article><span>Pessoas em hora extra</span><b>'+new Set(extra.map(function(x){return x.name;})).size+'</b><small>'+hours.toFixed(1).replace('.',',')+' horas registradas</small></article><article><span>Efetivos registrados</span><b>'+ctrl.length+'</b><small>Plantões no período</small></article></div><div class="panel v54-dashboard-detail"><h3>Registros do período</h3><div class="v54-dashboard-columns"><div><strong>Faltas</strong>'+(abs.map(function(x){return '<p>'+escapeHtml(x.name)+' · '+fmtDateBR(x.date)+'</p>';}).join('')||'<p>Nenhuma falta.</p>')+'</div><div><strong>Horas extras</strong>'+(extra.map(function(x){return '<p>'+escapeHtml(x.name)+' · '+Number(x.hours).toFixed(1)+'h</p>';}).join('')||'<p>Nenhuma hora extra.</p>')+'</div></div></div>';}
      draw();
    }    function absence(){
      root.innerHTML=nav()+'<div class="split-layout"><form class="section-card" id="ab4-form">'+userDatalist("ab4-users")+'<div class="section-title"><span class="eyebrow">NOVO REGISTRO</span><h2>Registrar falta</h2></div><div class="fgroup"><label>Colaborador *</label><input id="ab4-name" list="ab4-users" required></div><div class="form-grid two"><div class="fgroup"><label>Data *</label><input type="date" id="ab4-date" required></div><div class="fgroup"><label>Plantão *</label><select id="ab4-shift" required>'+settingOptions("plantoes","Selecione")+'</select></div><div class="fgroup"><label>Atestado</label><select id="ab4-note"><option>Sem atestado</option><option>Com atestado</option><option>Aguardando atestado</option></select></div></div><div class="fgroup"><label>Motivo *</label><textarea id="ab4-reason" rows="4" required></textarea></div><button class="btn btn-primary">Registrar falta</button></form><section class="section-card"><div class="bat-filterbar"><input id="ab4-search" placeholder="Pesquisar colaborador ou motivo..."><input id="ab4-filter-date" type="date"></div><div id="ab4-list" class="record-grid compact-records"></div></section></div>';
      wireNav();var search=document.getElementById("ab4-search"),date=document.getElementById("ab4-filter-date");search.oninput=draw;date.onchange=draw;
      document.getElementById("ab4-form").onsubmit=function(e){e.preventDefault();var item={id:"absence-"+Date.now(),name:fieldValue("ab4-name"),date:fieldValue("ab4-date"),shift:fieldValue("ab4-shift"),certificate:fieldValue("ab4-note"),reason:fieldValue("ab4-reason"),by:currentUser().nome,at:Date.now()};db.absences.push(item);saveDB(db);addLog("Falta registrada: "+item.name);e.target.reset();draw();toast("Falta registrada.","success");};
      function draw(){var q=search.value.toLowerCase();document.getElementById("ab4-list").innerHTML=db.absences.slice().reverse().filter(function(a){return (!date.value||a.date===date.value)&&(!q||[a.name,a.reason,a.shift].join(" ").toLowerCase().includes(q));}).map(function(a){return '<button class="record-card record-card-button" data-ab4="'+a.id+'"><span class="badge">'+escapeHtml(a.certificate||"Sem atestado")+'</span><h3>'+escapeHtml(a.name)+'</h3><p>'+fmtDateBR(a.date)+(a.shift?' · '+escapeHtml(a.shift):'')+'</p><small>Visualizar ou editar →</small></button>';}).join("")||'<div class="empty-state">Nenhuma falta encontrada.</div>';root.querySelectorAll("[data-ab4]").forEach(function(b){b.onclick=function(){open(b.dataset.ab4);};});}
      function open(id,edit){var a=db.absences.find(function(x){return x.id===id;});if(!a)return;var view='<div class="record-detail-grid"><div><span>Colaborador</span><b>'+escapeHtml(a.name)+'</b></div><div><span>Data</span><b>'+fmtDateBR(a.date)+'</b></div><div><span>Plantão</span><b>'+escapeHtml(a.shift||"Não informado")+'</b></div><div><span>Atestado</span><b>'+escapeHtml(a.certificate||"Não informado")+'</b></div><div class="span-all"><span>Motivo</span><p>'+escapeHtml(a.reason||a.obs||"Não informado")+'</p></div></div><div class="actions-row"><button class="btn btn-secondary" data-ab4-edit>Editar</button><button class="btn btn-danger" data-ab4-delete>Excluir</button></div>';
        var form='<form id="ab4-edit-form">'+userDatalist("ab4-edit-users")+'<div class="fgroup"><label>Colaborador *</label><input id="ab4-edit-name" list="ab4-edit-users" value="'+escapeHtml(a.name)+'" required></div><div class="form-grid two"><div class="fgroup"><label>Data *</label><input id="ab4-edit-date" type="date" value="'+a.date+'" required></div><div class="fgroup"><label>Plantão *</label><select id="ab4-edit-shift" required>'+settingOptions("plantoes","Selecione")+'</select></div><div class="fgroup"><label>Atestado</label><select id="ab4-edit-note"><option>Sem atestado</option><option>Com atestado</option><option>Aguardando atestado</option></select></div></div><div class="fgroup"><label>Motivo *</label><textarea id="ab4-edit-reason" required>'+escapeHtml(a.reason||a.obs||"")+'</textarea></div><div class="actions-row"><button type="button" class="btn btn-secondary" data-eff-close>Cancelar</button><button class="btn btn-success">Salvar edição</button></div></form>';
        document.body.insertAdjacentHTML("beforeend",modalShell(edit?"Editar falta":"Detalhes da falta",edit?form:view));document.querySelectorAll("[data-eff-close]").forEach(function(x){x.onclick=closeModal;});if(edit){document.getElementById("ab4-edit-shift").value=a.shift||"";document.getElementById("ab4-edit-note").value=a.certificate||"Sem atestado";document.getElementById("ab4-edit-form").onsubmit=function(e){e.preventDefault();var current=db.absences.find(function(x){return x.id===id;});if(!current)return;Object.assign(current,{name:fieldValue("ab4-edit-name"),date:fieldValue("ab4-edit-date"),shift:fieldValue("ab4-edit-shift"),certificate:fieldValue("ab4-edit-note"),reason:fieldValue("ab4-edit-reason"),updatedBy:currentUser().nome,updatedAt:Date.now()});saveDB(db);addLog("Falta editada: "+current.name);closeModal();draw();toast("Edição salva.","success");};}else{document.querySelector("[data-ab4-edit]").onclick=function(){closeModal();open(id,true);};document.querySelector("[data-ab4-delete]").onclick=function(){if(confirm("Excluir este registro de falta?")){db.absences=db.absences.filter(function(x){return x.id!==id;});saveDB(db);addLog("Falta excluída: "+a.name);closeModal();draw();}};}}
      draw();
    }
    function vacation(){renderSimpleRecords({key:"effectiveVacations",title:"Férias",singular:"férias",prefix:"ev4",fields:[{key:"name",label:"Colaborador",type:"user"},{key:"start",label:"Entrada",type:"date"},{key:"end",label:"Retorno",type:"date"}],summary:function(v){return fmtDateBR(v.start)+" até "+fmtDateBR(v.end);},validate:function(v){return v.end>=v.start?"":"O retorno deve ser posterior à saída.";}});}
    function overtime(){
      root.innerHTML=nav()+'<div class="split-layout"><form class="section-card" id="v54-extra-form"><div class="section-title"><span class="eyebrow">NOVO REGISTRO</span><h2>Registrar hora extra</h2></div>'+userDatalist('v54-extra-users')+'<div class="form-grid two"><div class="fgroup"><label>Colaborador *</label><input name="name" list="v54-extra-users" required></div><div class="fgroup"><label>Data *</label><input type="date" name="date" required value="'+todayISO()+'"></div><div class="fgroup"><label>Entrada *</label><input type="time" name="start" required></div><div class="fgroup"><label>Saída *</label><input type="time" name="end" required></div><div class="fgroup"><label>Intervalo (minutos)</label><input type="number" name="breakMinutes" min="0" value="60"></div><div class="fgroup"><label>Total calculado</label><output id="v54-extra-total">0h</output></div></div><button class="btn btn-primary">Registrar hora extra</button></form><section class="section-card"><h2>Histórico de horas extras</h2><div id="v54-extra-history" class="record-grid compact-records"></div></section></div>';wireNav();var f=document.getElementById('v54-extra-form');function hours(){var a=f.elements.start.value,b=f.elements.end.value;if(!a||!b)return 0;var start=a.split(':').map(Number),end=b.split(':').map(Number),minutes=(end[0]*60+end[1])-(start[0]*60+start[1]);if(minutes<0)minutes+=1440;return Math.max(0,(minutes-Number(f.elements.breakMinutes.value||0))/60);}function draw(){document.getElementById('v54-extra-history').innerHTML=(db.overtime||[]).slice().reverse().map(function(x){return '<article class="record-card"><h3>'+escapeHtml(x.name)+'</h3><p>'+fmtDateBR(x.date)+' · '+escapeHtml(x.start)+'–'+escapeHtml(x.end)+'</p><strong>'+Number(x.hours).toFixed(1).replace('.',',')+'h</strong></article>';}).join('')||'<div class="empty-state">Nenhuma hora extra registrada.</div>';}['start','end','breakMinutes'].forEach(function(k){f.elements[k].oninput=function(){document.getElementById('v54-extra-total').textContent=hours().toFixed(1).replace('.',',')+'h';};});f.onsubmit=function(e){e.preventDefault();var h=hours();if(h<=0){toast('Informe horários válidos.','error');return;}var item=Object.fromEntries(new FormData(f));item.id='extra-'+Date.now();item.hours=h;item.by=currentUser().nome;db.overtime=db.overtime||[];db.overtime.push(item);saveDB(db);addLog('Hora extra registrada: '+item.name);f.reset();draw();toast('Hora extra registrada.','success');};draw();
    }
    function sanction(){renderSimpleRecords({key:"sanctions",title:"Sanções",singular:"sanção",prefix:"san4",fields:[{key:"name",label:"Colaborador",type:"user"},{key:"coordinator",label:"Coordenador aplicador",type:"user",value:function(){return currentUser().nome;}},{key:"date",label:"Data",type:"date"},{key:"type",label:"Tipo",type:"select",options:["Advertência verbal","Advertência escrita","Suspensão"]},{key:"days",label:"Dias de suspensão",type:"number",optional:true},{key:"witness",label:"Testemunha",type:"user",optional:true},{key:"reason",label:"Motivo",type:"textarea"}],summary:function(s){return fmtDateBR(s.date)+" · "+s.type+(s.days?' · '+s.days+' dia(s)':'');},validate:function(s){return s.type!=="Suspensão"||Number(s.days)>0?"":"Informe os dias de suspensão.";}});var form=document.getElementById('san4-form'),type=document.getElementById('san4-type'),days=document.getElementById('san4-days');if(type&&days){function sync(){days.closest('.fgroup').hidden=type.value!=='Suspensão';days.required=type.value==='Suspensão';if(!days.required)days.value='';}type.onchange=sync;sync();}}
    function renderSimpleRecords(cfg){
      function fieldsHTML(prefix,item){item=item||{};return userDatalist(prefix+"-users")+'<div class="form-grid two">'+cfg.fields.map(function(f){var val=item[f.key]!==undefined?item[f.key]:(f.value?f.value():"");var req=f.optional?"":" required";if(f.type==="textarea")return '<div class="fgroup span-all"><label>'+f.label+(f.optional?' (opcional)':' *')+'</label><textarea id="'+prefix+'-'+f.key+'"'+req+'>'+escapeHtml(val)+'</textarea></div>';if(f.type==="select")return '<div class="fgroup"><label>'+f.label+' *</label><select id="'+prefix+'-'+f.key+'"'+req+'>'+f.options.map(function(o){return '<option '+(o===val?'selected':'')+'>'+o+'</option>';}).join("")+'</select></div>';return '<div class="fgroup"><label>'+f.label+(f.optional?' (opcional)':' *')+'</label><input id="'+prefix+'-'+f.key+'" '+(f.type==="user"?'list="'+prefix+'-users"':('type="'+f.type+'"'))+' value="'+escapeHtml(val)+'"'+req+'></div>';}).join("")+'</div>';}
      root.innerHTML=nav()+'<div class="split-layout"><form class="section-card" id="'+cfg.prefix+'-form"><div class="section-title"><span class="eyebrow">NOVO REGISTRO</span><h2>Registrar '+cfg.singular+'</h2></div>'+fieldsHTML(cfg.prefix)+'<button class="btn btn-primary">Registrar</button></form><section class="section-card"><div class="bat-filterbar"><input id="'+cfg.prefix+'-search" placeholder="Pesquisar colaborador..."><input id="'+cfg.prefix+'-date" type="date"></div><div id="'+cfg.prefix+'-list" class="record-grid compact-records"></div></section></div>';wireNav();var arr=db[cfg.key],search=document.getElementById(cfg.prefix+"-search"),date=document.getElementById(cfg.prefix+"-date");search.oninput=draw;date.onchange=draw;
      function values(prefix){var out={};cfg.fields.forEach(function(f){out[f.key]=fieldValue(prefix+"-"+f.key);});return out;}
      document.getElementById(cfg.prefix+"-form").onsubmit=function(e){e.preventDefault();var data=values(cfg.prefix),error=cfg.validate?cfg.validate(data):"";if(error){toast(error,"error");return;}data.id=cfg.prefix+"-"+Date.now();data.by=currentUser().nome;data.at=Date.now();arr=db[cfg.key];arr.push(data);saveDB(db);addLog(cfg.title+" registrado: "+data.name);e.target.reset();draw();toast("Registro salvo.","success");};
      function recordDate(x){return x.date||x.start||"";}function draw(){arr=db[cfg.key];var q=search.value.toLowerCase();document.getElementById(cfg.prefix+"-list").innerHTML=arr.slice().reverse().filter(function(x){return (!date.value||recordDate(x)===date.value)&&(!q||[x.name,x.reason,x.type].join(" ").toLowerCase().includes(q));}).map(function(x){return '<button class="record-card record-card-button" data-simple-id="'+x.id+'"><h3>'+escapeHtml(x.name)+'</h3><p>'+escapeHtml(cfg.summary(x))+'</p><small>Visualizar ou editar →</small></button>';}).join("")||'<div class="empty-state">Nenhum registro encontrado.</div>';root.querySelectorAll("[data-simple-id]").forEach(function(b){b.onclick=function(){open(b.dataset.simpleId,false);};});}
      function open(id,edit){arr=db[cfg.key];var item=arr.find(function(x){return x.id===id;});if(!item)return;var detail='<div class="record-detail-grid">'+cfg.fields.map(function(f){return '<div class="'+(f.type==='textarea'?'span-all':'')+'"><span>'+f.label+'</span><b>'+escapeHtml(f.type==='date'?fmtDateBR(item[f.key]):(item[f.key]||"Não informado"))+'</b></div>';}).join("")+'</div><div class="actions-row"><button class="btn btn-secondary" data-simple-edit>Editar</button><button class="btn btn-danger" data-simple-delete>Excluir</button></div>';var editForm='<form id="simple-edit-form">'+fieldsHTML("simple-edit",item)+'<div class="actions-row"><button type="button" class="btn btn-secondary" data-eff-close>Cancelar</button><button class="btn btn-success">Salvar edição</button></div></form>';document.body.insertAdjacentHTML("beforeend",modalShell((edit?"Editar ":"Detalhes — ")+cfg.singular,edit?editForm:detail));document.querySelectorAll("[data-eff-close]").forEach(function(x){x.onclick=closeModal;});if(edit){if(cfg.key==="sanctions"){var editType=document.getElementById("simple-edit-type"),editDays=document.getElementById("simple-edit-days");function syncEditDays(){editDays.closest(".fgroup").hidden=editType.value!=="Suspensão";editDays.required=editType.value==="Suspensão";if(!editDays.required)editDays.value="";}editType.onchange=syncEditDays;syncEditDays();}document.getElementById("simple-edit-form").onsubmit=function(e){e.preventDefault();var data=values("simple-edit"),error=cfg.validate?cfg.validate(data):"";if(error){toast(error,"error");return;}var current=arr.find(function(x){return x.id===id;});Object.assign(current,data,{updatedBy:currentUser().nome,updatedAt:Date.now()});saveDB(db);addLog(cfg.title+" editado: "+current.name);closeModal();draw();toast("Edição salva.","success");};}else{document.querySelector("[data-simple-edit]").onclick=function(){closeModal();open(id,true);};document.querySelector("[data-simple-delete]").onclick=function(){if(confirm("Excluir este registro?")){db[cfg.key]=db[cfg.key].filter(function(x){return x.id!==id;});arr=db[cfg.key];saveDB(db);addLog(cfg.title+" excluído: "+item.name);closeModal();draw();}};}}
      draw();
    }
    function control(){CSRFlows.staff(root,nav,wireNav);}
    show(active);
  }

  function initRecordNotifications(){var watched={sinistros:{route:"sinistro",type:"sinistro",title:"Novo sinistro registrado"},operationalOccurrences:{route:"central-ocorrencias",type:"sistema",title:"Novo alerta registrado"},transfers:{route:"transferencia",type:"sistema",title:"Nova transferência registrada"},absences:{route:"efetivo",type:"sistema",title:"Nova falta registrada"},effectiveVacations:{route:"efetivo",type:"ferias",title:"Novas férias registradas"},sanctions:{route:"efetivo",type:"sistema",title:"Nova sanção registrada"}},counts={};Object.keys(watched).forEach(function(k){counts[k]=(db[k]||[]).length;});var original=saveDB;saveDB=function(next){var created=[];Object.keys(watched).forEach(function(k){var arr=next[k]||[];if(arr.length>counts[k])created.push({key:k,record:arr[arr.length-1],cfg:watched[k]});counts[k]=arr.length;});var result=original(next);created.forEach(function(item){var cfg=Object.assign({},item.cfg),record=item.record;if(item.key==="operationalOccurrences"&&record.kind==="Problema mecânico"){cfg.route="mecanicos";cfg.title="Novo problema mecânico";}var actor=currentUser();db.users.forEach(function(u){if(actor&&u.id===actor.id)return;var perms=userPerms(u);if(cfg.route==="central-ocorrencias"&&!perms.centralOcorrencias)return;if(cfg.route==="mecanicos"&&!perms.mecanicos)return;if(cfg.route==="sinistro"&&!perms.sinistro)return;if(cfg.route==="transferencia"&&!perms.transferencia)return;if(cfg.route==="efetivo"&&!perms.efetivo)return;addNotification(u.id,cfg.type,cfg.title,(actor?actor.nome:"Um usuário")+" adicionou um novo registro.",cfg.route,record.id);});});return result;};}
  initRecordNotifications();


  function renderOrganogramaV4(){
    var allUsers=db.users.slice();
    var clients=allUsers.filter(function(u){return u.cargo==="Cliente";});
    var hierarchyUsers=allUsers.filter(function(u){return u.cargo!=="Cliente";}).map(function(u){var copy=Object.assign({},u);copy.funcao=copy.cargo;return copy;});
    db.users=hierarchyUsers;
    try{renderOrganograma();}finally{db.users=allUsers;}
    var wrap=document.getElementById("org-admins-wrap");
    if(!wrap||!clients.length)return;
    var row=document.createElement("div");row.className="org-admin-strip";
    row.innerHTML='<b style="font-size:10px;text-transform:uppercase;color:var(--muted);align-self:center">Clientes sem gestor:</b>'+clients.map(function(u){return '<button class="org-admin-chip" data-org-client="'+u.id+'">'+userAvatarHTML(u,"user-photo-sm")+'<span>'+escapeHtml(u.nome)+'</span></button>';}).join("");
    wrap.appendChild(row);
    row.querySelectorAll("[data-org-client]").forEach(function(el){el.onclick=function(){var u=allUsers.find(function(x){return x.id===el.dataset.orgClient;});if(!u)return;document.getElementById("org-profile-body").innerHTML='<div class="profile-view"><div class="profile-view-side">'+userAvatarHTML(u,"profile-view-photo")+'<h3 style="margin:8px 0 3px">'+escapeHtml(u.nome)+'</h3><span class="badge">Cliente</span></div><div><div class="profile-view-grid">'+[["Usuário","@"+u.usuario],["Matrícula",u.matricula||"—"],["E-mail",u.email],["Função de acesso",u.funcao],["Cargo",u.cargo],["Base",u.unidade||"—"],["Gestor responsável","Não se aplica"],["Contratação",fmtDateBR(u.dataContratacao)]].map(function(x){return '<div class="profile-view-field"><span>'+x[0]+'</span><b>'+escapeHtml(x[1])+"</b></div>";}).join("")+"</div></div></div>";document.getElementById("org-profile-modal").classList.add("show");};});
  }

  var csrMobileMenu=document.getElementById("csr-mobile-menu");
  if(csrMobileMenu) csrMobileMenu.onclick=function(){var n=document.getElementById("workspace-nav");if(n)n.classList.toggle("mobile-open");};
  document.addEventListener("click",function(e){var n=document.getElementById("workspace-nav");if(window.innerWidth<=680&&n&&n.classList.contains("mobile-open")&&((e.target.closest&&e.target.closest("[data-side-page]"))||(!n.contains(e.target)&&e.target!==csrMobileMenu)))n.classList.remove("mobile-open");});

  /* ---------- utilitários ---------- */
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function fmtDateBR(value){
    if(!value)return "—";
    var parts=String(value).slice(0,10).split("-");
    return parts.length===3?parts[2]+"/"+parts[1]+"/"+parts[0]:String(value);
  }
  /* ---------- floating tools launcher ---------- */
  var toolsLauncher=document.getElementById("tools-launcher"),toolsMenu=document.getElementById("tools-menu"),aiFloatPanel=document.getElementById("ai-float-panel");
  function closeFloatingPanels(){document.getElementById("notes-panel").classList.remove("show");aiFloatPanel.classList.remove("show");toolsMenu.classList.remove("show");toolsLauncher.classList.remove("open");}
  toolsLauncher.addEventListener("click",function(){var opening=!toolsMenu.classList.contains("show");toolsMenu.classList.toggle("show",opening);toolsLauncher.classList.toggle("open",opening);});
  
  document.getElementById("tool-notes").addEventListener("click",function(){closeFloatingPanels();document.getElementById("notes-fab").click();});
  document.getElementById("tool-ai").addEventListener("click",function(){closeFloatingPanels();aiFloatPanel.classList.add("show");renderFloatingAI();});
  document.getElementById("ai-float-close").addEventListener("click",closeFloatingPanels);
  function renderFloatingAI(){var user=currentUser(),box=document.getElementById("ai-float-messages");if(!user)return;if(!db.aiConversations[user.id])db.aiConversations[user.id]=[];var msgs=db.aiConversations[user.id];box.innerHTML=msgs.length?msgs.slice(-30).map(function(m){return '<div class="ai-msg '+m.role+'">'+escapeHtml(m.text)+'<small>'+new Date(m.at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+'</small></div>';}).join(""):'<div class="ai-msg assistant">Olá! Explique a situação com placa, base, horário e o que já foi verificado.</div>';box.scrollTop=box.scrollHeight;}
  function sendFloatingAI(){var user=currentUser(),input=document.getElementById("ai-float-text"),text=input.value.trim();if(!user||!text)return;if(!db.aiConversations[user.id])db.aiConversations[user.id]=[];var msgs=db.aiConversations[user.id];msgs.push({role:"user",text:text,at:Date.now()});db.aiQueries.push({userId:user.id,userNome:user.nome,topic:"Consulta rápida",text:text,at:Date.now()});input.value="";var answer=CSRFlows.answer(text);msgs.push({role:"assistant",text:answer,at:Date.now()});saveDB(db);renderFloatingAI();}
  document.getElementById("ai-float-send").addEventListener("click",sendFloatingAI);document.getElementById("ai-float-text").addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendFloatingAI();}});

  /* ---------- floating notes ---------- */
  var notesPanel = document.getElementById("notes-panel");

  function fmtNoteDate(iso){
    if(!iso) return "—";
    var parts = iso.split("-");
    if(parts.length !== 3) return iso;
    return parts[2]+"/"+parts[1]+"/"+parts[0];
  }

  function drawFloatingNotes(){
    var user = currentUser();
    if(!user) return;
    var list = document.getElementById("fnotes-list");
    var mine = db.notesStructured.filter(function(n){ return n.userId === user.id; }).slice().reverse();
    if(!mine.length){
      list.innerHTML = '<div class="empty-state" style="padding:20px 4px;">Nenhuma anotação ainda.</div>';
      return;
    }
    list.innerHTML = "";
    mine.forEach(function(n){
      var div = document.createElement("div");
      div.className = "fnote-item";
      div.innerHTML =
        '<div class="fnote-top"><span>'+(n.placa||"—")+'</span><span>'+fmtNoteDate(n.data)+(n.hora?" "+n.hora:"")+'</span></div>'+
        '<div class="fnote-desc">'+(n.descricao||"—")+'</div>'+
        '<button data-del="'+n.id+'">Excluir</button>';
      list.appendChild(div);
    });
    list.querySelectorAll("[data-del]").forEach(function(b){
      b.addEventListener("click", function(){
        db.notesStructured = db.notesStructured.filter(function(x){ return x.id !== b.getAttribute("data-del"); });
        saveDB(db);
        drawFloatingNotes();
      });
    });
  }

  function openNotesPanel(){
    var user = currentUser();
    if(!user) return;
    document.getElementById("fnote-free-text").value = db.notesFree[user.id] || "";
    drawFloatingNotes();
    notesPanel.classList.add("show");
  }
  document.getElementById("notes-fab").addEventListener("click", function(){
    
    notesPanel.classList.toggle("show");
    if(notesPanel.classList.contains("show")){ openNotesPanel(); }
  });
  document.getElementById("notes-close").addEventListener("click", function(){
    notesPanel.classList.remove("show");
  });

  notesPanel.querySelectorAll("[data-notetab]").forEach(function(btn){
    btn.addEventListener("click", function(){
      notesPanel.querySelectorAll("[data-notetab]").forEach(function(b){ b.classList.remove("active"); });
      btn.classList.add("active");
      var tab = btn.getAttribute("data-notetab");
      document.getElementById("notetab-livre").style.display = tab === "livre" ? "block" : "none";
      document.getElementById("notetab-placa").style.display = tab === "placa" ? "block" : "none";
    });
  });

  var fnoteFreeTimer = null;
  document.getElementById("fnote-free-text").addEventListener("input", function(){
    var user = currentUser();
    if(!user) return;
    var val = this.value;
    clearTimeout(fnoteFreeTimer);
    fnoteFreeTimer = setTimeout(function(){
      db.notesFree[user.id] = val;
      saveDB(db);
    }, 500);
  });

  document.getElementById("fnote-add-btn").addEventListener("click", function(){
    var user = currentUser();
    if(!user) return;
    var placa = document.getElementById("fnote-placa").value.trim();
    var data = document.getElementById("fnote-data").value;
    var hora = document.getElementById("fnote-hora").value;
    var desc = document.getElementById("fnote-desc").value.trim();
    if(!placa && !desc){ toast("Preencha ao menos a placa ou a descrição.", "error"); return; }
    db.notesStructured.push({id:"nt-"+Date.now(), userId:user.id, placa:placa.toUpperCase(), data:data, hora:hora, descricao:desc});
    saveDB(db);
    document.getElementById("fnote-placa").value = "";
    document.getElementById("fnote-desc").value = "";
    toast("Anotação adicionada.", "success");
    drawFloatingNotes();
  });

  // Checklist: registro, edição completa e vencimento com aviso interno.
  function renderChecklist(){
    var root=document.getElementById('checklist-root'),tab=window.csrChecklistTab||'register';
    function expiry(c){return c.validade&&c.validade<todayISO();}
    function alertExpiry(){var user=currentUser(),changed=false;if(!user)return;db.checklists.forEach(function(c){if(expiry(c)&&!(c.expiryNotified||{})[user.id]){addNotification(user.id,'sistema','Checklist vencido','O checklist da placa '+c.placa+' venceu em '+fmtDateBR(c.validade)+'.','checklist',c.id);c.expiryNotified=c.expiryNotified||{};c.expiryNotified[user.id]=true;changed=true;}});if(changed){saveDB(db);refreshNotifBadge();}}
    function tabs(){return '<div class="v54-module-head"><div><small>OPERAÇÃO VEICULAR</small><h2>Checklist veicular</h2></div></div>';}
    function opts(value){var list=(db.tabSettings.tecnologias||[]),initial=['Sascar','Onixsat','Omnilink','Autotrac','Positron','Sighra','Ravex'];initial.forEach(function(v){if(!list.some(function(x){return x.toLowerCase()===v.toLowerCase();}))list.push(v);});return '<option value="">Selecione a tecnologia</option>'+list.map(function(v){return '<option value="'+escapeHtml(v)+'" '+(value&&value.toLowerCase()===v.toLowerCase()?'selected':'')+'>'+escapeHtml(v)+'</option>';}).join('');}
    function form(item){item=item||{};var edit=!!item.id;root.innerHTML=tabs()+'<section class="panel v54-form-panel"><div class="v54-section-head"><div><small>'+(edit?'EDITAR REGISTRO':'NOVO REGISTRO')+'</small><h3>'+(edit?'Editar checklist':'Registrar checklist')+'</h3><p>'+(edit?'Atualize os dados e salve as alterações.':'Preencha os dados da verificação veicular.')+'</p></div>'+(edit?'<button type="button" class="btn btn-secondary" id="v54-check-back">Voltar ao histórico</button>':'')+'</div><form id="v54-check-form"><div class="form-grid two"><div class="fgroup"><label>Placa *</label><input name="placa" required value="'+escapeHtml(item.placa||'')+'"></div><div class="fgroup"><label>Transportadora *</label><input name="transportadora" required value="'+escapeHtml(item.transportadora||'')+'"></div><div class="fgroup"><label>Data realizada *</label><input name="data" type="date" required value="'+escapeHtml(item.data||todayISO())+'"></div><div class="fgroup"><label>Horário realizado *</label><input name="hora" type="time" required value="'+escapeHtml(item.hora||new Date().toTimeString().slice(0,5))+'"></div><div class="fgroup"><label>Nome do condutor *</label><input name="condutor" required value="'+escapeHtml(item.condutor||'')+'"></div><div class="fgroup"><label>Número do condutor *</label><input name="numero" required value="'+escapeHtml(item.numero||'')+'"></div><div class="fgroup"><label>Tecnologia rastreador *</label><select name="tecnologia" required>'+opts(item.tecnologia)+'</select></div><div class="fgroup"><label>Validade do checklist *</label><input name="validade" type="date" required value="'+escapeHtml(item.validade||'')+'"></div><div class="fgroup"><label>Resultado *</label><select name="status"><option>Aprovado</option><option>Reprovado</option><option>Pendente</option></select></div><div class="fgroup span-all" id="v54-defects"><label>Defeitos / acessórios sem alerta *</label><div id="v54-defect-list"></div><button type="button" class="v55-add-defect" id="v54-add-defect" aria-label="Adicionar defeito" title="Adicionar outro defeito">+</button></div><div class="fgroup span-all"><label>Descrição *</label><textarea name="descricao" rows="3" required>'+escapeHtml(item.descricao||'')+'</textarea></div></div><div class="actions-row"><button class="btn btn-primary">'+(edit?'Salvar alterações':'Salvar checklist')+'</button></div></form></section>';
      var f=document.getElementById('v54-check-form'),status=f.elements.status,block=document.getElementById('v54-defects'),defects=document.getElementById('v54-defect-list');status.value=item.status||'Aprovado';
      function addDefect(value){var row=document.createElement('div');row.className='v54-defect-row';row.innerHTML='<input aria-label="Defeito identificado" placeholder="Descreva o defeito" value="'+escapeHtml(value||'')+'"><button type="button" aria-label="Remover defeito">×</button>';row.querySelector('button').onclick=function(){row.remove();if(!defects.children.length)addDefect();};defects.appendChild(row);}
      (item.defeitos||((item.defeito||'').split(';').filter(Boolean))).forEach(addDefect);if(!defects.children.length)addDefect();document.getElementById('v54-add-defect').onclick=function(){addDefect();};
      function sync(){block.hidden=status.value!=='Reprovado';defects.querySelectorAll('input').forEach(function(x){x.required=status.value==='Reprovado';});}status.onchange=sync;sync();
      if(edit)document.getElementById('v54-check-back').onclick=history;
      f.onsubmit=function(e){e.preventDefault();var values=Object.fromEntries(new FormData(f)),defectList=Array.from(defects.querySelectorAll('input')).map(function(x){return x.value.trim();}).filter(Boolean);if(values.status==='Reprovado'&&!defectList.length){toast('Informe pelo menos um defeito.','error');return;}if(values.validade<values.data){toast('A validade deve ser igual ou posterior à data realizada.','error');return;}values.defeitos=values.status==='Reprovado'?defectList:[];values.defeito=values.defeitos.join('; ');values.placa=values.placa.trim().toUpperCase();if(edit){Object.assign(item,values,{updatedAt:Date.now(),updatedBy:currentUser().nome});item.expiryNotified={};}else{Object.assign(values,{id:'check-'+Date.now(),by:currentUser().nome,createdAt:Date.now(),expiryNotified:{}});db.checklists.push(values);}saveDB(db);toast(edit?'Alterações salvas.':'Checklist salvo.','success');history();};
    }
    function history(){tab='history';window.csrChecklistTab=tab;root.innerHTML=tabs()+'<section class="panel"><div class="v54-section-head"><div><small>REGISTROS</small><h3>Histórico de checklist</h3></div><input id="v54-check-search" placeholder="Buscar placa, condutor ou transportadora"></div><div class="v54-table-wrap"><table class="users-table"><thead><tr><th>Data/hora</th><th>Placa</th><th>Transportadora</th><th>Condutor</th><th>Validade</th><th>Status</th><th>Ação</th></tr></thead><tbody id="v54-check-rows"></tbody></table></div></section>';var search=document.getElementById('v54-check-search');function draw(){var q=search.value.toLowerCase();document.getElementById('v54-check-rows').innerHTML=db.checklists.slice().reverse().filter(function(c){return !q||[c.placa,c.condutor,c.transportadora].join(' ').toLowerCase().includes(q);}).map(function(c){return '<tr><td>'+escapeHtml(c.data||'')+' '+escapeHtml(c.hora||'')+'</td><td><b>'+escapeHtml(c.placa)+'</b></td><td>'+escapeHtml(c.transportadora)+'</td><td>'+escapeHtml(c.condutor)+'</td><td>'+escapeHtml(c.validade?fmtDateBR(c.validade):'A informar')+'</td><td><span class="csr-status '+(expiry(c)?'danger':c.status==='Aprovado'?'success':c.status==='Reprovado'?'danger':'pending')+'">'+(expiry(c)?'Vencido':escapeHtml(c.status))+'</span></td><td><button class="btn btn-secondary btn-sm" data-check-edit="'+c.id+'">Editar</button></td></tr>';}).join('')||'<tr><td colspan="7" class="empty-state">Nenhum checklist registrado.</td></tr>';root.querySelectorAll('[data-check-edit]').forEach(function(b){b.onclick=function(){var c=db.checklists.find(function(x){return x.id===b.dataset.checkEdit;});if(c)form(c);};});}search.oninput=draw;draw();}
    function dashboard(){tab='dashboard';window.csrChecklistTab=tab;var all=db.checklists,approved=all.filter(function(c){return c.status==='Aprovado';}).length,rejected=all.filter(function(c){return c.status==='Reprovado';}).length,pending=all.filter(function(c){return c.status==='Pendente'||c.status==='Reagendado';}).length,carriers={},defects={};all.forEach(function(c){carriers[c.transportadora]=(carriers[c.transportadora]||0)+1;(c.defeitos||[c.defeito]).filter(Boolean).forEach(function(x){defects[x]=(defects[x]||0)+1;});});root.innerHTML=tabs()+'<div class="csr-check-kpis"><div><span>Realizados</span><b>'+all.length+'</b></div><div><span>Aprovados</span><b>'+approved+'</b></div><div><span>Reprovados</span><b>'+rejected+'</b></div><div><span>Agendados</span><b>'+pending+'</b></div></div><div class="csr-check-charts"><div class="panel"><h2>Resultados</h2><div class="csr-bars">'+[['Aprovados',approved],['Reprovados',rejected],['Reagendados / pendentes',pending]].map(function(x){return '<div><span>'+x[0]+'</span><i><b style="width:'+Math.round(x[1]/Math.max(all.length,1)*100)+'%"></b></i><strong>'+x[1]+'</strong></div>';}).join('')+'</div></div><div class="panel"><h2>Transportadoras mais registradas</h2>'+Object.entries(carriers).sort(function(a,b){return b[1]-a[1];}).slice(0,7).map(function(x){return '<div class="csr-stat-row"><span>'+escapeHtml(x[0])+'</span><b>'+x[1]+'</b></div>';}).join('')+'</div><div class="panel"><h2>Reprovações por defeito</h2>'+Object.entries(defects).sort(function(a,b){return b[1]-a[1];}).map(function(x){return '<div class="csr-stat-row"><span>'+escapeHtml(x[0])+'</span><b>'+x[1]+'</b></div>';}).join('')+'</div></div>';}
    alertExpiry();if(tab==='history')history();else if(tab==='dashboard')dashboard();else form();
  }

  var notifButton=document.getElementById('notif-button'),notifDrop=document.getElementById('notif-dropdown');
  if(notifButton&&notifDrop){notifButton.onclick=function(e){e.stopPropagation();renderNotifDropdown();notifDrop.classList.toggle('show');};document.getElementById('notif-close').onclick=function(){notifDrop.classList.remove('show');};document.getElementById('notif-read-all').onclick=async function(){var user=currentUser(),mine=(db.notifications||[]).filter(function(n){return user&&n.userId===user.id&&!n.read;});mine.forEach(function(n){n.read=true;});if(supabaseClient){var ids=mine.filter(function(n){return n.serverNotification;}).map(function(n){return n.id;});if(ids.length)await supabaseClient.from('user_notifications').update({read_at:new Date().toISOString()}).in('id',ids);}saveDB(db);refreshNotifBadge();renderNotifDropdown();};document.addEventListener('click',function(e){if(!e.target.closest('.v54-notif-wrap'))notifDrop.classList.remove('show');});}

  /* ---------- boot ---------- */
  bootSupabase();

})();



