import { Router } from 'express';
import { z } from 'zod';
import { loginSchema, passwordResetSchema, registrationSchema, tokenSchema } from '../lib/validators.js';
import { rateLimit, rateLimitPresets } from '../lib/limiter.js';
import { clearCookieOptions, cookieOptions, newCsrfToken } from '../lib/cookies.js';
import {
  adminLogin,
  loginUser,
  logoutSession,
  refreshSession,
  registerUser,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  validatePasswordResetToken,
  verifyEmailToken
} from '../services/auth.js';

const router = Router();

router.post('/register', rateLimit((req) => `register:${req.ip}`, rateLimitPresets.register), async (req, res) => {
  const data = registrationSchema.parse(req.body);
  res.json(await registerUser(data));
});

router.post('/resend-verification', rateLimit((req) => `resend:${req.ip}`, rateLimitPresets.resendVerification), async (req, res) => {
  const { email } = loginSchema.pick({ email: true }).parse(req.body);
  res.json(await resendVerificationEmail(email));
});

router.post('/verify-email', rateLimit((req) => `verify:${req.ip}`, rateLimitPresets.verifyEmail), async (req, res) => {
  const { token } = tokenSchema.parse(req.body);
  res.json(await verifyEmailToken(token));
});

router.post('/login', rateLimit((req) => `login:${req.ip}`, rateLimitPresets.login), async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const result = await loginUser(email, password);
  if (result.status) return res.status(400).json({ message: 'Invalid credentials or account state' });
  const csrfToken = newCsrfToken();
  res.cookie('refreshToken', result.refreshToken, cookieOptions(7 * 24 * 60 * 60_000));
  res.cookie('csrfToken', csrfToken, { ...cookieOptions(7 * 24 * 60 * 60_000), httpOnly: false });
  res.json({ accessToken: result.accessToken, csrfToken, user: { id: result.user.id, email: result.user.email } });
});

router.post('/refresh', rateLimit((req) => `refresh:${req.ip}`, rateLimitPresets.refresh), async (req, res) => {
  const token = req.cookies.refreshToken;
  const result = await refreshSession(token);
  if (!result) return res.status(401).json({ message: 'Unauthorized' });
  const csrfToken = newCsrfToken();
  res.cookie('refreshToken', result.refreshToken, cookieOptions(7 * 24 * 60 * 60_000));
  res.cookie('csrfToken', csrfToken, { ...cookieOptions(7 * 24 * 60 * 60_000), httpOnly: false });
  res.json({ accessToken: result.accessToken, csrfToken, user: result.user });
});

router.post('/logout', async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) await logoutSession(token);
  res.clearCookie('refreshToken', clearCookieOptions());
  res.clearCookie('csrfToken', clearCookieOptions());
  res.json({ ok: true });
});

router.post('/forgot-password', rateLimit((req) => `forgot:${req.ip}`, rateLimitPresets.forgotPassword), async (req, res) => {
  const { email } = loginSchema.pick({ email: true }).parse(req.body);
  res.json(await requestPasswordReset(email));
});

router.post('/reset-password/validate', rateLimit((req) => `resetvalidate:${req.ip}`, rateLimitPresets.resetPasswordValidate), async (req, res) => {
  const { token } = tokenSchema.parse(req.body);
  res.json(await validatePasswordResetToken(token));
});

router.post('/reset-password', rateLimit((req) => `reset:${req.ip}`, rateLimitPresets.resetPassword), async (req, res) => {
  const { token, password } = passwordResetSchema.parse({ ...req.body, repeatPassword: req.body.repeatPassword ?? req.body.password });
  res.json(await resetPassword(token, password));
});

router.post('/admin-login', rateLimit((req) => `adminlogin:${req.ip}`, rateLimitPresets.adminLogin), async (req, res) => {
  const { username, password } = z.object({ username: z.string().min(1), password: z.string().min(1) }).parse(req.body);
  const result = await adminLogin(username, password);
  if (!result) return res.status(400).json({ message: 'Invalid credentials' });
  const csrfToken = newCsrfToken();
  res.cookie('refreshToken', result.refreshToken, cookieOptions(7 * 24 * 60 * 60_000));
  res.cookie('csrfToken', csrfToken, { ...cookieOptions(7 * 24 * 60 * 60_000), httpOnly: false });
  res.json({ accessToken: result.accessToken, csrfToken, user: result.user });
});

export { router as authRouter };
