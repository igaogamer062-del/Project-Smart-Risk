-- SmartRisk | continuidade da tratativa definida pela gestão

create table if not exists public.tracking_alert_actions (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.tracking_alerts(id) on delete cascade,
  action_type text not null check(action_type in ('PRONTA_RESPOSTA','SINISTRO','POLICE')),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.tracking_alert_actions enable row level security;
drop policy if exists "operations read tracking actions" on public.tracking_alert_actions;
create policy "operations read tracking actions" on public.tracking_alert_actions for select to authenticated
using(public.current_profile_role()<>'Cliente');

create or replace function public.continue_tracking_alert(requested_alert uuid,requested_action text,action_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare caller public.profiles%rowtype; target public.tracking_alerts%rowtype; action_id uuid; module_name text; record_id text; transporter_name text; operational_payload jsonb;
begin
  select * into caller from public.profiles where id=auth.uid() and active=true;
  select * into target from public.tracking_alerts where id=requested_alert for update;
  if caller.id is null or target.id is null then raise exception 'Alerta ou usuário inválido.'; end if;
  if caller.access_role not in ('Lider','Supervisor','Coordenador','Gerente','Administrador') then raise exception 'Somente a liderança pode definir a continuidade.'; end if;
  if requested_action not in ('PRONTA_RESPOSTA','SINISTRO','POLICE') then raise exception 'Tipo de continuidade inválido.'; end if;
  if length(trim(coalesce(action_payload->>'description','')))<3 then raise exception 'Descreva a continuidade da tratativa.'; end if;
  select name into transporter_name from public.transporters where id=target.transporter_id;
  insert into public.tracking_alert_actions(alert_id,action_type,payload,created_by)
  values(requested_alert,requested_action,action_payload,caller.id) returning id into action_id;

  if requested_action='PRONTA_RESPOSTA' then
    module_name:='pronta_resposta'; record_id:='pr-'||action_id::text;
    operational_payload:=action_payload||jsonb_build_object('id',record_id,'alertId',requested_alert::text,'cavalo',target.plate,'motorista',target.driver_name,
      'transportadora',transporter_name,'pronta',action_payload->>'team','prontaResposta',action_payload->>'team','motivo',action_payload->>'description',
      'obs',action_payload->>'description','data',coalesce(action_payload->>'date',(now() at time zone 'America/Sao_Paulo')::date::text),
      'horario',coalesce(action_payload->>'time',to_char(now() at time zone 'America/Sao_Paulo','HH24:MI')),'status',coalesce(action_payload->>'status','Em deslocamento'));
  elsif requested_action='SINISTRO' then
    module_name:='sinistros'; record_id:='sin-'||action_id::text;
    operational_payload:=action_payload||jsonb_build_object('id',record_id,'alertId',requested_alert::text,'placa',target.plate,'cavalo',target.plate,
      'motorista',target.driver_name,'transportadora',transporter_name,'description',action_payload->>'description','relato',action_payload->>'description',
      'data',coalesce(action_payload->>'date',(now() at time zone 'America/Sao_Paulo')::date::text),'horario',coalesce(action_payload->>'time',to_char(now() at time zone 'America/Sao_Paulo','HH24:MI')),
      'status','Aberto','situacao',coalesce(action_payload->>'nature','Em análise'));
  end if;
  if module_name is not null then
    insert into public.operational_module_records(module_key,record_id,payload,created_by,updated_by)
    values(module_name,record_id,operational_payload,caller.id,caller.id)
    on conflict(module_key,record_id) do update set payload=excluded.payload,updated_by=caller.id,updated_at=now();
  end if;
  update public.tracking_alerts set status='IN_TREATMENT',workflow_stage=case requested_action when 'PRONTA_RESPOSTA' then 'PRONTA_RESPONSE_ACTIVE' when 'SINISTRO' then 'INCIDENT_ACTIVE' else 'POLICE_ACTION_ACTIVE' end,
    deadline_at=now()+interval '10 years',updated_at=now() where id=requested_alert;
  insert into public.tracking_alert_timeline(alert_id,actor_type,actor_id,actor_name,action,details)
  values(requested_alert,'USER',caller.id,caller.full_name,'Continuidade definida: '||requested_action,action_payload||jsonb_build_object('action_id',action_id));
  return action_id;
end $$;

grant execute on function public.continue_tracking_alert(uuid,text,jsonb) to authenticated;

do $$ begin alter publication supabase_realtime add table public.tracking_alert_actions; exception when duplicate_object then null; end $$;
