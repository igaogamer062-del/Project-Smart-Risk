-- SmartRisk | instalação inicial limpa para um projeto Supabase novo
-- Execute este arquivo uma única vez no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists public.transporters (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.operational_bases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.base_transporters (
  base_id uuid not null references public.operational_bases(id) on delete cascade,
  transporter_id uuid not null references public.transporters(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (base_id, transporter_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null,
  full_name text not null,
  employee_code text,
  access_role text not null check (access_role in ('Operador','Lider','Supervisor','Coordenador','Gerente','Administrador','Cliente')),
  manager_id uuid references public.profiles(id) on delete set null,
  base_id uuid references public.operational_bases(id) on delete set null,
  base_name text,
  transporter_id uuid references public.transporters(id) on delete set null,
  job_title text,
  notes text,
  avatar_url text,
  hire_date date,
  active boolean not null default true,
  notifications_enabled boolean not null default true,
  notification_preferences jsonb not null default '{"sinistro":true,"ferias":true,"sistema":true,"alertas":true}'::jsonb,
  must_change_password boolean not null default true,
  password_changed_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_links check (
    (access_role = 'Cliente' and transporter_id is not null and base_id is null)
    or (access_role = 'Operador' and base_id is not null and transporter_id is null)
    or (access_role in ('Lider','Supervisor','Coordenador','Gerente','Administrador') and transporter_id is null)
  )
);

create or replace function public.current_profile_role()
returns text language sql stable security definer set search_path=public as $$
  select access_role from public.profiles where id=auth.uid() and active=true
$$;

create or replace function public.is_smart_risk_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select access_role='Administrador' from public.profiles where id=auth.uid() and active=true),false)
$$;

create or replace function public.is_leadership()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select access_role in ('Lider','Supervisor','Coordenador','Gerente','Administrador') from public.profiles where id=auth.uid() and active=true),false)
$$;

create table if not exists public.permissions (
  permission_key text primary key,
  module_key text not null,
  label text not null
);

create table if not exists public.role_permissions (
  access_role text not null,
  permission_key text not null references public.permissions(permission_key) on delete cascade,
  allowed boolean not null default false,
  primary key(access_role,permission_key)
);

create table if not exists public.user_permission_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null references public.permissions(permission_key) on delete cascade,
  allowed boolean not null,
  primary key(user_id,permission_key)
);

insert into public.permissions(permission_key,module_key,label) values
('menu','menu','Menu inicial'),('perfil','perfil','Alteração de perfil'),('permissoes','admin','Permissões'),
('usuarios','admin','Usuários'),('dashboard','dashboard','Dashboard'),('ocorrencia','alertas','Gerar descritivo'),
('assistente','assistente','Assistente operacional'),('centralOcorrencias','alertas','Alertas'),
('passagem','passagem','Passagem de plantão'),('sinistro','sinistro','Sinistro'),('efetivo','efetivo','Efetivo'),
('checklist','checklist','Checklist'),('ferias','ferias','Controle de férias'),('configAbas','admin','Configurações'),('logs','admin','Logs')
on conflict(permission_key) do update set module_key=excluded.module_key,label=excluded.label;

insert into public.role_permissions(access_role,permission_key,allowed)
select role_name,p.permission_key,
  case
    when role_name='Administrador' then true
    when role_name='Cliente' then p.permission_key in ('menu','perfil','dashboard','centralOcorrencias')
    when role_name='Operador' then p.permission_key not in ('permissoes','usuarios','configAbas','logs')
    else p.permission_key not in ('permissoes','configAbas')
  end
from unnest(array['Operador','Lider','Supervisor','Coordenador','Gerente','Administrador','Cliente']) role_name
cross join public.permissions p
on conflict(access_role,permission_key) do update set allowed=excluded.allowed;

create or replace function public.user_has_permission(requested text)
returns boolean language sql stable security definer set search_path=public as $$
  select case when public.current_profile_role()='Cliente' then requested in ('menu','perfil','dashboard','centralOcorrencias') else coalesce(
    (select allowed from public.user_permission_overrides where user_id=auth.uid() and permission_key=requested),
    (select rp.allowed from public.role_permissions rp join public.profiles p on p.access_role=rp.access_role where p.id=auth.uid() and p.active=true and rp.permission_key=requested),false) end
