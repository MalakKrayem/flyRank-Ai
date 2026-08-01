import { Router } from 'express';
import * as controller from '../controllers/public.controller.js';

const router = Router();

router.get('/info', controller.info);

export default router;
