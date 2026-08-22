import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  makeAuthLimiter,
  makeResetLimiter,
  makeSignupLimiter,
} from '../../middleware/rateLimit.js';
import { env, isProd } from '../../config/env.js';
import { ApiError } from '../../lib/errors.js';
import { mailEnabled, passwordResetEmail, sendMail } from '../../lib/mailer.js';
import * as service from './auth.service.js';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from './auth.schema.js';

export const authRouter = Router();

const authLimiter = makeAuthLimiter();
const signupLimiter = makeSignupLimiter();
const resetLimiter = makeResetLimiter();

authRouter.post(
  '/signup',
  signupLimiter,
  validate({ body: signupSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.signup(req.body));
  }),
);

authRouter.post(
  '/login',
  authLimiter,
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
  resetLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(async (req, res) => {
    // Refuse rather than pretend. A 200 with no email ever arriving is the
    // worse failure, and this leaks nothing about whether the account exists.
    if (!mailEnabled()) {
      throw new ApiError(503, 'Password reset is temporarily unavailable');
    }

    const token = await service.requestPasswordReset(req.body.email);

    if (token) {
      await sendMail({ to: req.body.email, ...passwordResetEmail(token) });
    }

    // Always 200 so the response can't be used to enumerate accounts.
    res.json({
      message: 'If that email is registered, a reset link has been sent.',
      // Exposed only under the "log" transport, where nothing is delivered and
      // local development would otherwise have no way to finish the flow.
      // Any transport that really sends (smtp) or captures (memory) keeps it out.
      ...(!isProd && env.MAIL_TRANSPORT === 'log' && token ? { devResetToken: token } : {}),
    });
  }),
);

authRouter.post(
  '/reset-password',
  resetLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(async (req, res) => {
    await service.resetPassword(req.body.token, req.body.password);
    res.json({ message: 'Password updated' });
  }),
);
