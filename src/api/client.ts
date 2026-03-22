export interface BillitConfig {
  apiKey: string;
  partyId: number;
  contextPartyId?: number;
  baseUrl?: string;
}

export class BillitClient {
  readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: BillitConfig) {
    this.baseUrl = config.baseUrl ?? "https://api.billit.be";
    this.headers = {
      "Content-Type": "application/json",
      "ApiKey": config.apiKey,
    };
    if (config.partyId) {
      this.headers["PartyID"] = String(config.partyId);
    }
    if (config.contextPartyId) {
      this.headers["ContextPartyID"] = String(config.contextPartyId);
    }
  }

  async request<T>(method: string, path: string, body?: unknown, partyIdOverride?: number): Promise<T> {
    const headers = { ...this.headers };
    if (partyIdOverride !== undefined) headers["PartyID"] = String(partyIdOverride);
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Billit ${res.status} ${method} ${path}: ${text}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }
}
