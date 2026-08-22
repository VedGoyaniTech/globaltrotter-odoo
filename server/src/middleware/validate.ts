import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { ApiError } from '../lib/errors.js';

type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny };

/** Parses and REPLACES req.body/query/params with the validated result. */
export const validate =
  (schemas: Schemas) => (req: Request, _res: Response, next: NextFunction) => {
    for (const key of ['body', 'query', 'params'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        return next(
          ApiError.badRequest('Validation failed', {
            [key]: result.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          }),
        );
      }
      Object.defineProperty(req, key, { value: result.data, writable: true });
    }
    next();
  };
