import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { userRouter } from './routes/user.js';
import { adminRouter } from './routes/admin.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.use(helmet({
    frameguard: { action: 'deny' },
    contentSecurityPolicy: false,
    hsts: false,
    referrerPolicy: { policy: 'no-referrer' }
  }));
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || origin === env.CLIENT_URL) return cb(null, origin || env.CLIENT_URL);
      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token']
  }));
  app.use(express.json());
  app.use(cookieParser());
  app.get('/health', (_, res) => res.json({ ok: true }));
  app.get('/api/health', (_, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/user', userRouter);
  app.use('/api/admin', adminRouter);
  app.use((err, _req, res, _next) => {
    const status = err?.name === 'ZodError' ? 400 : 500;
    const message = status === 400 ? 'Validation failed' : 'Internal server error';
    if (env.NODE_ENV !== 'production') console.error(err);
    res.status(status).json({ message });
  });
  return app;
}
