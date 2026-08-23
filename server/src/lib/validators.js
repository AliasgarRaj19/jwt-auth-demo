import { z } from 'zod';

const email = z.string().trim().toLowerCase().email();
const password = z.string().min(8).max(128);

export const registrationSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional().or(z.literal('')),
  email,
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  gender: z.string().trim().max(30).optional().or(z.literal('')),
  address: z.string().trim().max(250).optional().or(z.literal('')),
  password,
  repeatPassword: password
}).refine((v) => v.password === v.repeatPassword, { message: 'Passwords do not match', path: ['repeatPassword'] });

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const tokenSchema = z.object({ token: z.string().min(1) });
export const passwordResetSchema = z.object({ token: z.string().min(1), password, repeatPassword: password }).refine((v) => v.password === v.repeatPassword, { path: ['repeatPassword'] });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password, repeatNewPassword: password }).refine((v) => v.newPassword === v.repeatNewPassword, { path: ['repeatNewPassword'] });
