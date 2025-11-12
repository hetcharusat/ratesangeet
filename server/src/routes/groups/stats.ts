import { Router } from 'express';
import statsRoutes from '../stats';
// Could later add uptime, server stats, completion events, etc.

const router = Router();
router.use('/', statsRoutes);
export default router;
