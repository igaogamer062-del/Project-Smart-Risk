-- SmartRisk | armazenamento e regras próprias do controle de efetivo
-- Aplicar depois de 009_active_alert_dedup_and_bulk_close.sql.

create table if not exists public.staff_controls (
  id text primary key,
  work_date date not null,
  shift text not null,
  payload jsonb not null,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(work_date,shift)
);

create table if not exists public.staff_absences (
  id text primary key,
  staff_control_id text references public.staff_controls(id) on delete set null,
  work_date date not null,
  payload jsonb not null,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_absences_date_idx on public.staff_absences(work_date desc);
create index if not exists staff_absences_control_idx on public.staff_absences(staff_control_id);

insert into public.staff_controls(id,work_date,shift,payload,created_by,updated_by,created_at,updated_at)
select distinct on ((record.payload->>'date')::date,record.payload->>'shift')
  record.record_id,(record.payload->>'date')::date,record.payload->>'shift',record.payload,
  record.created_by,record.updated_by,record.created_at,record.updated_at
from public.nova_gr_records record
where record.module_key='staff_controls'
  and coalesce(record.payload->>'date','') ~ '^\d{4}-\d{2}-\d{2}$'
  and nullif(trim(record.payload->>'shift'),'') is not null
order by (record.payload->>'date')::date,record.payload->>'shift',record.updated_at desc
on conflict(work_date,shift) do nothing;

insert into public.staff_absences(id,staff_control_id,work_date,payload,created_by,updated_by,created_at,updated_at)
select record.record_id,
       case when control.id is not null then record.payload->>'staffId' else null end,
       (record.payload->>'date')::date,record.payload,
       record.created_by,record.updated_by,record.created_at,record.updated_at
from public.nova_gr_records record
left join public.staff_controls control on control.id=record.payload->>'staffId'
where record.module_key='absences'
  and coalesce(record.payload->>'date','') ~ '^\d{4}-\d{2}-\d{2}$'
on conflict(id) do nothing;

alter table public.staff_controls enable row level security;
alter table public.staff_absences enable row level security;

drop policy if exists "operations read staff controls" on public.staff_controls;
create policy "operations read staff controls" on public.staff_controls for select to authenticated
using(public.current_profile_role()<>'Cliente');

drop policy if exists "operations read staff absences" on public.staff_absences;
create policy "operations read staff absences" on public.staff_absences for select to authenticated
using(public.current_profile_role()<>'Cliente');

create or replace function public.save_staff_control(control_record jsonb, absence_records jsonb default '[]'::jsonb)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  caller public.profiles%rowtype;
  caller_rank integer;
  requested_id text;
  requested_date date;
  requested_shift text;
  existing public.staff_controls%rowtype;
  absence jsonb;
  today_sp date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into caller from public.profiles where id=auth.uid() and active=true;
  if caller.id is null or caller.access_role='Cliente' then raise exception 'Usuário sem acesso ao controle de efetivo.'; end if;
  caller_rank := case caller.access_role when 'Administrador' then 6 when 'Gerente' then 5 when 'Coordenador' then 4 when 'Supervisor' then 3 when 'Lider' then 2 else 1 end;
  requested_id := nullif(trim(control_record->>'id'),'');
  requested_shift := nullif(trim(control_record->>'shift'),'');
  begin requested_date := (control_record->>'date')::date; exception when others then raise exception 'Informe uma data válida.'; end;
  if requested_id is null or requested_shift is null or requested_date is null then raise exception 'Data, plantão e identificador são obrigatórios.'; end if;

  select * into existing from public.staff_controls where work_date=requested_date and shift=requested_shift for update;
  if existing.id is not null and existing.id<>requested_id then
    raise exception 'Já existe um efetivo registrado para este plantão nesta data. Abra o registro existente para editar.';
  end if;
  if existing.id is not null then
    if caller_rank<3 then raise exception 'Somente Supervisor ou superior pode editar um efetivo.'; end if;
    if requested_date<today_sp and caller_rank<4 then raise exception 'Efetivos de datas anteriores só podem ser editados por Coordenador ou superior.'; end if;
    update public.staff_controls set payload=control_record,updated_by=caller.id,updated_at=now() where id=existing.id;
  else
    if requested_date<today_sp and caller_rank<4 then raise exception 'Efetivos de datas anteriores só podem ser criados por Coordenador ou superior.'; end if;
    insert into public.staff_controls(id,work_date,shift,payload,created_by,updated_by)
    values(requested_id,requested_date,requested_shift,control_record,caller.id,caller.id);
  end if;

  if jsonb_typeof(absence_records)='array' then
    delete from public.staff_absences where staff_control_id=requested_id;
    for absence in select value from jsonb_array_elements(absence_records)
    loop
      insert into public.staff_absences(id,staff_control_id,work_date,payload,created_by,updated_by)
      values(coalesce(nullif(absence->>'id',''),gen_random_uuid()::text),requested_id,requested_date,absence,caller.id,caller.id)
      on conflict(id) do update set staff_control_id=excluded.staff_control_id,work_date=excluded.work_date,payload=excluded.payload,updated_by=caller.id,updated_at=now();
    end loop;
  end if;
  return requested_id;
end $$;

create or replace function public.save_staff_absence(absence_record jsonb)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  caller public.profiles%rowtype;
  requested_id text;
  requested_date date;
  owner_id uuid;
begin
  select * into caller from public.profiles where id=auth.uid() and active=true;
  if caller.id is null or caller.access_role='Cliente' then raise exception 'Usuário sem acesso ao controle de faltas.'; end if;
  requested_id := coalesce(nullif(trim(absence_record->>'id'),''),gen_random_uuid()::text);
  begin requested_date := (absence_record->>'date')::date; exception when others then raise exception 'Informe uma data válida.'; end;
  select created_by into owner_id from public.staff_absences where id=requested_id;
  if owner_id is not null and owner_id<>caller.id and caller.access_role not in ('Supervisor','Coordenador','Gerente','Administrador') then
    raise exception 'Somente o autor ou a supervisão pode editar esta falta.';
  end if;
  insert into public.staff_absences(id,staff_control_id,work_date,payload,created_by,updated_by)
  values(requested_id,nullif(absence_record->>'staffId',''),requested_date,absence_record,caller.id,caller.id)
  on conflict(id) do update set work_date=excluded.work_date,payload=excluded.payload,updated_by=caller.id,updated_at=now();
  return requested_id;
end $$;

create or replace function public.delete_staff_absence(requested_id text)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare caller public.profiles%rowtype; target public.staff_absences%rowtype;
begin
  select * into caller from public.profiles where id=auth.uid() and active=true;
  select * into target from public.staff_absences where id=requested_id;
  if caller.id is null or target.id is null then raise exception 'Registro ou usuário inválido.'; end if;
  if target.created_by<>caller.id and caller.access_role not in ('Supervisor','Coordenador','Gerente','Administrador') then raise exception 'Somente o autor ou a supervisão pode excluir esta falta.'; end if;
  delete from public.staff_absences where id=requested_id;
end $$;

grant execute on function public.save_staff_control(jsonb,jsonb) to authenticated;
grant execute on function public.save_staff_absence(jsonb) to authenticated;
grant execute on function public.delete_staff_absence(text) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.staff_controls;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.staff_absences;
exception when duplicate_object then null; end $$;
