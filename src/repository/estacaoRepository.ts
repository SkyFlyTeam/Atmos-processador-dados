import type { Estacao } from "../interfaces/estacao";

export interface EstacaoRepositoryOptions {
    baseUrl?: string;
    endpointPath?: string;
    fetchOptions?: RequestInit;
}

export class EstacaoRepository {
    private baseUrl: string;
    private endpointPath: string;
    private fetchOptions: RequestInit;

    constructor(options?: EstacaoRepositoryOptions) {
        this.baseUrl = options?.baseUrl || "http://localhost:5000";
        this.endpointPath = options?.endpointPath || "/estacao/";
        this.fetchOptions = options?.fetchOptions || {};
    }

    async fetchAll(): Promise<Estacao[]> {
        const url = `${this.baseUrl}${this.endpointPath}`;
        const response = await fetch(url, this.fetchOptions);
        if (!response.ok) {
            throw new Error(`Erro ao buscar dados: ${response.statusText}`);
        }
        const data = await response.json();
        return data as Estacao[];
    }

    async getAllEstacaoUUIDs(): Promise<Record<string, number>> {
        const allParams = await this.fetchAll();
        return allParams.reduce((acc, param) => {
            acc[param.uuid] = param.pk;
            return acc;
        }, {} as Record<string, number>);
    }
}
