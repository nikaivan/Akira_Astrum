import { z } from "zod";

/** 72 bytes es el máximo útil de bcrypt, el algoritmo que usa Supabase Auth. */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1).max(72),
});
