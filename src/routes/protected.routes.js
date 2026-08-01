import { Router } from 'express';
import * as controller from '../controllers/protected.controller.js';

const router = Router();

router.get('/profile', controller.profile);

export default router;
