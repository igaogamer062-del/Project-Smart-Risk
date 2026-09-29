-- SmartRisk | permite editar os campos de um efetivo existente mantendo as regras de data

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
  conflicting_id text;
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

  select * into existing from public.staff_controls where id=requested_id for update;
  select id into conflicting_id from public.staff_controls where work_date=requested_date and shift=requested_shift and id<>requested_id limit 1;
  if conflicting_id is not null then
    raise exception 'Já existe um efetivo registrado para este plantão nesta data. Abra o registro existente para editar.';
  end if;
  if existing.id is not null then
    if caller_rank<3 then raise exception 'Somente Supervisor ou superior pode editar um efetivo.'; end if;
    if (requested_date<today_sp or existing.work_date<today_sp) and caller_rank<4 then raise exception 'Efetivos de datas anteriores só podem ser editados por Coordenador ou superior.'; end if;
    update public.staff_controls set work_date=requested_date,shift=requested_shift,payload=control_record,updated_by=caller.id,updated_at=now() where id=existing.id;
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

grant execute on function public.save_staff_control(jsonb,jsonb) to authenticated;

