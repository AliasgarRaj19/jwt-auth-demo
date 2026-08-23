import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getAdminUsers } from '../services/auth.js';
const router = Router();
router.get('/dashboard', requireAuth, requireRole('admin'), (_req, res) => res.json({ demo: true, readOnly: true }));
router.get('/users', requireAuth, requireRole('admin'), async (_req, res) => {
  const users = await getAdminUsers();
  res.json({ users });
});
export { router as adminRouter };
