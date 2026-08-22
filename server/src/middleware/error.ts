import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { ApiError } from '../lib/errors.js';
import { isProd } from '../config/env.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large' : `Upload rejected: ${err.code}`;
    return res.status(400).json({ error: message });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Record already exists' });
    if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found' });
  }

  console.error(err);
  return res.status(500).json({
    error: 'Internal server error',
    ...(isProd ? {} : { detail: err instanceof Error ? err.message : String(err) }),
  });
}
