export type ProviderEvent = {
  provider?: string;
  provider_event_id?: string;
  vehicle?: { id?: string; plate?: string };
  driver?: { id?: string; name?: string };
  transporter_id?: string;
  base_id?: string;
  operation?: string;
  event_type?: string;
  description?: string;
  event_time?: string;
  latitude?: number;
  longitude?: number;
  location?: string;
};

export type NormalizedProviderEvent = {
  provider: string;
  providerEventId: string | null;
  providerAlertCode: string;
  occurredAt: string;
  plate: string;
  rawPayload: ProviderEvent;
};

export interface TrackingProvider {
  readonly providerCode: string;
  toSmartRiskEvent(payload: unknown): ProviderEvent;
}

export class TestTrackingProvider implements TrackingProvider {
  readonly providerCode = "TEST_PROVIDER";
  toSmartRiskEvent(payload: unknown): ProviderEvent {
    return { ...(payload as ProviderEvent), provider: this.providerCode };
  }
}

export class AlertNormalizationService {
  normalize(event: ProviderEvent): NormalizedProviderEvent {
    const provider = String(event.provider || "").trim();
    const providerAlertCode = String(event.event_type || "").trim();
    const parsed = event.event_time ? new Date(event.event_time) : new Date();
    const plate = String(event.vehicle?.plate || "").trim().toUpperCase();
    if (!provider || !providerAlertCode || Number.isNaN(parsed.getTime()) || !plate) {
      throw new Error("Payload inválido: provider, event_type, event_time e vehicle.plate são obrigatórios.");
    }
    return { provider, providerEventId: event.provider_event_id || null, providerAlertCode, occurredAt: parsed.toISOString(), plate, rawPayload: event };
  }
}

