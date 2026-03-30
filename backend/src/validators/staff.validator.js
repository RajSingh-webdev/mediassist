import { z } from "zod";

export const approveEncounterSchema = z.object({
  staffName: z.string().trim().optional(),
  fullName: z.string().trim().min(2).optional(),
  age: z.number().int().min(0).max(120).optional(),
  gender: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  symptoms: z.string().trim().min(3).optional(),
  allergies: z.string().trim().optional(),
  conditions: z.string().trim().optional(),
  medications: z.string().trim().optional()
});
