import { z } from 'zod';

export const signupSchema = z
  .object({
    // The registration form collects first/last name, but a single display
    // name is also accepted so the simpler flow keeps working.
    name: z.string().trim().min(2).max(80).optional(),
    firstName: z.string().trim().min(1).max(40).optional(),
    lastName: z.string().trim().min(1).max(40).optional(),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    phone: z
      .string()
      .trim()
      .regex(/^[+\d][\d\s()-]{5,19}$/, 'Enter a valid phone number')
      .optional(),
    bio: z.string().trim().max(500).optional(),
    city: z.string().trim().max(80).optional(),
    country: z.string().trim().max(80).optional(),
  })
  .refine((v) => Boolean(v.name) || Boolean(v.firstName && v.lastName), {
    message: 'Provide either name, or both firstName and lastName',
    path: ['name'],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
