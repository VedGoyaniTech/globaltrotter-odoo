import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { isProd } from '../../config/env.js';
import * as service from './auth.service.js';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from './auth.schema.js';

export const authRouter = Router();

authRouter.post(
  '/signup',
  validate({ body: signupSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.signup(req.body));
  }),
);

authRouter.post(
  '/login',
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.login(req.body));
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await service.me(req.user!.id));
  }),
);

authRouter.post(
  '/forgot-password',
  validate({ body: forgotPasswordSchema }),
  asyncHandler(async (req, res) => {
    const token = await service.requestPasswordReset(req.body.email);
    // Always 200 so the response can't be used to enumerate accounts.
    res.json({
      message: 'If that email is registered, a reset link has been sent.',
      ...(isProd || !token ? {} : { devResetToken: token }),
    });
  }),
);

authRouter.post(
  '/reset-password',
  validate({ body: resetPasswordSchema }),
  asyncHandler(async (req, res) => {
    await service.resetPassword(req.body.token, req.body.password);
    res.json({ message: 'Password updated' });
  }),
);
