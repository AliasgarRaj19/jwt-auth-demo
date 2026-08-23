import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { changePassword } from '../services/auth.js';
import { z } from 'zod';
import { requireCsrf } from '../lib/cookies.js';
import { rateLimit, rateLimitPresets } from '../lib/limiter.js';
const router = Router();
router.get('/me', requireAuth, (req, res) => res.json({ userId: req.auth.sub, role: req.auth.role }));
router.post('/change-password', rateLimit((req) => `changepw:${req.ip}`, rateLimitPresets.changePassword), requireAuth, requireCsrf, async (req, res) => {
  const { currentPassword, newPassword, repeatNewPassword } = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8), repeatNewPassword: z.string().min(8) }).refine((v) => v.newPassword === v.repeatNewPassword, { path: ['repeatNewPassword'] }).parse(req.body);
  res.json(await changePassword(req.auth.sub, currentPassword, newPassword));
});
export { router as userRouter };
