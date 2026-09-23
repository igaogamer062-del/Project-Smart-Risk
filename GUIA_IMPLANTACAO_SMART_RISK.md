# Implantação do SmartRisk: GitHub Pages, Supabase e Groq

Este guia parte de um projeto Supabase vazio e de um repositório GitHub novo.

## 1. O que fica em cada serviço

- **GitHub Pages:** somente o frontend público (`index.html`, `css`, `js`, `images`).
- **Supabase:** autenticação, banco, RLS, funções de backend, alertas, auditoria e agendamentos.
- **Groq:** interpretação opcional de textos. A chave existe somente nos Secrets das Edge Functions.
- **Integrador real:** ainda não é configurado. O backend usa `TEST_PROVIDER` até a documentação oficial chegar.

A chave publishable do Supabase pode aparecer no frontend porque a segurança real é feita pelas políticas RLS. Nunca publique `service_role`, `GROQ_API_KEY` ou `TRACKING_INGEST_SECRET`.

## 2. Criar o banco no Supabase

1. Abra o projeto no Supabase.
2. Vá em **SQL Editor > New query**.
3. Abra `supabase/001_smart_risk_setup.sql`, copie todo o conteúdo e execute uma única vez.
4. Confirme no **Table Editor** que existem, entre outras, as tabelas `profiles`, `operational_bases`, `transporters`, `tracking_inbound_events` e `tracking_alerts`.

Não execute as migrações antigas arquivadas. Elas pertencem às versões com PWA, chat e mapas.

## 3. Criar o primeiro administrador

1. No Supabase, abra **Authentication > Users > Add user**.
2. Informe seu e-mail e uma senha segura e marque o e-mail como confirmado.
3. Copie o UUID criado na coluna `User UID`.
4. Abra `supabase/002_primeiro_administrador.sql`.
5. Substitua `COLE_O_UUID_AQUI`, `SEU_EMAIL_AQUI`, nome e login.
6. Execute no SQL Editor.

Depois disso, os próximos usuários são criados na tela **Administração > Usuários** do próprio SmartRisk.

## 4. Configurar a URL pública no frontend

No Supabase, copie em **Project Settings > API**:

- Project URL
- Publishable key

Abra `js/config.js` e preencha:

```js
window.SMART_RISK_CONFIG = Object.freeze({
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabasePublishableKey: "SUA_CHAVE_PUBLISHABLE",
  sessionMaxHours: 13
});
```

A sessão usa `sessionStorage`. Fechar a aba remove a sessão local. O frontend também encerra a sessão depois de 13 horas. Não existe Service Worker, manifesto PWA ou cache de dados operacionais em `localStorage`.

## 5. Instalar e vincular a Supabase CLI

No PowerShell, dentro da pasta do projeto:

```powershell
npm install supabase --save-dev
npx supabase login
npx supabase projects list
npx supabase link --project-ref SEU_PROJECT_REF
```

O `project ref` é a parte inicial da URL: `https://PROJECT_REF.supabase.co`.

## 6. Guardar a chave Groq com segurança

Não cole a chave em `js/config.js`, GitHub ou arquivos `.env` versionados.

No painel do Supabase:

1. Abra **Edge Functions > Secrets**.
2. Crie `GROQ_API_KEY` e cole sua chave.
3. Crie `GROQ_MODEL` com `openai/gpt-oss-20b`.
4. Crie `TRACKING_INGEST_SECRET` com uma senha aleatória longa, usada apenas entre sistemas backend.

As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidas automaticamente às Edge Functions hospedadas pelo Supabase.

## 7. Publicar as Edge Functions

Execute:

```powershell
npx supabase functions deploy
```

Isso publica:

- `login-username`: converte login em e-mail no backend e autentica.
- `admin-create-user`: cria usuários com validações de cargo e vínculos.
- `admin-manage-user`: edita, desativa e redefine senha.
- `groq-test`: teste autenticado de Structured Output.
- `tracking-ingest`: entrada segura, validação, idempotência e normalização.
- `tracking-test-provider`: simulador HTTP do integrador.
- `tracking-workflow`: execução opcional do workflow por HTTP.

## 8. Testar a Groq isoladamente

1. Entre no SmartRisk para obter uma sessão válida.
2. No painel Supabase, abra a função `groq-test` e use **Test/Invoke** com JWT de usuário autenticado.
3. Envie:

