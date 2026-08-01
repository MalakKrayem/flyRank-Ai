import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';

// The front gates. Both routes are deliberately open — a client that has no
// account, and a client that has one but no token yet, still has to be able to
// reach them.
const router = Router();

router.post('/signup', controller.signUp);
router.post('/login', controller.logIn);

export default router;
