# Integração do simulador Lovable com o SmartRisk

O simulador disponibiliza uma API REST protegida. O SmartRisk consulta essa API no backend por meio da Edge Function `tracking-provider-poll`. A chave nunca passa pelo navegador.

## Secrets necessários

Em **Supabase > Edge Functions > Secrets**:

```env
TRACKING_PROVIDER_BASE_URL=https://alert-trigger-hub.lovable.app
TRACKING_PROVIDER_API_KEY=CHAVE_GERADA_NO_SIMULADOR
```

A integração também reutiliza `TRACKING_INGEST_SECRET`, já utilizado entre as funções internas do SmartRisk.

## Fluxo

```text
Cron do Supabase
  -> tracking-provider-poll
  -> GET /api/public/v1/occurrences?status=aberta&limit=100
  -> GET /api/public/v1/vehicles
  -> normalização LOVABLE_SIMULATOR
  -> tracking-ingest
  -> idempotência e mapeamento
  -> workflow, notificações e auditoria
```

O identificador da ocorrência do simulador é usado como `provider_event_id`. Consultas repetidas não criam alertas duplicados.

## Códigos cadastrados inicialmente

- `botao_panico`
- `desvio_rota`
- `desengate`
- `perda_comunicacao`
- `parada_nao_prevista`
- `excesso_velocidade`

O arquivo `supabase/008_lovable_provider_polling.sql` cadastra regras gerais para esses códigos. Na Configuração de alertas é possível criar uma regra específica e selecionar a transportadora do SmartRisk. Quando existe uma única regra específica para o código, ela também serve como vínculo da transportadora durante a simulação.

## Publicação

```powershell
npx supabase functions deploy tracking-ingest
npx supabase functions deploy tracking-provider-poll
```

## Teste manual da função

Use o mesmo valor de `TRACKING_INGEST_SECRET` no header abaixo, sem publicar o valor em arquivos ou no frontend:

```text
POST https://zeswbeivbxayksihitfv.supabase.co/functions/v1/tracking-provider-poll
Authorization: Bearer SEU_TRACKING_INGEST_SECRET
```

A resposta informa quantos eventos foram recebidos, criados, ignorados ou apresentaram erro.

## Agendamento

No Supabase Cron, agende uma requisição HTTP `POST` para a função `tracking-provider-poll` a cada minuto. Inclua o header `Authorization: Bearer ...` com o valor de `TRACKING_INGEST_SECRET`. O navegador pode permanecer fechado.
