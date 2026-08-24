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
  resendVerificationForActionToken,
  requestPasswordReset,
  resetPassword,
  validatePasswordResetToken,
  verifyEmailToken
} from '../services/auth.js';

const router = Router();

router.post('/register', rateLimit((req) => `register:${req.ip}`, rateLimitPresets.register), async (req, res) => {
  const data = registrationSchema.parse(req.body);
  const result = await registerUser(data);
  if (result.recoveryToken) {
    res.cookie('verificationAction', result.recoveryToken, cookieOptions(15 * 60 * 1000));
  }
  res.json(result);
});

router.post('/resend-verification', rateLimit((req) => `resend:${req.ip}`, rateLimitPresets.resendVerification), async (req, res) => {
  const result = await resendVerificationForActionToken(req.cookies.verificationAction);
  if (result.status === 'verified') {
    res.clearCookie('verificationAction', clearCookieOptions());
  }
  res.json(result);
});

router.post('/verify-email', rateLimit((req) => `verify:${req.ip}`, rateLimitPresets.verifyEmail), async (req, res) => {
  const { token } = tokenSchema.parse(req.body);
  res.json(await verifyEmailToken(token));
});

router.post('/login', rateLimit((req) => `login:${req.ip}`, rateLimitPresets.login), async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const result = await loginUser(email, password);
  if (result.code === 'ACCOUNT_UNVERIFIED') {
    res.cookie('verificationAction', result.recoveryToken, cookieOptions(15 * 60 * 1000));
    return res.json({ code: 'ACCOUNT_UNVERIFIED', email: result.email });
  }
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
  if (result.status === 'retry') return res.status(409).json({ message: 'REFRESH_RETRY' });
  const response = { accessToken: result.accessToken, user: result.user };
  if (result.refreshToken) {
    const csrfToken = newCsrfToken();
    res.cookie('refreshToken', result.refreshToken, cookieOptions(7 * 24 * 60 * 60_000));
    res.cookie('csrfToken', csrfToken, { ...cookieOptions(7 * 24 * 60 * 60_000), httpOnly: false });
    response.csrfToken = csrfToken;
  }
  res.json(response);
});

router.post('/logout', async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) await logoutSession(token);
  res.clearCookie('refreshToken', clearCookieOptions());
  res.clearCookie('csrfToken', clearCookieOptions());
  res.clearCookie('verificationAction', clearCookieOptions());
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
