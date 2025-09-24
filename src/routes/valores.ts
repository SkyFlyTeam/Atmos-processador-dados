import { Router } from "express";
import type {Request, Response } from "express";

const router = Router();

router.post("/", (req: Request, res: Response) => {
    // Recebe qualquer JSON do corpo da requisição
    const dadosRecebidos = req.body;
    
    if (!dadosRecebidos || Object.keys(dadosRecebidos).length === 0) {
      return res.status(400).send({ error: "Nenhum dado foi enviado" });
    }
    
    return res.send({ dadosRecebidos });
  });

export default router;
