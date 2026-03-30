import { z } from "zod";

export const upsertVitalsSchema = z.object({
  bp: z.string().trim().min(3),
  hr: z.number().int().min(20).max(250),
  temp: z.number().min(90).max(110),
  spo2: z.number().int().min(50).max(100),
  updatedBy: z.string().trim().optional()
});
