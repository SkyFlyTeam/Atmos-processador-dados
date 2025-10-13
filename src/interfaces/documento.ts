export type MongoDocumentId = string | { $oid: string };

export interface Documento {
    _id: MongoDocumentId;           // Identificador único do MongoDB
    UUID: string;                   // UUID da estação (referencia 'Estacao')
    unixtime: number | string;      // Tempo da leitura
    [key: string]: unknown;         // Demais parâmetros capturados dinamicamente
}
