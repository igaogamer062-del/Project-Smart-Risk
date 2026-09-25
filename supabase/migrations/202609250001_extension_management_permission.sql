-- SmartRisk | separa consulta e gerenciamento de ramais

insert into public.permissions(permission_key,module_key,label)
values ('ramais_manage','operacao','Ramais — Cadastrar e desativar')
on conflict(permission_key) do update
set module_key=excluded.module_key,label=excluded.label;

insert into public.role_permissions(access_role,permission_key,allowed)
select role_name,'ramais_manage',role_name='Administrador'
from unnest(array['Operador','Lider','Supervisor','Coordenador','Gerente','Administrador','Cliente']) role_name
on conflict(access_role,permission_key) do nothing;

drop policy if exists "admins manage extensions" on public.base_extensions;
drop policy if exists "authorized users manage extensions" on public.base_extensions;
create policy "authorized users manage extensions"
on public.base_extensions for all to authenticated
using(public.user_has_permission('ramais_manage'))
with check(public.user_has_permission('ramais_manage'));

grant insert,update on public.base_extensions to authenticated;
