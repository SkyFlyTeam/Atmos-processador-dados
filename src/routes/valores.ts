import { Router } from "express";
import type {Request, Response } from "express";
import { TipoParametroRepository } from "../repository/tipoParametroRepository.ts";
import { EstacaoRepository } from "../repository/estacaoRepository.ts";
import { ValorCapturadoRepository } from "../repository/valorCapturadoRepository.ts";
import { syncMongoToPostgres } from "../services/mongoToPostgresSync.ts";

const router = Router();
const tipoParametroRepository: TipoParametroRepository = new TipoParametroRepository()
const estacaoRepository: EstacaoRepository = new EstacaoRepository()
const valorCapturadoRepository: ValorCapturadoRepository = new ValorCapturadoRepository()

router.get("/", async (req: Request, res: Response) => {
    const json_ids = await tipoParametroRepository.getAllJsonIds()
    const estacoes_uuids = await estacaoRepository.getAllEstacaoUUIDs()
    const dadosRecebidos = req.body;
    
    if (!dadosRecebidos || Object.keys(dadosRecebidos).length === 0) {
      return res.status(400).send({ error: "Nenhum dado foi enviado" });
    }

    let unixtime: number | null = dadosRecebidos.unixtime;
    let estacaoId: number | null = estacoes_uuids[dadosRecebidos.UUID];

    if (unixtime == null || estacaoId == null) {
      return res.status(400).send({ error: "Verifique a existência ou os valores de unixtime e/ou estacaoId" });
    }

    try {
      const dadosParaSalvar = [];
      for (const key in dadosRecebidos) {
        if (key === "unixtime" || key === "UUID") continue;
        if (!(key in json_ids)) continue;

        const Parametros_pk = json_ids[key];
        const valor = dadosRecebidos[key];

        const obj = {
            unixtime,
            Parametros_pk,
            valor,
            estacao_id: estacaoId
        };

        dadosParaSalvar.push(obj);
      }
      const resultados = await Promise.all(
        dadosParaSalvar.map(param => valorCapturadoRepository.save(param))
      );
    }
    catch {
      return res.status(500).json({"error": "Erro no processo de envio para o Back-end"})
    }

    return res.status(200).send({ "message": "Sucesso no registro dos parâmetros" });
});

router.post("/sync", async (_req: Request, res: Response) => {
    try {
        const summary = await syncMongoToPostgres();
        return res.status(200).json(summary);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        return res.status(500).json({ error: message });
    }
});

export default router;
