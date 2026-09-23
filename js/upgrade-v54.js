(function(){
  'use strict';
  // Complementos visuais e operacionais. A autenticação e a tela de login permanecem intactas.
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function setup(){
    var root=document.getElementById('app-screen');if(!root||root.style.display==='none')return;
    var nav=document.getElementById('workspace-nav');
    if(nav&&!nav.dataset.v54){nav.dataset.v54='1';nav.addEventListener('mouseleave',function(){nav.querySelectorAll('.csr-nav-group.open').forEach(function(x){x.classList.remove('open');});nav.querySelectorAll('button').forEach(function(x){x.blur();});});}
    var manual=document.getElementById('ai-tab-manuals');
    if(manual&&!manual.dataset.v54){manual.dataset.v54='1';renderManuals(manual);}
  }
  function renderManuals(host){
    var source=window.TECH_MANUALS;if(!source||!source.items)return;
    host.innerHTML='<div class="v54-heading"><div><small>BIBLIOTECA OPERACIONAL</small><h2>Manuais de tecnologias</h2><p>Procedimentos cadastrados para consulta durante o plantão.</p></div></div><div class="v54-manual-grid">'+source.order.map(function(key){var m=source.items[key];return m?'<button type="button" class="v54-manual-card" data-manual="'+esc(key)+'"><strong>'+esc(m.title)+'</strong><span>'+esc(m.description)+'</span><small>Abrir manual →</small></button>':'';}).join('')+'</div><div id="v54-manual-content"></div>';
    function show(key){var m=source.items[key],body=document.getElementById('v54-manual-content');if(!m)return;var contents=m.children?'<div class="v54-manual-grid">'+m.children.map(function(child){var x=source.items[child];return x?'<button type="button" class="v54-manual-card" data-manual-child="'+esc(child)+'"><strong>'+esc(x.title)+'</strong><span>'+esc(x.description||'')+'</span><small>Abrir procedimento →</small></button>':'';}).join('')+'</div>':(m.content||[]).map(function(part){return part.type==='image'?'<img loading="lazy" src="'+esc(part.src)+'" alt="Ilustração do manual '+esc(m.title)+'">':part.type==='text'?'<p>'+esc(part.text).replace(/\n/g,'<br>')+'</p>':'';}).join('');body.innerHTML='<div class="v54-manual-detail"><div class="v54-heading"><div><small>MANUAL</small><h2>'+esc(m.title)+'</h2></div><button class="btn btn-secondary" id="v54-manual-close">Fechar</button></div>'+contents+'</div>';body.scrollIntoView({block:'start',behavior:'smooth'});document.getElementById('v54-manual-close').onclick=function(){body.innerHTML='';};body.querySelectorAll('[data-manual-child]').forEach(function(button){button.onclick=function(){show(button.dataset.manualChild);};});}
    host.querySelectorAll('[data-manual]').forEach(function(button){button.onclick=function(){show(button.dataset.manual);};});
  }
  window.initTechnologyManuals=function(host){renderManuals(host);};
  // O observador mantém os manuais e a gaveta em estado correto após a navegação SPA.
  var timer;new MutationObserver(function(){clearTimeout(timer);timer=setTimeout(setup,30);}).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',setup);
})();
