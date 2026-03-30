import { z } from "zod";

export const upsertConsultationSchema = z.object({
  diagnosis: z.string().trim().min(3),
  prescription: z.string().trim().min(3),
  tests: z.string().trim().optional(),
  advice: z.string().trim().optional(),
  followUpNotes: z.string().trim().optional(),
  createdBy: z.string().trim().optional()
});
