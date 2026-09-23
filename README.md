# Central SmartRisk

Portal operacional conectado ao Supabase, sem modo offline e sem armazenamento de dados operacionais no `localStorage`.

## Estrutura ativa

- `index.html`, `css/` e `js/`: frontend estático para GitHub Pages.
- `supabase/001_smart_risk_setup.sql`: banco, RLS, cargos, bases, transportadoras, alertas, auditoria e workflow.
- `supabase/002_primeiro_administrador.sql`: criação do perfil do primeiro administrador.
- `supabase/functions/`: autenticação por login, administração de usuários, Groq e integração de rastreamento.
- `GUIA_IMPLANTACAO_SMART_RISK.md`: roteiro completo de publicação.

## Arquitetura de alertas

`Provider HTTP -> tracking-ingest -> normalização -> regras configuradas -> Groq opcional -> tracking_alerts -> workflow -> notificações -> auditoria`

A Groq classifica texto quando o mapeamento pede IA. Prazos, permissões, status, notificações e escalonamento continuam no backend.

## Smart Chat

O PWA e o antigo Chat checklist foram separados do SmartRisk. A cópia preservada está em `../smart-chat-separado` e no arquivo `../Smart_Chat_Separado.zip` para um futuro repositório chamado Smart Chat.
