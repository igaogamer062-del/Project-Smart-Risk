-- SmartRisk | retorno da ocorrência tardia à gestão após observação do cliente

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