$$;

create table if not exists public.nova_gr_modules (
  module_key text primary key,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.nova_gr_records (
  module_key text not null,
  record_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(module_key,record_id)
);

create table if not exists public.nova_gr_settings (
  setting_key text primary key,
  value jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.tracking_alert_mappings (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_alert_code text not null,
  provider_alert_name text not null,
  normalized_type text not null,
  description text,
  severity text not null default 'MEDIUM' check(severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
  priority text not null default 'NORMAL' check(priority in ('LOW','NORMAL','HIGH','URGENT')),
  active boolean not null default true,
  creates_operational_alert boolean not null default true,
  requires_treatment boolean not null default true,
  requires_ai boolean not null default false,
  ai_instructions text,
  treatment_timeout_minutes integer not null default 60 check(treatment_timeout_minutes between 1 and 10080),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,provider_alert_code)
);

insert into public.tracking_alert_mappings(provider,provider_alert_code,provider_alert_name,normalized_type,description,severity,priority,active,creates_operational_alert,requires_treatment,requires_ai)
values('TEST_PROVIDER','PANIC_BUTTON','Botão de pânico','PANIC_BUTTON','Evento de teste para validar o pipeline antes da API real.','CRITICAL','URGENT',true,true,true,false)
on conflict(provider,provider_alert_code) do nothing;

create table if not exists public.tracking_inbound_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text,
  fallback_key text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'RECEIVED' check(processing_status in ('RECEIVED','PROCESSED','IGNORED','ERROR')),
  processing_error text,
  unique(provider,provider_event_id),
  unique(provider,fallback_key)
);

create table if not exists public.tracking_alerts (
  id uuid primary key default gen_random_uuid(),
  inbound_event_id uuid not null unique references public.tracking_inbound_events(id),
  provider text not null,
  provider_event_id text,
  alert_type text not null,
  severity text not null,
  priority text not null,
  vehicle_id text,
  plate text,
  driver_id text,
  driver_name text,
  transporter_id uuid references public.transporters(id),
  base_id uuid references public.operational_bases(id),
  operation_name text,
  occurred_at timestamptz not null,
  latitude numeric,
  longitude numeric,
  location_text text,
  description text,
  occurrence_summary text,
  status text not null default 'PENDING_TREATMENT' check(status in ('PENDING_TREATMENT','WAITING_CLIENT','CLIENT_RESPONDED','IN_TREATMENT','TREATED','ARCHIVED','DISCARDED','ERROR')),
  responsible_user_id uuid references public.profiles(id),
  client_requested_at timestamptz,
  client_responded_at timestamptz,
  client_response text,
  related_occurrence_id text,
  treatment_description text,
  treated_by uuid references public.profiles(id),
  treated_at timestamptz,
  visible_until timestamptz,
  deadline_at timestamptz not null,
  escalation_level integer not null default 0,
  last_escalated_at timestamptz,
  ai_used boolean not null default false,
  ai_available boolean,
  ai_result jsonb,
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tracking_alert_timeline (
  id bigint generated always as identity primary key,
  alert_id uuid not null references public.tracking_alerts(id) on delete cascade,
  actor_type text not null check(actor_type in ('USER','SYSTEM','AI')),
  actor_id uuid references public.profiles(id),
  actor_name text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tracking_audit_logs (
  id bigint generated always as identity primary key,
  actor_type text not null check(actor_type in ('USER','SYSTEM','AI')),
  actor_id uuid references public.profiles(id),
  component text not null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tracking_sync_cursors (
  provider text primary key,
  last_cursor text,
  last_event_at timestamptz,
  last_run_at timestamptz,
  received_count bigint not null default 0,
  processed_count bigint not null default 0,
  ignored_count bigint not null default 0,
  error_count bigint not null default 0,
  last_error text
);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  priority text not null default 'NORMAL',
  alert_id uuid references public.tracking_alerts(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.audit_tracking_alert_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.tracking_audit_logs(actor_type,actor_id,component,action,entity_type,entity_id,metadata)
  values(
    case when auth.uid() is null then 'SYSTEM' else 'USER' end,
    auth.uid(),
    'AlertWorkflowService',
    case when tg_op='INSERT' then 'Alerta operacional criado.' else 'Status do alerta alterado de '||old.status||' para '||new.status||'.' end,
    'tracking_alert',new.id::text,
    jsonb_build_object('status',new.status,'responsible_user_id',new.responsible_user_id,'deadline_at',new.deadline_at)
  );
  return new;
end $$;

drop trigger if exists tracking_alert_audit_trigger on public.tracking_alerts;
create trigger tracking_alert_audit_trigger after insert or update of status,responsible_user_id,deadline_at on public.tracking_alerts for each row execute function public.audit_tracking_alert_change();

create index if not exists tracking_alerts_status_deadline_idx on public.tracking_alerts(status,deadline_at);
create index if not exists tracking_alerts_transporter_idx on public.tracking_alerts(transporter_id,status);
create index if not exists tracking_alerts_base_idx on public.tracking_alerts(base_id,status);
create index if not exists profiles_presence_idx on public.profiles(base_id,last_seen_at) where active=true;

create or replace function public.touch_presence()
returns void language sql security definer set search_path=public as $$
  update public.profiles set last_seen_at=now(),updated_at=now() where id=auth.uid() and active=true
$$;

create or replace function public.update_my_nova_gr_profile(new_full_name text,new_username text,new_base_name text,new_notes text,new_avatar_url text)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.profiles set
    full_name=coalesce(nullif(trim(new_full_name),''),full_name),
    username=coalesce(nullif(trim(new_username),''),username),
    base_name=case when access_role='Operador' then base_name else nullif(trim(new_base_name),'') end,
    notes=nullif(trim(new_notes),''),
    avatar_url=new_avatar_url,
    updated_at=now()
  where id=auth.uid();
end $$;

create or replace function public.respond_tracking_alert(requested_alert uuid,response_text text)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  caller public.profiles%rowtype;
  target public.tracking_alerts%rowtype;
  selected_operator uuid;
begin
  select * into caller from public.profiles where id=auth.uid() and active=true;
  if caller.id is null or caller.access_role<>'Cliente' then raise exception 'Somente um cliente ativo pode responder.'; end if;
  if length(trim(coalesce(response_text,'')))<3 then raise exception 'Informe uma resposta válida.'; end if;
  select * into target from public.tracking_alerts where id=requested_alert for update;
  if target.id is null or target.transporter_id is distinct from caller.transporter_id or target.status<>'WAITING_CLIENT' then raise exception 'Alerta indisponível para resposta.'; end if;

  select p.id into selected_operator
  from public.base_transporters bt
  join public.profiles p on p.base_id=bt.base_id and p.access_role='Operador' and p.active=true
  where bt.transporter_id=caller.transporter_id and bt.active=true and p.last_seen_at>now()-interval '10 minutes'
  order by p.last_seen_at desc
  limit 1;

  update public.tracking_alerts set status='CLIENT_RESPONDED',client_response=trim(response_text),client_responded_at=now(),responsible_user_id=coalesce(selected_operator,responsible_user_id),updated_at=now() where id=requested_alert;
  insert into public.tracking_alert_timeline(alert_id,actor_type,actor_id,actor_name,action,details)
  values(requested_alert,'USER',caller.id,caller.full_name,'Resposta da transportadora recebida',jsonb_build_object('response',trim(response_text),'routed_operator_id',selected_operator));
  if selected_operator is not null then
    insert into public.user_notifications(user_id,title,message,priority,alert_id)
    select p.id,'Retorno da transportadora',coalesce(target.plate,'Veículo')||': resposta disponível.','HIGH',requested_alert
    from public.profiles p where p.id=selected_operator and p.notifications_enabled=true and coalesce((p.notification_preferences->>'alertas')::boolean,true);
  end if;
  insert into public.user_notifications(user_id,title,message,priority,alert_id)
  select p.id,'Retorno da transportadora',coalesce(target.plate,'Veículo')||': resposta disponível.','HIGH',requested_alert
  from public.profiles p where p.active=true and p.access_role in ('Lider','Supervisor','Coordenador','Gerente','Administrador')
  and p.notifications_enabled=true and coalesce((p.notification_preferences->>'alertas')::boolean,true)
  on conflict do nothing;
  return requested_alert;
end $$;

create or replace function public.request_client_tracking_response(requested_alert uuid,situation_summary text)
returns uuid language plpgsql security definer set search_path=public as $$
declare caller public.profiles%rowtype; target public.tracking_alerts%rowtype;
begin
  select * into caller from public.profiles where id=auth.uid() and active=true;
  select * into target from public.tracking_alerts where id=requested_alert for update;
  if caller.id is null or target.id is null then raise exception 'Alerta ou usuário inválido.'; end if;
  if caller.access_role not in ('Lider','Supervisor','Coordenador','Gerente','Administrador') and target.responsible_user_id is distinct from caller.id then raise exception 'Sem permissão para solicitar retorno.'; end if;
  if target.transporter_id is null then raise exception 'O alerta não possui transportadora vinculada.'; end if;
  if length(trim(coalesce(situation_summary,'')))<3 then raise exception 'Descreva a situação do veículo.'; end if;
  update public.tracking_alerts set status='WAITING_CLIENT',occurrence_summary=trim(situation_summary),client_requested_at=now(),deadline_at=now()+interval '1 hour',updated_at=now() where id=requested_alert;
  insert into public.tracking_alert_timeline(alert_id,actor_type,actor_id,actor_name,action,details)
  values(requested_alert,'USER',caller.id,caller.full_name,'Retorno solicitado à transportadora',jsonb_build_object('situation',trim(situation_summary)));
  insert into public.user_notifications(user_id,title,message,priority,alert_id)
  select p.id,'Retorno solicitado',coalesce(target.plate,'Veículo')||': a operação aguarda sua resposta.','HIGH',requested_alert
  from public.profiles p where p.active=true and p.access_role='Cliente' and p.transporter_id=target.transporter_id
  and p.notifications_enabled=true and coalesce((p.notification_preferences->>'alertas')::boolean,true);
  return requested_alert;
end $$;

create or replace function public.take_tracking_alert(requested_alert uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare caller public.profiles%rowtype; target public.tracking_alerts%rowtype;
begin
  select * into caller from public.profiles where id=auth.uid() and active=true;
  select * into target from public.tracking_alerts where id=requested_alert for update;
  if caller.id is null or target.id is null then raise exception 'Alerta ou usuário inválido.'; end if;
  if caller.access_role='Cliente' then raise exception 'Perfil Cliente não pode assumir tratamento.'; end if;
  if caller.access_role='Operador' and caller.base_id is distinct from target.base_id then raise exception 'Alerta fora da base do operador.'; end if;
  update public.tracking_alerts set status='IN_TREATMENT',responsible_user_id=caller.id,updated_at=now() where id=requested_alert and status not in ('TREATED','ARCHIVED','DISCARDED');
  insert into public.tracking_alert_timeline(alert_id,actor_type,actor_id,actor_name,action)
  values(requested_alert,'USER',caller.id,caller.full_name,'Tratamento assumido.');
  return requested_alert;
end $$;

create or replace function public.treat_tracking_alert(requested_alert uuid,treatment_text text)
returns uuid language plpgsql security definer set search_path=public as $$
declare caller public.profiles%rowtype; target public.tracking_alerts%rowtype;
begin
  select * into caller from public.profiles where id=auth.uid() and active=true;
  select * into target from public.tracking_alerts where id=requested_alert for update;
  if caller.id is null or target.id is null then raise exception 'Alerta ou usuário inválido.'; end if;
  if length(trim(coalesce(treatment_text,'')))<3 then raise exception 'Descreva o tratamento realizado.'; end if;
  if caller.access_role not in ('Lider','Supervisor','Coordenador','Gerente','Administrador') and target.responsible_user_id is distinct from caller.id then raise exception 'Sem permissão para concluir este tratamento.'; end if;
  update public.tracking_alerts set status='TREATED',treatment_description=trim(treatment_text),treated_by=caller.id,treated_at=now(),visible_until=now()+interval '10 minutes',updated_at=now() where id=requested_alert;
  insert into public.tracking_alert_timeline(alert_id,actor_type,actor_id,actor_name,action,details)
  values(requested_alert,'USER',caller.id,caller.full_name,'Alerta tratado.',jsonb_build_object('treatment',trim(treatment_text)));
  return requested_alert;
end $$;

create or replace function public.tracking_workflow_tick()
returns jsonb language plpgsql security definer set search_path=public as $$
declare escalated integer; archived integer;
begin
  update public.tracking_alerts set escalation_level=escalation_level+1,last_escalated_at=now(),deadline_at=now()+interval '1 hour',updated_at=now()
  where status in ('PENDING_TREATMENT','WAITING_CLIENT','CLIENT_RESPONDED','IN_TREATMENT') and deadline_at<=now();
  get diagnostics escalated=row_count;
  insert into public.tracking_alert_timeline(alert_id,actor_type,actor_name,action,details)
  select id,'SYSTEM','AlertWorkflowService','Alerta escalado automaticamente por ausência de resposta.',jsonb_build_object('level',escalation_level)
  from public.tracking_alerts where last_escalated_at>=now()-interval '1 minute';
  insert into public.user_notifications(user_id,title,message,priority,alert_id)
  select p.id,'Alerta escalado',coalesce(a.plate,'Veículo')||': prazo de tratamento excedido.','URGENT',a.id
  from public.tracking_alerts a cross join public.profiles p
  where a.last_escalated_at>=now()-interval '1 minute' and p.active=true
    and p.access_role in ('Lider','Supervisor','Coordenador','Gerente','Administrador')
    and p.notifications_enabled=true and coalesce((p.notification_preferences->>'alertas')::boolean,true);
  update public.tracking_alerts set status='ARCHIVED',updated_at=now() where status='TREATED' and visible_until<=now();
  get diagnostics archived=row_count;
  return jsonb_build_object('escalated',escalated,'archived',archived,'ran_at',now());
end $$;

alter table public.transporters enable row level security;
alter table public.operational_bases enable row level security;
alter table public.base_transporters enable row level security;
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permission_overrides enable row level security;
alter table public.nova_gr_modules enable row level security;
alter table public.nova_gr_records enable row level security;
alter table public.nova_gr_settings enable row level security;
alter table public.tracking_alert_mappings enable row level security;
alter table public.tracking_inbound_events enable row level security;
alter table public.tracking_alerts enable row level security;
alter table public.tracking_alert_timeline enable row level security;
alter table public.tracking_audit_logs enable row level security;
alter table public.tracking_sync_cursors enable row level security;
alter table public.user_notifications enable row level security;

create policy "authenticated reads reference data" on public.transporters for select to authenticated using(public.current_profile_role()<>'Cliente' or id=(select transporter_id from public.profiles where id=auth.uid()));
create policy "admins manage transporters" on public.transporters for all to authenticated using(public.is_smart_risk_admin()) with check(public.is_smart_risk_admin());
create policy "authenticated reads bases" on public.operational_bases for select to authenticated using(public.current_profile_role()<>'Cliente' or exists(select 1 from public.base_transporters bt join public.profiles p on p.transporter_id=bt.transporter_id where p.id=auth.uid() and bt.base_id=operational_bases.id and bt.active=true));
create policy "admins manage bases" on public.operational_bases for all to authenticated using(public.is_smart_risk_admin()) with check(public.is_smart_risk_admin());
create policy "authenticated reads base links" on public.base_transporters for select to authenticated using(public.current_profile_role()<>'Cliente' or transporter_id=(select transporter_id from public.profiles where id=auth.uid()));
create policy "admins manage base links" on public.base_transporters for all to authenticated using(public.is_smart_risk_admin()) with check(public.is_smart_risk_admin());
create policy "authenticated reads profiles" on public.profiles for select to authenticated using(id=auth.uid() or public.current_profile_role()<>'Cliente');
create policy "admins manage profiles" on public.profiles for all to authenticated using(public.is_smart_risk_admin()) with check(public.is_smart_risk_admin());
create policy "read permissions" on public.permissions for select to authenticated using(true);
create policy "read role permissions" on public.role_permissions for select to authenticated using(true);
create policy "read overrides" on public.user_permission_overrides for select to authenticated using(user_id=auth.uid() or public.is_smart_risk_admin());
create policy "admins manage permissions" on public.role_permissions for all to authenticated using(public.is_smart_risk_admin()) with check(public.is_smart_risk_admin());
create policy "admins manage overrides" on public.user_permission_overrides for all to authenticated using(public.is_smart_risk_admin()) with check(public.is_smart_risk_admin());

create policy "authenticated reads modules" on public.nova_gr_modules for select to authenticated using(true);
create policy "authenticated writes modules" on public.nova_gr_modules for insert to authenticated with check(public.current_profile_role()<>'Cliente');
create policy "authenticated updates modules" on public.nova_gr_modules for update to authenticated using(public.current_profile_role()<>'Cliente') with check(public.current_profile_role()<>'Cliente');
create policy "authenticated reads records" on public.nova_gr_records for select to authenticated using(public.current_profile_role()<>'Cliente');
create policy "authenticated writes records" on public.nova_gr_records for insert to authenticated with check(public.current_profile_role()<>'Cliente' and created_by=auth.uid());
create policy "record author or leadership updates" on public.nova_gr_records for update to authenticated using(public.current_profile_role()<>'Cliente' and (created_by=auth.uid() or public.is_leadership())) with check(public.current_profile_role()<>'Cliente' and updated_by=auth.uid());
create policy "authenticated reads settings" on public.nova_gr_settings for select to authenticated using(public.current_profile_role()<>'Cliente');
create policy "admins manage settings" on public.nova_gr_settings for all to authenticated using(public.is_smart_risk_admin()) with check(public.is_smart_risk_admin());

create policy "admins read mappings" on public.tracking_alert_mappings for select to authenticated using(public.is_smart_risk_admin());
create policy "admins manage mappings" on public.tracking_alert_mappings for all to authenticated using(public.is_smart_risk_admin()) with check(public.is_smart_risk_admin());
create policy "clients and operations read alerts" on public.tracking_alerts for select to authenticated using(
  public.is_leadership()
  or responsible_user_id=auth.uid()
  or transporter_id=(select transporter_id from public.profiles where id=auth.uid() and access_role='Cliente')
  or base_id=(select base_id from public.profiles where id=auth.uid() and access_role='Operador')
);
create policy "leadership updates alerts" on public.tracking_alerts for update to authenticated using(public.is_leadership() or responsible_user_id=auth.uid()) with check(public.is_leadership() or responsible_user_id=auth.uid());
create policy "authorized timeline reads" on public.tracking_alert_timeline for select to authenticated using(exists(select 1 from public.tracking_alerts a where a.id=alert_id));
create policy "own notifications" on public.user_notifications for select to authenticated using(user_id=auth.uid());
create policy "own notification updates" on public.user_notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "leadership reads audit" on public.tracking_audit_logs for select to authenticated using(public.is_leadership());

grant execute on function public.touch_presence() to authenticated;
grant execute on function public.update_my_nova_gr_profile(text,text,text,text,text) to authenticated;
grant execute on function public.respond_tracking_alert(uuid,text) to authenticated;
grant execute on function public.request_client_tracking_response(uuid,text) to authenticated;
grant execute on function public.take_tracking_alert(uuid) to authenticated;
grant execute on function public.treat_tracking_alert(uuid,text) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.tracking_alerts;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.user_notifications;
exception when duplicate_object then null; end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-photos','profile-photos',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets(id,name,public,file_size_limit)
values('ai-knowledge','ai-knowledge',false,20971520)
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit;

create policy "profile photos public read" on storage.objects for select using(bucket_id='profile-photos');
create policy "users upload own profile photo" on storage.objects for insert to authenticated with check(bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "users update own profile photo" on storage.objects for update to authenticated using(bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "users delete own profile photo" on storage.objects for delete to authenticated using(bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "admins read ai knowledge" on storage.objects for select to authenticated using(bucket_id='ai-knowledge' and public.is_smart_risk_admin());
create policy "admins upload ai knowledge" on storage.objects for insert to authenticated with check(bucket_id='ai-knowledge' and public.is_smart_risk_admin());
create policy "admins delete ai knowledge" on storage.objects for delete to authenticated using(bucket_id='ai-knowledge' and public.is_smart_risk_admin());

-- O primeiro administrador é criado por supabase/002_primeiro_administrador.sql.
