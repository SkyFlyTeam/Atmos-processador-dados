import { Router, type Request, type Response } from 'express';
import { pingMongo } from '../repository/mongoRepository';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  return res.status(200).json({ ok: true });
});

router.get('/mongo', async (_req: Request, res: Response) => {
  try {
    const result = await pingMongo();
    if (result.ok) return res.status(200).json({ ok: true, mongo: result.serverInfo ?? true });
    return res.status(500).json({ ok: false });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

export default router;
