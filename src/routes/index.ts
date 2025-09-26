import { Router } from 'express'
import valoresRouter from "./valores.ts";
const router = Router();

router.use('/valores', valoresRouter)

export default router;