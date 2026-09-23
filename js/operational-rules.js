(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.CSRRules=api;})(typeof window!=='undefined'?window:globalThis,function(){
  const roles=['Operador','Lider','Supervisor','Coordenador','Gerente','Administrador','Cliente'];
  function role(user){const value=user?.funcao||user?.cargo||'Operador';return value==='Líder'?'Lider':roles.includes(value)?value:'Operador';}
  function allTeams(user){return ['Coordenador','Gerente','Administrador'].includes(role(user));}
  function team(user,users){return (users||[]).filter(u=>u.active!==false&&(allTeams(user)||u.managerId===user.id));}
  function alertState(alert,rules,now=Date.now()){
    const rule=(rules||{})[alert.kind]||{},criticality=rule.criticality||'Normal';
    const success=alert.contact==='Sucesso';
    const eligible=!alert.linkedId&&(alert.contact==='Sucesso'?rule.success===true:alert.contact==='Sem sucesso'?rule.failure===true:false);
    const due=Number(alert.createdAt)+600000,open=!alert.status||alert.status==='Pendente';
    const near=open&&eligible&&Number.isFinite(due)&&now>=due-120000&&now<due;
    return {criticality,eligible,due,close:open&&eligible&&Number.isFinite(due)&&now>=due,color:!open?'closed':alert.linkedType==='sinistro'?'incident':alert.linkedType==='pronta'?'pronta':near?'warning':criticality==='Crítico'?(success?'critical-contact':'critical-no-contact'):'normal',label:!open?'Encerrado':alert.linkedType==='sinistro'?'Sinistro em atendimento':alert.linkedType==='pronta'?'Pronta resposta acionada':near?'Encerra em até 2 minutos':criticality+' · '+(alert.contact||'Contato não informado')};
  }
  function expire(alerts,rules,now=Date.now()){let count=0;for(const a of alerts||[]){const state=alertState(a,rules,now);if(!state.close)continue;a.status='Tratado';a.closedAt=state.due;a.closedBy='Sistema';a.history=a.history||[];a.history.push({at:now,by:'Sistema',from:'Pendente',to:'Tratado',note:'Encerramento automático após 10 minutos: '+a.contact});count++;}return count;}
  function staffText(record){const ops=record.operators||[],absences=record.absences||[],required=Number(record.required)||11;return 'Supervisor: '+(record.supervisor||record.coordinator||'')+'\nLíder: '+(record.leader||record.analyst||'')+'\n'+ops.map(o=>o.base+': '+o.name).join('\n')+'\nFaltas: '+String(absences.length).padStart(2,'0')+(absences.length?' ('+absences.join(', ')+')':'')+'\nFérias: '+((record.vacationNames||[]).join(', ')||'Nenhuma')+'\nHora extra: '+((record.extras||[]).map(x=>x.name+' ('+x.start+'–'+x.end+')').join(', ')||'Nenhuma')+'\nApoio: '+(record.support||'')+'\n\nCompleto: '+(ops.length>=required?'Sim':'Não — faltam '+(required-ops.length)+' pessoa(s)');}
  return {roles,role,allTeams,team,alertState,expire,staffText};
});
