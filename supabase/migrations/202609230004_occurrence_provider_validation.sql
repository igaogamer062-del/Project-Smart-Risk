-- SmartRisk | ocorrências avaliadas pelo sistema integrador
-- Aplicar depois de 003_alert_occurrence_flow.sql.

alter table public.tracking_alerts
  add column if not exists occurrence_submitted_at timestamptz,
  add column if not exists occurrence_submitted_by uuid references public.profiles(id),
  add column if not exists occurrence_validation_reason text,
  add column if not exists occurrence_validation_source text,
  add column if not exists redo_requested_at timestamptz,
  add column if not exists redo_requested_by uuid references public.profiles(id),
  add column if not exists redo_reason text;

create or replace function public.submit_tracking_occurrence(
  requested_alert uuid,
  occurrence_text text
)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  caller public.profiles%rowtype;
  target public.tracking_alerts%rowtype;
begin
  select * into caller from public.profiles where id=auth.uid() and active=true;
  select * into target from public.tracking_alerts where id=requested_alert for update;

  if caller.id is null or target.id is null then
    raise exception 'Alerta ou usuário inválido.';
  end if;
  if caller.access_role <> 'Operador' then
    raise exception 'Somente o operador responsável pode informar a ocorrência.';
  end if;
  if caller.base_id is distinct from target.base_id then
    raise exception 'Alerta fora da base do operador.';
  end if;
  if target.responsible_user_id is not null and target.responsible_user_id is distinct from caller.id then
    raise exception 'Este alerta está atribuído a outro operador.';
  end if;
  if target.status in ('TREATED','ARCHIVED','DISCARDED') then
    raise exception 'Este alerta já foi encerrado.';
  end if;
  if length(trim(coalesce(occurrence_text,''))) < 3 then
    raise exception 'Informe a referência ou um resumo da ocorrência registrada.';
  end if;

  update public.tracking_alerts
  set occurrence_check_status='PENDING',
      occurrence_summary=trim(occurrence_text),
      occurrence_submitted_at=now(),
      occurrence_submitted_by=caller.id,
      occurrence_validation_reason=null,
      occurrence_validation_source=null,
      contact_result=null,
      client_forward_at=null,
      responsible_user_id=caller.id,
      status='IN_TREATMENT',
      deadline_at=now()+interval '10 minutes',
      updated_at=now()
  where id=requested_alert;

  insert into public.tracking_alert_timeline(alert_id,actor_type,actor_id,actor_name,action,details)
  values(
    requested_alert,'USER',caller.id,caller.full_name,'Ocorrência registrada no sistema externo.',
    jsonb_build_object('summary',trim(occurrence_text),'validation_status','PENDING')
  );

  return requested_alert;
end $$;

create or replace function public.request_tracking_occurrence_redo(
  requested_alert uuid,
  redo_text text
)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  caller public.profiles%rowtype;
  target public.tracking_alerts%rowtype;
begin
  select * into caller from public.profiles where id=auth.uid() and active=true;
  select * into target from public.tracking_alerts where id=requested_alert for update;

  if caller.id is null or target.id is null then
    raise exception 'Alerta ou usuário inválido.';
  end if;
  if caller.access_role not in ('Lider','Supervisor','Coordenador','Gerente','Administrador') then
    raise exception 'Somente a liderança pode solicitar uma nova ocorrência.';
  end if;
  if target.occurrence_check_status <> 'INCORRECT' then
    raise exception 'A ocorrência não está marcada como incorreta pelo integrador.';
  end if;
  if length(trim(coalesce(redo_text,''))) < 3 then
    raise exception 'Informe o motivo da nova solicitação.';
  end if;

  update public.tracking_alerts
  set occurrence_check_status='PENDING',
      redo_requested_at=now(),
      redo_requested_by=caller.id,
      redo_reason=trim(redo_text),
      occurrence_validation_reason=null,
      occurrence_validation_source=null,
      contact_result=null,
      client_forward_at=null,
      status='IN_TREATMENT',
      deadline_at=now()+interval '10 minutes',
      updated_at=now()
  where id=requested_alert;

  insert into public.tracking_alert_timeline(alert_id,actor_type,actor_id,actor_name,action,details)
  values(
    requested_alert,'USER',caller.id,caller.full_name,'Nova ocorrência solicitada ao operador.',
    jsonb_build_object('reason',trim(redo_text),'operator_id',target.responsible_user_id)
  );

  insert into public.user_notifications(user_id,title,message,priority,alert_id)
  select p.id,'Refazer ocorrência',coalesce(target.plate,'Veículo')||': '||trim(redo_text),'URGENT',requested_alert
  from public.profiles p
  where p.id=target.responsible_user_id
    and p.active=true
    and p.access_role='Operador'
    and p.notifications_enabled=true
    and coalesce((p.notification_preferences->>'alertas')::boolean,true);

  return requested_alert;
end $$;

grant execute on function public.submit_tracking_occurrence(uuid,text) to authenticated;
grant execute on function public.request_tracking_occurrence_redo(uuid,text) to authenticated;

-- A função antiga permanece no banco apenas para compatibilidade com versões já
-- publicadas. A interface atual não permite que o usuário defina o resultado.
