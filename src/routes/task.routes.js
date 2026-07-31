import { Router } from 'express';
import * as controller from '../controllers/task.controller.js';

// The URL map, and nothing else. Reading this file should tell you every address
// the API answers on and where to go looking for what happens next.
const router = Router();

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getOne);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
