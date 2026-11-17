import { z } from 'zod';
import { CATEGORIES, PRIORITIES } from './classification.constants.js';

export const classificationSchema = z.object({
    category: z.enum(CATEGORIES),
    priority: z.enum(PRIORITIES),
    summary: z.string().min(1)
});

export type Classification = z.infer<typeof classificationSchema>;