import { z } from 'zod';

export function validateRequest<T>(schema: z.Schema<T>, data: unknown): T {
  return schema.parse(data);
}

// Example schemas
export const contactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional(),
  status: z.enum(['NEW', 'ACTIVE', 'INACTIVE']).optional(),
  createdBy: z.string()
});