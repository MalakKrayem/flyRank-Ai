import { Router } from 'express';
import * as controller from '../controllers/protected.controller.js';
import { requireAuth } from '../middleware/require-auth.js';

// router.use rather than one guard per line: every route defined below this
// point is protected, including ones added later by someone who never reads this
// comment. Listing the guard per route would work today and would eventually be
// forgotten once.
const router = Router();

router.use(requireAuth);

router.get('/profile', controller.profile);
router.get('/dashboard', controller.dashboard);

export default router;