```json
{
  "event_type": "PANIC_BUTTON",
  "description": "Botão de pânico acionado pelo veículo ABC1D23"
}
```

A resposta esperada possui `alert_type`, `severity`, `confidence`, `requires_human_treatment` e `reason`.

O arquivo `supabase/functions/_shared/groq.ts` faz a chamada para `https://api.groq.com/openai/v1/chat/completions`, exige JSON Schema estrito e valida novamente o conteúdo. A Groq não atualiza status nem decide prazo.

## 9. Configurar bases, transportadoras e usuários

Na ordem:

1. Entre como Administrador.
2. Abra **Administração > Configurações de bases**.
3. Cadastre as transportadoras.
4. Cadastre cada base e marque as transportadoras atendidas.
5. Em **Usuários**, crie:
   - **Cliente:** exige transportadora; não usa base ou gestor.
   - **Operador:** exige base e gestor.
   - **Lider, Supervisor, Coordenador, Gerente e Administrador:** não exigem base; o gestor permanece conforme a hierarquia configurada.

O perfil Cliente vê somente Dashboard, Perfil e Alertas. O dashboard usa os alertas pendentes da transportadora vinculada.

## 10. Configurar tipos de alerta

Abra **Administração > Configurações de abas > Configuração de alertas do integrador**.

Cada mapeamento guarda código e nome do fornecedor, tipo normalizado, severidade, prioridade, ativo, geração de alerta, necessidade de tratamento e uso opcional da Groq. O script já cria `TEST_PROVIDER / PANIC_BUTTON` para o primeiro teste.

## 11. Simular o integrador

Use a função `tracking-test-provider` no painel do Supabase. Envie o header:

```text
x-tracking-secret: O_MESMO_TRACKING_INGEST_SECRET
```

E um corpo com IDs reais cadastrados:

```json
{
  "event_type": "PANIC_BUTTON",
  "vehicle": { "plate": "ABC1D23" },
  "transporter_id": "UUID_DA_TRANSPORTADORA",
  "base_id": "UUID_DA_BASE"
}
```

O simulador encaminha o evento ao `tracking-ingest`. Repetir o mesmo `provider_event_id` não cria outro alerta. Eventos sem mapeamento ativo são guardados para auditoria e não viram alerta operacional.

## 12. Ativar o workflow a cada 10 minutos

No Supabase, abra **Integrations > Cron > Create job**:

- Nome: `smart-risk-alert-workflow`
- Agenda: `*/10 * * * *`
- Tipo: SQL
- Comando:

```sql
select public.tracking_workflow_tick();
```

Esse job controla prazos e arquiva alertas tratados depois do período visual. Ele continua rodando com o navegador fechado.

## 13. Publicar no GitHub Pages

Crie um repositório exclusivo para o SmartRisk. No PowerShell, dentro desta pasta:

```powershell
git init
git add .
git commit -m "Configura SmartRisk com Supabase e integração de alertas"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

No GitHub:

1. Abra **Settings > Pages**.
2. Em **Source**, escolha **Deploy from a branch**.
3. Selecione `main` e `/(root)`.
4. Clique em **Save**.
5. Aguarde a URL `https://SEU_USUARIO.github.io/SEU_REPOSITORIO/`.

No Supabase, abra **Authentication > URL Configuration** e coloque essa URL em **Site URL**. Adicione também a URL completa em **Redirect URLs**.

## 14. Validação final

1. Abra a URL do GitHub Pages em janela anônima.
2. Entre com o login do primeiro administrador.
3. Cadastre uma transportadora, uma base, um operador e um cliente.
4. Rode `tracking-test-provider` com os UUIDs cadastrados.
5. Confirme o alerta na conta operacional.
6. Clique em **Solicitar retorno**, descreva a situação e entre como Cliente.
7. Responda. O alerta deve desaparecer da conta Cliente e gerar notificação para o operador escolhido e para a liderança.
8. Desative notificações pessoais de um usuário e confirme que o workflow e os prazos continuam ativos.
9. Feche a aba, abra novamente e confirme que o login é solicitado.

## 15. Quando chegar a API real

Não altere o workflow. Crie um novo adaptador/provider que converta a documentação real para o contrato de `tracking-ingest`. Só então configure as credenciais realmente fornecidas pelo integrador. Não invente endpoint, token ou autenticação.

