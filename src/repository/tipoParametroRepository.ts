import type { TipoParametro } from "../interfaces/tipoParametro.ts";

export interface TipoParametroRepositoryOptions {
    baseUrl?: string;
    endpointPath?: string;
    fetchOptions?: RequestInit;
}

export class TipoParametroRepository {
    private baseUrl: string;
    private endpointPath: string;
    private fetchOptions: RequestInit;

    constructor(options?: TipoParametroRepositoryOptions) {
        this.baseUrl = options?.baseUrl || "http://localhost:5000";
        this.endpointPath = options?.endpointPath || "/tipo-parametro/";
        this.fetchOptions = options?.fetchOptions || {};
    }

    async fetchAll(): Promise<TipoParametro[]> {
        const url = `${this.baseUrl}${this.endpointPath}`;
        const response = await fetch(url, this.fetchOptions);
        if (!response.ok) {
            throw new Error(`Erro ao buscar dados: ${response.statusText}`);
        }
        const data = await response.json();
        return data as TipoParametro[];
    }

    async getAllJsonIds(): Promise<Record<string, number>> {
        const allParams = await this.fetchAll();
        return allParams.reduce((acc, param) => {
            acc[param.json_id] = param.pk;
            return acc;
        }, {} as Record<string, number>);
    }    
}
