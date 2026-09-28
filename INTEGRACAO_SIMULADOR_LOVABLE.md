# Integração do simulador Lovable com o SmartRisk

O SmartRisk recebe alertas automaticamente por um webhook Supabase:

```text
POST https://zeswbeivbxayksihitfv.supabase.co/functions/v1/tracking-ingest
Content-Type: application/json
x-tracking-secret: valor configurado no segredo TRACKING_INGEST_SECRET
```

O segredo deve ficar no backend ou na função server-side do projeto Lovable. Não coloque esse segredo em código executado no navegador.

## Contrato mínimo aceito

```json
{
  "provider": "CODIGO_REAL_DO_SIMULADOR",
  "provider_event_id": "IDENTIFICADOR_UNICO",
  "event_type": "CODIGO_REAL_DO_EVENTO",
  "event_time": "2026-09-28T12:00:00Z",
  "vehicle": { "plate": "ABC1D23" },
  "driver": { "id": "opcional", "name": "opcional" },
  "transporter_id": "UUID_DA_TRANSPORTADORA_NO_SMARTRISK",
  "base_id": "UUID_DA_BASE_NO_SMARTRISK",
  "description": "Descrição opcional",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "location": "Local opcional"
}
```

Antes do primeiro envio, cadastre em **Configuração de alertas** o mesmo `provider`, `event_type` e, quando aplicável, a transportadora. O mapeamento específico da transportadora tem prioridade sobre a regra geral.

## Respostas esperadas

- `201`: alerta criado.
- `200` com `duplicate: true`: evento já recebido; nenhum alerta duplicado foi criado.
- `200` com `ignored: true`: evento auditado, mas sem mapeamento ativo.
- `400`: payload inválido.
- `401`: segredo ausente ou incorreto.

Para concluir a integração de saída do Lovable, ainda são necessários os nomes exatos dos campos, a forma como o simulador guarda os UUIDs da transportadora/base e onde o segredo server-side será configurado.
