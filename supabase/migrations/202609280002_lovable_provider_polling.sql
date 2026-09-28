-- SmartRisk | adaptador do simulador Lovable
-- Aplicar depois de 202609280001_transporter_knowledge_and_pgr.sql.

insert into public.tracking_alert_mappings(
  provider,provider_alert_code,provider_alert_name,normalized_type,description,
  severity,priority,active,creates_operational_alert,requires_treatment,requires_ai
)
select values_to_insert.*
from (values
  ('LOVABLE_SIMULATOR','botao_panico','Botão de pânico','PANIC_BUTTON','Botão de pânico recebido do simulador.','CRITICAL','URGENT',true,true,true,false),
  ('LOVABLE_SIMULATOR','desvio_rota','Desvio de rota','ROUTE_DEVIATION','Desvio de rota recebido do simulador.','HIGH','HIGH',true,true,true,false),
  ('LOVABLE_SIMULATOR','desengate','Desengate de carreta','TRAILER_DETACHMENT','Desengate de carreta recebido do simulador.','CRITICAL','URGENT',true,true,true,false),
  ('LOVABLE_SIMULATOR','perda_comunicacao','Perda de comunicação','COMMUNICATION_LOSS','Perda de comunicação recebida do simulador.','HIGH','HIGH',true,true,true,false),
  ('LOVABLE_SIMULATOR','parada_nao_prevista','Parada não prevista','TRACKING_EVENT','Parada não prevista recebida do simulador.','MEDIUM','NORMAL',true,true,true,false),
  ('LOVABLE_SIMULATOR','excesso_velocidade','Excesso de velocidade','VIOLATION','Excesso de velocidade recebido do simulador.','MEDIUM','NORMAL',true,true,true,false)
) as values_to_insert(provider,provider_alert_code,provider_alert_name,normalized_type,description,severity,priority,active,creates_operational_alert,requires_treatment,requires_ai)
where not exists (
  select 1 from public.tracking_alert_mappings existing
  where existing.provider=values_to_insert.provider
    and existing.provider_alert_code=values_to_insert.provider_alert_code
    and existing.transporter_id is null
);

insert into public.tracking_sync_cursors(provider,last_run_at,last_error)
values('LOVABLE_SIMULATOR',null,null)
on conflict(provider) do nothing;
