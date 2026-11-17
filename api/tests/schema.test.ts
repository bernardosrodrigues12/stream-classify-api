import { describe, expect, it } from 'vitest';
import { parseClassification } from '../src/schemas/classification.schema.js';
import { CATEGORIES, PRIORITIES } from '../src/schemas/classification.constants.js';

const validJson = JSON.stringify({
    category: 'billing',
    priority: 'high',
    summary: 'Cliente foi cobrado duas vezes no cartão'
});

describe('parseClassification', () => {
    it('accepts valid JSON', () => {
        const result = parseClassification(validJson);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.category).toBe('billing');
        }
    });

    it('keeps the category and priority lists as expected', () => {
        expect(CATEGORIES).toEqual(['billing', 'technical', 'account', 'other']);
        expect(PRIORITIES).toEqual(['low', 'medium', 'high']);
    });

    it('rejects an enum value outside the allowed list', () => {
        const json = JSON.stringify({ category: 'sales', priority: 'high', summary: 'x' });
        const result = parseClassification(json);

        expect(result.ok).toBe(false);
        expect(result).toMatchObject({ reason: 'schema_mismatch' });
    });

    it('rejects a missing field', () => {
        const json = JSON.stringify({ category: 'billing', priority: 'high' });
        const result = parseClassification(json);

        expect(result.ok).toBe(false);
        expect(result).toMatchObject({ reason: 'schema_mismatch' });
    });

    it('rejects malformed JSON', () => {
        const result = parseClassification('{"category":"billing",');

        expect(result.ok).toBe(false);
        expect(result).toMatchObject({ reason: 'malformed_json' });
    });
})