import { z } from "zod";

export const patientCheckInSchema = z.object({
  fullName: z.string().trim().min(2),
  age: z.number().int().min(0).max(120),
  gender: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  symptoms: z.string().trim().min(3),
  allergies: z.string().trim().optional(),
  conditions: z.string().trim().optional(),
  medications: z.string().trim().optional()
});
