import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  language: z.string().trim().min(2).max(10).optional(),
});

const publicUser = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  city: true,
  country: true,
  language: true,
  role: true,
  createdAt: true,
} as const;

// PATCH /api/users/me - Profile / Settings screen.
usersRouter.patch(
  '/me',
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req, res) => {
    res.json(
      await prisma.user.update({
        where: { id: req.user!.id },
        data: req.body,
        select: publicUser,
      }),
    );
  }),
);

// DELETE /api/users/me - account deletion; trips cascade.
usersRouter.delete(
  '/me',
  asyncHandler(async (req, res) => {
    await prisma.user.delete({ where: { id: req.user!.id } });
    res.status(204).end();
  }),
);

// --- Saved destinations ---

usersRouter.get(
  '/me/saved-destinations',
  asyncHandler(async (req, res) => {
    const saved = await prisma.savedDestination.findMany({
      where: { userId: req.user!.id },
      include: { city: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(saved.map((s) => s.city));
  }),
);

usersRouter.post(
  '/me/saved-destinations/:cityId',
  asyncHandler(async (req, res) => {
    await prisma.savedDestination.upsert({
      where: { userId_cityId: { userId: req.user!.id, cityId: req.params.cityId } },
      create: { userId: req.user!.id, cityId: req.params.cityId },
      update: {},
    });
    res.status(201).json({ saved: true });
  }),
);

usersRouter.delete(
  '/me/saved-destinations/:cityId',
  asyncHandler(async (req, res) => {
    await prisma.savedDestination.deleteMany({
      where: { userId: req.user!.id, cityId: req.params.cityId },
    });
    res.status(204).end();
  }),
);
