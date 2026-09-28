-- SmartRisk | conhecimento por transportadora e PGR
-- Aplicar depois de 006_support_extensions.sql.

alter table public.tracking_alert_mappings
  add column if not exists transporter_id uuid references public.transporters(id) on delete cascade;

alter table public.tracking_alert_mappings
  drop constraint if exists tracking_alert_mappings_provider_provider_alert_code_key;

create unique index if not exists tracking_alert_mappings_scope_uidx
  on public.tracking_alert_mappings(provider, provider_alert_code, coalesce(transporter_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists tracking_alert_mappings_transporter_idx
  on public.tracking_alert_mappings(transporter_id) where active=true;

create table if not exists public.transporter_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  transporter_id uuid not null references public.transporters(id) on delete cascade,
  scope text not null check(scope in ('ALERT_AI','PGR')),
  title text not null,
  description text,
  file_name text,
  storage_path text,
  mime_type text,
  extracted_text text,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transporter_knowledge_lookup_idx
  on public.transporter_knowledge_documents(transporter_id, scope, active);

insert into public.permissions(permission_key,module_key,label) values
  ('pgr','pgr','PGR e particularidades das transportadoras'),
  ('pgr_manage','pgr','PGR — cadastrar e remover documentos')
on conflict(permission_key) do update set module_key=excluded.module_key,label=excluded.label;

insert into public.role_permissions(access_role,permission_key,allowed)
select role_name,'pgr',role_name <> 'Cliente'
from unnest(array['Operador','Lider','Supervisor','Coordenador','Gerente','Administrador','Cliente']) role_name
on conflict(access_role,permission_key) do update set allowed=excluded.allowed;

insert into public.role_permissions(access_role,permission_key,allowed)
select role_name,'pgr_manage',role_name in ('Lider','Supervisor','Coordenador','Gerente','Administrador')
from unnest(array['Operador','Lider','Supervisor','Coordenador','Gerente','Administrador','Cliente']) role_name
on conflict(access_role,permission_key) do update set allowed=excluded.allowed;

alter table public.transporter_knowledge_documents enable row level security;

drop policy if exists "authorized transporter knowledge reads" on public.transporter_knowledge_documents;
create policy "authorized transporter knowledge reads" on public.transporter_knowledge_documents
for select to authenticated using (
  (scope='PGR' and public.current_profile_role()<>'Cliente' and public.user_has_permission('pgr'))
  or (scope='ALERT_AI' and public.user_has_permission('configAbas'))
);

drop policy if exists "authorized transporter knowledge inserts" on public.transporter_knowledge_documents;
create policy "authorized transporter knowledge inserts" on public.transporter_knowledge_documents
for insert to authenticated with check (
  created_by=auth.uid() and (
    (scope='PGR' and public.user_has_permission('pgr_manage'))
    or (scope='ALERT_AI' and public.user_has_permission('configAbas'))
  )
);

drop policy if exists "authorized transporter knowledge updates" on public.transporter_knowledge_documents;
create policy "authorized transporter knowledge updates" on public.transporter_knowledge_documents
for update to authenticated using (
  (scope='PGR' and public.user_has_permission('pgr_manage'))
  or (scope='ALERT_AI' and public.user_has_permission('configAbas'))
) with check (
  (scope='PGR' and public.user_has_permission('pgr_manage'))
  or (scope='ALERT_AI' and public.user_has_permission('configAbas'))
);

drop policy if exists "authorized transporter knowledge deletes" on public.transporter_knowledge_documents;
create policy "authorized transporter knowledge deletes" on public.transporter_knowledge_documents
for delete to authenticated using (
  (scope='PGR' and public.user_has_permission('pgr_manage'))
  or (scope='ALERT_AI' and public.user_has_permission('configAbas'))
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('transporter-knowledge','transporter-knowledge',false,20971520,array['application/pdf','text/plain','text/markdown','application/json'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "transporter knowledge object reads" on storage.objects;
create policy "transporter knowledge object reads" on storage.objects
for select to authenticated using (
  bucket_id='transporter-knowledge' and public.current_profile_role()<>'Cliente'
  and (public.user_has_permission('pgr') or public.user_has_permission('configAbas'))
);

drop policy if exists "transporter knowledge object inserts" on storage.objects;
create policy "transporter knowledge object inserts" on storage.objects
for insert to authenticated with check (
  bucket_id='transporter-knowledge' and (public.user_has_permission('pgr_manage') or public.user_has_permission('configAbas'))
);

drop policy if exists "transporter knowledge object deletes" on storage.objects;
create policy "transporter knowledge object deletes" on storage.objects
for delete to authenticated using (
  bucket_id='transporter-knowledge' and (public.user_has_permission('pgr_manage') or public.user_has_permission('configAbas'))
);

-- O provider interno de teste foi aposentado. Eventos agora chegam pelo webhook tracking-ingest.
delete from public.tracking_alert_mappings where provider='TEST_PROVIDER';

do $$ begin
  alter publication supabase_realtime add table public.transporter_knowledge_documents;
exception when duplicate_object then null; end $$;
