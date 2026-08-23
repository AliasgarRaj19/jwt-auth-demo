import dotenv from 'dotenv';
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 4000),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5501',
  APP_URL: process.env.APP_URL || 'http://localhost:5501',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  JWT_ISSUER: process.env.JWT_ISSUER || 'jwt-auth-demo',
  JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'jwt-auth-demo-users',
  RATE_LIMIT_DEV_MULTIPLIER: Number(process.env.RATE_LIMIT_DEV_MULTIPLIER || 20),
  RATE_LIMIT_DEV_WINDOW_MS: Number(process.env.RATE_LIMIT_DEV_WINDOW_MS || 60_000),
  TRUST_PROXY_HOPS: Number(process.env.TRUST_PROXY_HOPS || 0),
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_SECURE: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_FROM: process.env.SMTP_FROM || 'Demo Auth <no-reply@example.com>',
  MASTER_ADMIN_USERNAME: process.env.MASTER_ADMIN_USERNAME || 'admin@example.com',
  MASTER_ADMIN_PASSWORD: process.env.MASTER_ADMIN_PASSWORD || 'change-me',
  COOKIE_SECURE: String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true' || process.env.NODE_ENV === 'production'
};
