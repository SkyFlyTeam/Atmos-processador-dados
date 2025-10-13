import type { TipoParametro } from "../interfaces/tipoParametro";

export interface ValorCapturadoRepositoryOptions {
  baseUrl?: string;
  endpointPath?: string;
  fetchOptions?: RequestInit;
}

export class ValorCapturadoRepository {
  private baseUrl: string;
  private endpointPath: string;
  private fetchOptions: RequestInit;

  constructor(options?: ValorCapturadoRepositoryOptions) {
    this.baseUrl = options?.baseUrl || "http://localhost:5000";
    this.endpointPath = options?.endpointPath || "/valor-capturado/";
    this.fetchOptions = options?.fetchOptions || {};
  }

  async save(data: Record<string, string | number>): Promise<any> {
    const url = `${this.baseUrl}${this.endpointPath}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.fetchOptions.headers ?? {}),
      },
      body: JSON.stringify(data),
      ...this.fetchOptions,
    });

    if (!response.ok) {
      throw new Error(`Erro ao salvar dados: ${response.status} - ${response.statusText}`);
    }

    return response.json();
  }
 
}
