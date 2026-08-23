import { verifyAccessToken } from '../lib/jwt.js';
export async function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try { req.auth = (await verifyAccessToken(token)).payload; next(); } catch { res.status(401).json({ message: 'Unauthorized' }); }
}
export function requireRole(role) {
  return (req, res, next) => req.auth?.role === role ? next() : res.status(403).json({ message: 'Forbidden' });
}
