import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/roles.js';
import {
  approveEvent,
  rejectEvent,
  listPendingEvents,
  listAdminUsers,
  blockUser,
  unblockUser,
  getAdminDashboard,
} from '../controllers/adminController.js';

const router = Router();

router.use(authenticate, authorizeRoles('admin'));
router.get('/dashboard', getAdminDashboard);
router.get('/users', listAdminUsers);
router.get('/events/pending', listPendingEvents);
router.post('/events/:id/approve', approveEvent);
router.post('/events/:id/reject', rejectEvent);
router.post('/users/:id/block', blockUser);
router.post('/users/:id/unblock', unblockUser);

export default router;
