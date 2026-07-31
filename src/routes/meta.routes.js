import { Router } from 'express';
import * as controller from '../controllers/meta.controller.js';

const router = Router();

router.get('/', controller.describe);
router.get('/health', controller.health);
router.get('/stats', controller.stats);
router.post('/reset', controller.reset);
router.get('/openapi.json', controller.openapi);

export default router;
