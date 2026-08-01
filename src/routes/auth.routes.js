import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/require-auth.js';

// The front gates. Signup and login are deliberately open — a client that has no
// account, and a client that has one but no token yet, still has to be able to
// reach them. Logout is the odd one: you cannot end a session without proving
// you are in it, so it takes the same guard as any protected route.
const router = Router();

router.post('/signup', controller.signUp);
router.post('/login', controller.logIn);
router.post('/logout', requireAuth, controller.logOut);

export default router;
