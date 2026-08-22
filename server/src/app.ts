import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { ensureUploadDir, uploadRoot } from './middleware/upload.js';

export function createApp() {
  const app = express();

  // Must be set before the rate limiters read req.ip.
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (env.NODE_ENV === 'development') app.use(morgan('dev'));

  // Uploaded images are static files, not API resources.
  ensureUploadDir();
  app.use(
    '/uploads',
    // Only these files need a relaxed CORP - the Vite dev server runs on a
    // different origin and would otherwise be blocked from rendering them.
    (_req, res, next) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(uploadRoot, { maxAge: '1d', index: false, dotfiles: 'deny' }),
  );

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
