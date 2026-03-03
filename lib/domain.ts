import { z } from "zod";

export const accountSchema = z.object({
  organizationId: z.string().uuid(),
  legalName: z.string().min(2),
  tradeName: z.string().min(2).optional(),
  segment: z.string().min(2).optional()
});

export const contactSchema = z.object({
  organizationId: z.string().uuid(),
  accountId: z.string().uuid(),
  fullName: z.string().min(3),
  email: z.string().email().optional(),
  phone: z.string().min(8).optional(),
  position: z.string().min(2).optional()
});

export const opportunitySchema = z.object({
  organizationId: z.string().uuid(),
  accountId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  stageId: z.string().uuid(),
  ownerId: z.string().uuid().optional(),
  title: z.string().min(4),
  amount: z.number().nonnegative(),
  expectedCloseDate: z.string().date().optional()
});

export type AccountInput = z.infer<typeof accountSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type OpportunityInput = z.infer<typeof opportunitySchema>;
