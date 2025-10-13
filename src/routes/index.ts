import { Router } from 'express'
import valoresRouter from "./valores";
import healthRouter from "./health";
const router = Router();

router.use('/valores', valoresRouter)
router.use('/health', healthRouter)

export default router;
