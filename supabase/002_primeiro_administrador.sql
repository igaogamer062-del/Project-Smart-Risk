-- 1. Crie o primeiro usuário em Authentication > Users no painel do Supabase.
-- 2. Copie o UUID dele e substitua COLE_O_UUID_AQUI abaixo.
-- 3. Ajuste nome, login e e-mail e execute este arquivo.

insert into public.profiles (
  id, username, email, full_name, access_role, active, must_change_password
) values (
  'COLE_O_UUID_AQUI'::uuid,
  'admin',
  'SEU_EMAIL_AQUI',
  'Administrador SmartRisk',
  'Administrador',
  true,
  false
);

