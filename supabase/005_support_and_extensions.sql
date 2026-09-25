-- SmartRisk | ramais das bases e central de chamados

alter table public.user_notifications add column if not exists route text;
alter table public.user_notifications add column if not exists record_id text;

insert into public.permissions(permission_key,module_key,label) values
  ('ramais','operacao','Ramais das bases'),
  ('abrirChamado','suporte','Abrir chamado'),
  ('chamados','suporte','Chamados recebidos')
on conflict(permission_key) do update set module_key=excluded.module_key,label=excluded.label;

insert into public.role_permissions(access_role,permission_key,allowed)
select role_name,permission_key,
  case
    when permission_key in ('ramais','abrirChamado') then true
    when permission_key='chamados' and role_name='Administrador' then true
    else false
  end
from unnest(array['Operador','Lider','Supervisor','Coordenador','Gerente','Administrador','Cliente']) role_name
cross join unnest(array['ramais','abrirChamado','chamados']) permission_key
on conflict(access_role,permission_key) do nothing;

create or replace function public.profile_has_permission(profile_id uuid,requested text)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((
    select case
      when p.access_role='Cliente' then requested in ('menu','perfil','dashboard','centralOcorrencias','ramais','abrirChamado')
      else coalesce(
        (select allowed from public.user_permission_overrides where user_id=p.id and permission_key=requested),
        (select allowed from public.role_permissions where access_role=p.access_role and permission_key=requested),
        false
      )
    end
    from public.profiles p where p.id=profile_id and p.active=true
  ),false)
$$;

create or replace function public.user_has_permission(requested text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.profile_has_permission(auth.uid(),requested)
$$;

create table if not exists public.base_extensions (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references public.operational_bases(id) on delete cascade,
  label text not null,
  extension_number text not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(base_id,label,extension_number)
);

create sequence if not exists public.support_ticket_number_seq;

create or replace function public.next_support_ticket_number()
returns text language sql volatile set search_path=public as $$
  select 'SR-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.support_ticket_number_seq')::text,4,'0')
$$;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default public.next_support_ticket_number(),
  requester_id uuid not null references public.profiles(id) on delete restrict,
  category text not null,
  subject text not null,
  description text not null,
  priority text not null default 'NORMAL' check(priority in ('LOW','NORMAL','HIGH','URGENT')),
  status text not null default 'OPEN' check(status in ('OPEN','IN_PROGRESS','WAITING_USER','RESOLVED','CLOSED')),
  assigned_to uuid references public.profiles(id) on delete set null,
  response_text text,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_ticket_content check(length(trim(subject)) between 3 and 160 and length(trim(description)) between 10 and 4000)
);

create index if not exists base_extensions_base_idx on public.base_extensions(base_id) where active=true;
create index if not exists support_tickets_requester_idx on public.support_tickets(requester_id,created_at desc);
create index if not exists support_tickets_queue_idx on public.support_tickets(status,priority,created_at);

create or replace function public.notify_new_support_ticket()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.user_notifications(user_id,title,message,priority,route,record_id)
  select p.id,'Novo chamado '||new.ticket_number,new.subject,
    case when new.priority in ('HIGH','URGENT') then new.priority else 'NORMAL' end,
    'chamados',new.id::text
  from public.profiles p
  where p.active=true
    and public.profile_has_permission(p.id,'chamados')
    and p.notifications_enabled=true
    and coalesce((p.notification_preferences->>'chamados')::boolean,true);

  insert into public.tracking_audit_logs(actor_type,actor_id,component,action,entity_type,entity_id,metadata)
  values('USER',new.requester_id,'SupportTicketService','Chamado aberto.','support_ticket',new.id::text,jsonb_build_object('ticket_number',new.ticket_number,'category',new.category,'priority',new.priority));
  return new;
end $$;

drop trigger if exists support_ticket_created_trigger on public.support_tickets;
create trigger support_ticket_created_trigger after insert on public.support_tickets
for each row execute function public.notify_new_support_ticket();

