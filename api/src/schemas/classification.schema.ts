import { z } from 'zod';
import { CATEGORIES, PRIORITIES } from './classification.constants.js';

export const classificationSchema = z.object({
    category: z.enum(CATEGORIES),
    priority: z.enum(PRIORITIES),
    summary: z.string().min(1)
});

export type Classification = z.infer<typeof classificationSchema>;

export type ParseResult =
    | { ok: true; data: Classification}
    | { ok: false; reason: 'malformed_json' | 'schema_mismatch' };

export function parseClassification(raw: string): ParseResult {
    let json: unknown;

    try {
        json = JSON.parse(raw);
    } catch {
        return { ok: false, reason: 'malformed_json' };
    }

    const result = classificationSchema.safeParse(json);

    if (!result.success) {
        return { ok: false, reason: 'schema_mismatch' };
    }

    return { ok: true, data: result.data };
}