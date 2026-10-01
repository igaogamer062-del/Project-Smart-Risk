-- SmartRisk | fluxo operacional de alertas e persistência dos módulos operacionais
-- Aplicar depois de 202609290002_staff_control_edit_fix.sql.

create table if not exists public.operational_module_records (
  module_key text not null,
  record_id text not null,
  payload jsonb not null,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(module_key,record_id),
  check(module_key in ('overtime','early_departures','effective_vacations','sanctions','sinistros','pronta_resposta'))
);

create index if not exists operational_module_records_module_updated_idx
  on public.operational_module_records(module_key,updated_at desc);

insert into public.operational_module_records(module_key,record_id,payload,created_by,updated_by,created_at,updated_at)
select record.module_key,record.record_id,record.payload,record.created_by,record.updated_by,record.created_at,record.updated_at
from public.nova_gr_records record
where record.module_key in ('overtime','early_departures','effective_vacations','sanctions','sinistros','pronta_resposta')
on conflict(module_key,record_id) do update
set payload=excluded.payload,updated_by=excluded.updated_by,updated_at=greatest(operational_module_records.updated_at,excluded.updated_at);

alter table public.operational_module_records enable row level security;
drop policy if exists "operations read operational records" on public.operational_module_records;
create policy "operations read operational records" on public.operational_module_records for select to authenticated
using(public.current_profile_role()<>'Cliente');

