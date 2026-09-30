import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(120),
  countryOfResidence: z.string().min(2).max(80).optional(),
  nationality: z.string().min(2).max(80).optional(),
  preferredCurrency: z.string().min(3).max(3).default("AED"),
  preferredLanguage: z.string().min(2).max(8).default("en"),
  travelFrequency: z.string().max(80).optional(),
  travelPurpose: z.string().max(80).optional(),
  defaultTravelStyle: z.string().max(40).default("Balanced")
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1)
});

export const updateProfileSchema = registerSchema.omit({ password: true }).partial();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(120)
});
