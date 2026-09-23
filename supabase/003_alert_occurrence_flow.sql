-- SmartRisk | validação da ocorrência e encaminhamento automático à transportadora
-- Aplicar depois de 001_smart_risk_setup.sql.

alter table public.tracking_alerts
  add column if not exists occurrence_check_status text not null default 'PENDING',
  add column if not exists contact_result text,
  add column if not exists occurrence_checked_at timestamptz,
  add column if not exists occurrence_checked_by uuid references public.profiles(id),
  add column if not exists client_forward_at timestamptz;

do $$ begin
  alter table public.tracking_alerts
    add constraint tracking_alerts_occurrence_check_status_check
    check (occurrence_check_status in ('PENDING','INCORRECT','CORRECT'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.tracking_alerts
    add constraint tracking_alerts_contact_result_check
    check (contact_result is null or contact_result in ('SUCCESS','NO_SUCCESS'));
exception when duplicate_object then null; end $$;

create index if not exists tracking_alerts_client_forward_idx
  on public.tracking_alerts(status,client_forward_at)
  where client_forward_at is not null;

create or replace function public.register_tracking_occurrence_result(
  requested_alert uuid,
  result_is_correct boolean,
  contact_value text,
  occurrence_text text
)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  caller public.profiles%rowtype;
  target public.tracking_alerts%rowtype;
  normalized_contact text;
  result_label text;
begin
  select * into caller from public.profiles where id=auth.uid() and active=true;
  select * into target from public.tracking_alerts where id=requested_alert for update;

  if caller.id is null or target.id is null then
    raise exception 'Alerta ou usuário inválido.';
  end if;
  if caller.access_role='Cliente' then
    raise exception 'O perfil Cliente não registra ocorrências operacionais.';
  end if;
  if caller.access_role='Operador' and caller.base_id is distinct from target.base_id then
    raise exception 'Alerta fora da base do operador.';
  end if;
  if target.status in ('TREATED','ARCHIVED','DISCARDED') then
    raise exception 'Este alerta já foi encerrado.';
  end if;
  if length(trim(coalesce(occurrence_text,'')))<3 then
    raise exception 'Descreva a ocorrência verificada.';
  end if;

  normalized_contact := upper(trim(coalesce(contact_value,'')));
  if normalized_contact not in ('SUCCESS','NO_SUCCESS') then
    raise exception 'Informe se o contato teve sucesso ou não.';
  end if;
  result_label := case when result_is_correct then 'Tratativa correta' else 'Tratativa incorreta' end;

  update public.tracking_alerts
  set occurrence_check_status=case when result_is_correct then 'CORRECT' else 'INCORRECT' end,
      contact_result=normalized_contact,
      occurrence_summary=trim(occurrence_text),
      occurrence_checked_at=now(),
      occurrence_checked_by=caller.id,
      responsible_user_id=caller.id,
      status=case when result_is_correct then 'IN_TREATMENT' else 'PENDING_TREATMENT' end,
      client_forward_at=case
        when result_is_correct and normalized_contact='NO_SUCCESS' and transporter_id is not null
        then now()+interval '1 minute'
        else null
      end,
      deadline_at=case
        when result_is_correct then now()+interval '1 hour'
        else now()+interval '10 minutes'
      end,
      updated_at=now()
  where id=requested_alert;

  insert into public.tracking_alert_timeline(alert_id,actor_type,actor_id,actor_name,action,details)
  values(
    requested_alert,'USER',caller.id,caller.full_name,result_label,
    jsonb_build_object(
      'result',case when result_is_correct then 'CORRECT' else 'INCORRECT' end,
      'contact',normalized_contact,
      'summary',trim(occurrence_text),
      'client_forward_at',case when result_is_correct and normalized_contact='NO_SUCCESS' then now()+interval '1 minute' else null end
    )
  );

  insert into public.user_notifications(user_id,title,message,priority,alert_id)
  select p.id,result_label,coalesce(target.plate,'Veículo')||': '||trim(occurrence_text),
    case when result_is_correct then 'HIGH' else 'URGENT' end,requested_alert
  from public.profiles p
  where p.active=true
    and p.access_role in ('Lider','Supervisor','Coordenador','Gerente','Administrador')
    and p.notifications_enabled=true
    and coalesce((p.notification_preferences->>'alertas')::boolean,true);

  return requested_alert;
end $$;

create or replace function public.tracking_workflow_tick()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  forwarded integer;
  escalated integer;
  archived integer;
begin
  with moved as (
    update public.tracking_alerts
    set status='WAITING_CLIENT',
        client_requested_at=now(),
        deadline_at=now()+interval '1 hour',
        updated_at=now()
    where status='IN_TREATMENT'
      and occurrence_check_status='CORRECT'
      and contact_result='NO_SUCCESS'
      and transporter_id is not null
      and client_forward_at is not null
      and client_forward_at<=now()
    returning id,plate,transporter_id,occurrence_summary
  ),
  timeline as (
    insert into public.tracking_alert_timeline(alert_id,actor_type,actor_name,action,details)
    select id,'SYSTEM','AlertWorkflowService','Alerta encaminhado automaticamente à transportadora.',
      jsonb_build_object('situation',occurrence_summary,'reason','Contato sem sucesso')
    from moved
    returning alert_id
  ),
  notifications as (
    insert into public.user_notifications(user_id,title,message,priority,alert_id)
    select p.id,'Retorno solicitado',coalesce(m.plate,'Veículo')||': a operação aguarda sua resposta.','HIGH',m.id
    from moved m
    join public.profiles p on p.transporter_id=m.transporter_id
    where p.active=true
      and p.access_role='Cliente'
      and p.notifications_enabled=true
      and coalesce((p.notification_preferences->>'alertas')::boolean,true)
    returning alert_id
  )
  select count(*) into forwarded from moved;

  update public.tracking_alerts
  set escalation_level=escalation_level+1,
      last_escalated_at=now(),
      deadline_at=now()+interval '1 hour',
      updated_at=now()
  where status in ('PENDING_TREATMENT','WAITING_CLIENT','CLIENT_RESPONDED','IN_TREATMENT')
    and deadline_at<=now();
  get diagnostics escalated=row_count;

  insert into public.tracking_alert_timeline(alert_id,actor_type,actor_name,action,details)
  select id,'SYSTEM','AlertWorkflowService','Alerta escalado automaticamente por ausência de resposta.',
    jsonb_build_object('level',escalation_level)
  from public.tracking_alerts
  where last_escalated_at>=now()-interval '1 minute';

  insert into public.user_notifications(user_id,title,message,priority,alert_id)
  select p.id,'Alerta escalado',coalesce(a.plate,'Veículo')||': prazo de tratamento excedido.','URGENT',a.id
  from public.tracking_alerts a
  cross join public.profiles p
  where a.last_escalated_at>=now()-interval '1 minute'
    and p.active=true
    and p.access_role in ('Lider','Supervisor','Coordenador','Gerente','Administrador')
    and p.notifications_enabled=true
    and coalesce((p.notification_preferences->>'alertas')::boolean,true);

  update public.tracking_alerts
  set status='ARCHIVED',updated_at=now()
  where status='TREATED' and visible_until<=now();
  get diagnostics archived=row_count;

  return jsonb_build_object(
    'forwarded_to_client',forwarded,
    'escalated',escalated,
    'archived',archived,
    'ran_at',now()
  );
end $$;

grant execute on function public.register_tracking_occurrence_result(uuid,boolean,text,text) to authenticated;

-- Executa o workflow no servidor. Se pg_cron não estiver disponível, a função
-- tracking_workflow_tick continua pronta para ser agendada pelo painel do Supabase.
do $$ begin
  create extension if not exists pg_cron with schema extensions;
  if not exists (select 1 from cron.job where jobname='smart-risk-tracking-workflow') then
    perform cron.schedule(
      'smart-risk-tracking-workflow',
      '* * * * *',
      'select public.tracking_workflow_tick();'
    );
  end if;
exception when others then
  raise notice 'Agendamento automático não criado: %. Configure tracking_workflow_tick a cada minuto no Supabase Cron.', sqlerrm;
end $$;