create or replace function public.replace_operational_module(requested_module text,records jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare
  caller public.profiles%rowtype;
  item jsonb;
  ids text[] := array[]::text[];
  saved integer := 0;
begin
  select * into caller from public.profiles where id=auth.uid() and active=true;
  if caller.id is null or caller.access_role='Cliente' then raise exception 'Usuário sem acesso aos registros operacionais.'; end if;
  if requested_module not in ('overtime','early_departures','effective_vacations','sanctions','sinistros','pronta_resposta') then
    raise exception 'Módulo operacional inválido.';
  end if;
  if jsonb_typeof(coalesce(records,'[]'::jsonb))<>'array' then raise exception 'A lista de registros é inválida.'; end if;

  for item in select value from jsonb_array_elements(coalesce(records,'[]'::jsonb))
  loop
    if nullif(trim(item->>'id'),'') is null then raise exception 'Todo registro deve possuir identificador.'; end if;
    ids := array_append(ids,item->>'id');
    insert into public.operational_module_records(module_key,record_id,payload,created_by,updated_by)
    values(requested_module,item->>'id',item,caller.id,caller.id)
    on conflict(module_key,record_id) do update
      set payload=excluded.payload,updated_by=caller.id,updated_at=now();
    saved := saved+1;
  end loop;

  if cardinality(ids)=0 then
    delete from public.operational_module_records where module_key=requested_module;
  else
    delete from public.operational_module_records where module_key=requested_module and not(record_id=any(ids));
  end if;
  return saved;
end $$;

grant execute on function public.replace_operational_module(text,jsonb) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.operational_module_records;
exception when duplicate_object then null; end $$;

alter table public.tracking_alerts
  add column if not exists initial_check_at timestamptz,
  add column if not exists workflow_stage text not null default 'WAITING_INITIAL_CHECK',
  add column if not exists occurrence_received_at timestamptz,
  add column if not exists occurrence_ai_result jsonb,
  add column if not exists occurrence_ai_available boolean;

update public.tracking_alerts
set initial_check_at=coalesce(initial_check_at,created_at+interval '5 minutes'),
    workflow_stage=case
      when status='ARCHIVED' then 'ARCHIVED'
      when status='TREATED' then 'OBSERVATION'
      when status='WAITING_CLIENT' then 'WAITING_CLIENT'
      when status='CLIENT_RESPONDED' then 'MANAGEMENT_DECISION'
      when occurrence_check_status in ('CORRECT','INCORRECT') then 'OCCURRENCE_READY'
      else 'WAITING_INITIAL_CHECK'
    end
where initial_check_at is null or workflow_stage='WAITING_INITIAL_CHECK';

create index if not exists tracking_alerts_initial_check_idx on public.tracking_alerts(workflow_stage,initial_check_at);

create or replace function public.bulk_close_tracking_alerts(closing_reason text)
returns integer language plpgsql security definer set search_path=public as $$
declare caller public.profiles%rowtype; affected integer := 0;
begin
  select * into caller from public.profiles where id=auth.uid() and active=true;
  if caller.id is null then raise exception 'Usuário inválido ou inativo.'; end if;
  if caller.access_role not in ('Supervisor','Coordenador','Gerente','Administrador') then
    raise exception 'Somente Supervisor, Coordenador, Gerente ou Administrador pode encerrar todos os alertas.';
  end if;
  if length(trim(coalesce(closing_reason,'')))<10 then raise exception 'Informe uma justificativa com pelo menos 10 caracteres.'; end if;

  with closed_alerts as (
    update public.tracking_alerts
    set status='ARCHIVED',workflow_stage='ARCHIVED',treatment_description='Encerramento em massa: '||trim(closing_reason),
        treated_by=caller.id,treated_at=now(),visible_until=now(),updated_at=now()
    where status in ('PENDING_TREATMENT','IN_TREATMENT','WAITING_CLIENT','CLIENT_RESPONDED','TREATED')
    returning id
  ), timeline_entries as (
    insert into public.tracking_alert_timeline(alert_id,actor_type,actor_id,actor_name,action,details)
    select id,'USER',caller.id,caller.full_name,'Alerta encerrado imediatamente em ação coletiva.',jsonb_build_object('reason',trim(closing_reason),'sent_directly_to_history',true)
    from closed_alerts returning 1
  ) select count(*) into affected from timeline_entries;

  insert into public.tracking_audit_logs(actor_type,actor_id,component,action,entity_type,metadata)
  values('USER',caller.id,'AlertWorkflowService','Encerramento coletivo imediato de alertas.','tracking_alert',jsonb_build_object('reason',trim(closing_reason),'closed_count',affected));
  return affected;
end $$;

create or replace function public.treat_tracking_alert(requested_alert uuid,treatment_text text)
returns uuid language plpgsql security definer set search_path=public as $$
declare caller public.profiles%rowtype; target public.tracking_alerts%rowtype;
begin
  select * into caller from public.profiles where id=auth.uid() and active=true;
  select * into target from public.tracking_alerts where id=requested_alert for update;
  if caller.id is null or target.id is null then raise exception 'Alerta ou usuário inválido.'; end if;
  if caller.access_role not in ('Lider','Supervisor','Coordenador','Gerente','Administrador') then raise exception 'A decisão final pertence à liderança.'; end if;
  if length(trim(coalesce(treatment_text,'')))<3 then raise exception 'Descreva o tratamento realizado.'; end if;
  update public.tracking_alerts set status='TREATED',workflow_stage='OBSERVATION',treatment_description=trim(treatment_text),treated_by=caller.id,
    treated_at=now(),visible_until=now()+interval '10 minutes',updated_at=now() where id=requested_alert;
  insert into public.tracking_alert_timeline(alert_id,actor_type,actor_id,actor_name,action,details)
  values(requested_alert,'USER',caller.id,caller.full_name,'Alerta tratado pela liderança.',jsonb_build_object('treatment',trim(treatment_text),'observation_minutes',10));
  return requested_alert;
end $$;

create or replace function public.tracking_workflow_tick()
returns jsonb language plpgsql security definer set search_path=public as $$
declare activated integer:=0; successful integer:=0; forwarded integer:=0; incorrect integer:=0; timed_out integer:=0; escalated integer:=0; archived integer:=0;
begin
  update public.tracking_alerts set workflow_stage='WAITING_OCCURRENCE',deadline_at=initial_check_at+interval '1 hour',updated_at=now()
  where workflow_stage='WAITING_INITIAL_CHECK' and initial_check_at<=now() and occurrence_check_status='PENDING';
  get diagnostics activated=row_count;

  update public.tracking_alerts set status='TREATED',
    workflow_stage=case when client_requested_at is not null then 'CLIENT_SUCCESS_OBSERVATION' else 'OBSERVATION' end,
    treated_at=now(),visible_until=now()+interval '10 minutes',updated_at=now()
  where workflow_stage in ('WAITING_INITIAL_CHECK','OCCURRENCE_READY') and initial_check_at<=now()
    and occurrence_check_status='CORRECT' and contact_result='SUCCESS';
  get diagnostics successful=row_count;

  with moved as (
    update public.tracking_alerts set status='WAITING_CLIENT',workflow_stage='WAITING_CLIENT',client_requested_at=now(),
      client_forward_at=null,deadline_at=now()+interval '1 hour',updated_at=now()
    where workflow_stage in ('WAITING_INITIAL_CHECK','OCCURRENCE_READY') and initial_check_at<=now()
      and occurrence_check_status='CORRECT' and contact_result='NO_SUCCESS' and transporter_id is not null
    returning id,plate,transporter_id,occurrence_summary
  ), timeline as (
    insert into public.tracking_alert_timeline(alert_id,actor_type,actor_name,action,details)
    select id,'SYSTEM','AlertWorkflowService','Ocorrência correta sem contato; retorno solicitado à transportadora.',jsonb_build_object('situation',occurrence_summary)
    from moved returning alert_id
  ), notifications as (
    insert into public.user_notifications(user_id,title,message,priority,alert_id)
    select p.id,'Retorno solicitado',coalesce(m.plate,'Veículo')||': informe a situação atual.','HIGH',m.id
    from moved m join public.profiles p on p.transporter_id=m.transporter_id
    where p.active=true and p.access_role='Cliente' and p.notifications_enabled=true and coalesce((p.notification_preferences->>'alertas')::boolean,true)
    returning alert_id
  ) select count(*) into forwarded from moved;

  with wrong as (
    update public.tracking_alerts set status='PENDING_TREATMENT',workflow_stage='REDO_REQUIRED',deadline_at=now()+interval '1 hour',updated_at=now()
    where workflow_stage in ('WAITING_INITIAL_CHECK','OCCURRENCE_READY') and initial_check_at<=now() and occurrence_check_status='INCORRECT'
    returning id,plate,base_id
  ), notifications as (
    insert into public.user_notifications(user_id,title,message,priority,alert_id)
    select p.id,'Ocorrência precisa ser refeita',coalesce(w.plate,'Veículo')||': a ocorrência foi classificada como incorreta.','URGENT',w.id
    from wrong w join public.profiles p on p.base_id=w.base_id
    where p.active=true and p.access_role='Operador' and p.notifications_enabled=true and coalesce((p.notification_preferences->>'alertas')::boolean,true)
    returning alert_id
  ) select count(*) into incorrect from wrong;

  with expired as (
    update public.tracking_alerts set status='WAITING_CLIENT',workflow_stage='WAITING_CLIENT',occurrence_summary='Realizada tentativa de contato com o condutor sem sucesso.',
      client_requested_at=now(),deadline_at=now()+interval '1 hour',updated_at=now()
    where workflow_stage in ('WAITING_OCCURRENCE','REDO_REQUIRED') and deadline_at<=now() and occurrence_check_status in ('PENDING','INCORRECT') and transporter_id is not null
    returning id,plate,transporter_id
  ), notifications as (
    insert into public.user_notifications(user_id,title,message,priority,alert_id)
    select p.id,'Retorno solicitado',coalesce(e.plate,'Veículo')||': tentativa de contato sem sucesso.','HIGH',e.id
    from expired e join public.profiles p on p.transporter_id=e.transporter_id
    where p.active=true and p.access_role='Cliente' and p.notifications_enabled=true and coalesce((p.notification_preferences->>'alertas')::boolean,true)
    returning alert_id
  ) select count(*) into timed_out from expired;

  update public.tracking_alerts set escalation_level=escalation_level+1,last_escalated_at=now(),deadline_at=now()+interval '1 hour',updated_at=now()
  where status in ('WAITING_CLIENT','CLIENT_RESPONDED','IN_TREATMENT') and deadline_at<=now();
  get diagnostics escalated=row_count;

  update public.tracking_alerts set status='CLIENT_RESPONDED',workflow_stage='MANAGEMENT_DECISION',visible_until=null,deadline_at=now()+interval '1 hour',updated_at=now()
  where status='TREATED' and workflow_stage='CLIENT_SUCCESS_OBSERVATION' and visible_until<=now();

  update public.tracking_alerts set status='ARCHIVED',workflow_stage='ARCHIVED',updated_at=now()
  where status='TREATED' and workflow_stage='OBSERVATION' and visible_until<=now();
  get diagnostics archived=row_count;

  return jsonb_build_object('activated_after_initial_window',activated,'successful_occurrences',successful,'forwarded_to_client',forwarded,
    'redo_required',incorrect,'forwarded_after_timeout',timed_out,'escalated',escalated,'archived',archived,'ran_at',now());
end $$;

grant execute on function public.bulk_close_tracking_alerts(text) to authenticated;
grant execute on function public.treat_tracking_alert(uuid,text) to authenticated;
