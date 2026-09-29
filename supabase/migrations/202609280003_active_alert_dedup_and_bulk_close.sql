-- SmartRisk | um alerta ativo por veículo/tipo e encerramento em massa auditado
-- Aplicar depois de 008_lovable_provider_polling.sql.

with ranked as (
  select id,
         row_number() over (
           partition by upper(btrim(plate)), alert_type
           order by created_at, id
         ) as position
  from public.tracking_alerts
  where status in ('PENDING_TREATMENT','IN_TREATMENT','WAITING_CLIENT','CLIENT_RESPONDED')
    and nullif(btrim(plate),'') is not null
), closed_duplicates as (
  update public.tracking_alerts alert
  set status='DISCARDED',
      treatment_description=concat_ws(E'\n',nullif(alert.treatment_description,''),'Encerrado automaticamente ao ativar a regra de alerta único por veículo e tipo.'),
      treated_at=now(),
      visible_until=now(),
      updated_at=now()
  from ranked
  where ranked.id=alert.id and ranked.position>1
  returning alert.id
)
insert into public.tracking_alert_timeline(alert_id,actor_type,actor_name,action,details)
select id,'SYSTEM','AlertWorkflowService','Alerta duplicado ativo encerrado durante a atualização da regra.',jsonb_build_object('reason','ACTIVE_VEHICLE_ALERT_DEDUP')
from closed_duplicates;

create unique index if not exists tracking_alerts_one_active_vehicle_type_idx
  on public.tracking_alerts(upper(btrim(plate)),alert_type)
  where status in ('PENDING_TREATMENT','IN_TREATMENT','WAITING_CLIENT','CLIENT_RESPONDED')
    and nullif(btrim(plate),'') is not null;

create or replace function public.bulk_close_tracking_alerts(closing_reason text)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  caller public.profiles%rowtype;
  affected integer := 0;
begin
  select * into caller from public.profiles where id=auth.uid() and active=true;
  if caller.id is null then
    raise exception 'Usuário inválido ou inativo.';
  end if;
  if caller.access_role not in ('Supervisor','Coordenador','Gerente','Administrador') then
    raise exception 'Somente Supervisor, Coordenador, Gerente ou Administrador pode encerrar todos os alertas.';
  end if;
  if length(trim(coalesce(closing_reason,''))) < 10 then
    raise exception 'Informe uma justificativa com pelo menos 10 caracteres.';
  end if;

  with closed_alerts as (
    update public.tracking_alerts
    set status='TREATED',
        treatment_description='Encerramento em massa: '||trim(closing_reason),
        treated_by=caller.id,
        treated_at=now(),
        visible_until=now()+interval '10 minutes',
        updated_at=now()
    where status in ('PENDING_TREATMENT','IN_TREATMENT','WAITING_CLIENT','CLIENT_RESPONDED')
    returning id
  ), timeline_entries as (
    insert into public.tracking_alert_timeline(alert_id,actor_type,actor_id,actor_name,action,details)
    select id,'USER',caller.id,caller.full_name,'Alerta encerrado em ação coletiva.',jsonb_build_object('reason',trim(closing_reason))
    from closed_alerts
    returning 1
  )
  select count(*) into affected from timeline_entries;

  insert into public.tracking_audit_logs(actor_type,actor_id,component,action,entity_type,metadata)
  values('USER',caller.id,'AlertWorkflowService','Encerramento coletivo de alertas.','tracking_alert',jsonb_build_object('reason',trim(closing_reason),'closed_count',affected));

  return affected;
end $$;

grant execute on function public.bulk_close_tracking_alerts(text) to authenticated;
