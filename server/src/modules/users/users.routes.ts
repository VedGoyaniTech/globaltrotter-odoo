import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { publicUrlFor, removeUploaded, uploadImage } from '../../middleware/upload.js';
import { ApiError } from '../../lib/errors.js';
import { verifyPassword } from '../../lib/password.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  firstName: z.string().trim().min(1).max(40).nullable().optional(),
  lastName: z.string().trim().min(1).max(40).nullable().optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s()-]{5,19}$/, 'Enter a valid phone number')
    .nullable()
    .optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  language: z.string().trim().min(2).max(10).optional(),
});

const publicUser = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  bio: true,
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

const changeEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  // Email is the account's identity and its password-reset channel, so changing
  // it is re-authenticated rather than treated as an ordinary profile edit.
  currentPassword: z.string().min(1),
});

// PATCH /api/users/me/email - Profile / Settings screen.
usersRouter.patch(
  '/me/email',
  validate({ body: changeEmailSchema }),
  asyncHandler(async (req, res) => {
    const { email, currentPassword } = req.body as z.infer<typeof changeEmailSchema>;

    const account = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: { email: true, passwordHash: true },
    });

    if (!(await verifyPassword(currentPassword, account.passwordHash))) {
      throw ApiError.unauthorized('Current password is incorrect');
    }
    if (email === account.email) {
      return res.json(
        await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: publicUser }),
      );
    }
    if (await prisma.user.findUnique({ where: { email } })) {
      throw ApiError.conflict('That email is already in use');
    }

    // Any reset link sent to the old address must stop working.
    const [updated] = await prisma.$transaction([
      prisma.user.update({ where: { id: req.user!.id }, data: { email }, select: publicUser }),
      prisma.passwordResetToken.deleteMany({ where: { userId: req.user!.id } }),
    ]);

    res.json(updated);
  }),
);

// POST /api/users/me/avatar - multipart/form-data, field name "image".
usersRouter.post(
  '/me/avatar',
  uploadImage,
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No image was uploaded');

    const previous = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { avatarUrl: true },
    });

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarUrl: publicUrlFor(req.file.filename) },
      select: publicUser,
    });

    removeUploaded(previous?.avatarUrl);
    res.status(201).json(user);
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