create or replace function public.create_support_ticket(ticket_category text,ticket_subject text,ticket_description text,ticket_priority text default 'NORMAL')
returns uuid language plpgsql security definer set search_path=public as $$
declare created_id uuid;
begin
  if not public.user_has_permission('abrirChamado') then raise exception 'Sem permissão para abrir chamados.'; end if;
  if length(trim(coalesce(ticket_category,'')))<3 then raise exception 'Selecione o tipo da solicitação.'; end if;
  if length(trim(coalesce(ticket_subject,'')))<3 then raise exception 'Informe um assunto válido.'; end if;
  if length(trim(coalesce(ticket_description,'')))<10 then raise exception 'Descreva a solicitação com pelo menos 10 caracteres.'; end if;
  if ticket_priority not in ('LOW','NORMAL','HIGH','URGENT') then raise exception 'Prioridade inválida.'; end if;
  insert into public.support_tickets(requester_id,category,subject,description,priority)
  values(auth.uid(),trim(ticket_category),trim(ticket_subject),trim(ticket_description),ticket_priority)
  returning id into created_id;
  return created_id;
end $$;

create or replace function public.manage_support_ticket(requested_ticket uuid,new_status text,ticket_response text default null,assigned_user uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare target public.support_tickets%rowtype; actor_name text; status_label text;
begin
  if not public.user_has_permission('chamados') then raise exception 'Sem permissão para tratar chamados.'; end if;
  if new_status not in ('OPEN','IN_PROGRESS','WAITING_USER','RESOLVED','CLOSED') then raise exception 'Status inválido.'; end if;
  select * into target from public.support_tickets where id=requested_ticket for update;
  if target.id is null then raise exception 'Chamado não encontrado.'; end if;
  if assigned_user is not null and not public.profile_has_permission(assigned_user,'chamados') then raise exception 'O responsável selecionado não possui acesso aos chamados.'; end if;
  select full_name into actor_name from public.profiles where id=auth.uid();
  status_label=case new_status when 'OPEN' then 'Aberto' when 'IN_PROGRESS' then 'Em atendimento' when 'WAITING_USER' then 'Aguardando usuário' when 'RESOLVED' then 'Resolvido' else 'Encerrado' end;
  update public.support_tickets set
    status=new_status,
    assigned_to=coalesce(assigned_user,assigned_to),
    response_text=coalesce(nullif(trim(ticket_response),''),support_tickets.response_text),
    resolved_at=case when new_status='RESOLVED' then coalesce(resolved_at,now()) else resolved_at end,
    closed_at=case when new_status='CLOSED' then coalesce(closed_at,now()) else closed_at end,
    updated_at=now()
  where id=requested_ticket;

  insert into public.user_notifications(user_id,title,message,priority,route,record_id)
  values(target.requester_id,'Atualização do chamado '||target.ticket_number,
    'Status alterado para '||status_label||case when nullif(trim(ticket_response),'') is not null then '. A equipe registrou um retorno.' else '.' end,
    'NORMAL','abrir-chamado',target.id::text);

  insert into public.tracking_audit_logs(actor_type,actor_id,component,action,entity_type,entity_id,metadata)
  values('USER',auth.uid(),'SupportTicketService','Chamado atualizado.','support_ticket',target.id::text,jsonb_build_object('ticket_number',target.ticket_number,'status',new_status,'assigned_to',coalesce(assigned_user,target.assigned_to),'actor_name',actor_name));
  return target.id;
end $$;

alter table public.base_extensions enable row level security;
alter table public.support_tickets enable row level security;

drop policy if exists "authenticated read extensions" on public.base_extensions;
create policy "authenticated read extensions" on public.base_extensions for select to authenticated using(active=true or public.is_smart_risk_admin());
drop policy if exists "admins manage extensions" on public.base_extensions;
create policy "admins manage extensions" on public.base_extensions for all to authenticated using(public.is_smart_risk_admin()) with check(public.is_smart_risk_admin());

drop policy if exists "requesters and support read tickets" on public.support_tickets;
create policy "requesters and support read tickets" on public.support_tickets for select to authenticated using(requester_id=auth.uid() or public.user_has_permission('chamados'));
drop policy if exists "requesters create tickets" on public.support_tickets;
create policy "requesters create tickets" on public.support_tickets for insert to authenticated with check(requester_id=auth.uid() and public.user_has_permission('abrirChamado'));
drop policy if exists "support manages tickets" on public.support_tickets;
create policy "support manages tickets" on public.support_tickets for update to authenticated using(public.user_has_permission('chamados')) with check(public.user_has_permission('chamados'));

grant select on public.base_extensions to authenticated;
grant insert,update on public.base_extensions to authenticated;
grant select on public.support_tickets to authenticated;
grant usage,select on sequence public.support_ticket_number_seq to authenticated;
grant execute on function public.create_support_ticket(text,text,text,text) to authenticated;
grant execute on function public.manage_support_ticket(uuid,text,text,uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.base_extensions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.support_tickets;
exception when duplicate_object then null; end $$;
