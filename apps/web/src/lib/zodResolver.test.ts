import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodResolver } from './zodResolver.js';

const schema = z.object({
  email: z.string().email(),
  amount: z.coerce.number().min(1),
});

describe('zodResolver', () => {
  it('devuelve los valores parseados cuando el formulario es válido', async () => {
    const resolver = zodResolver<{ email: string; amount: string }>(schema);
    const result = await resolver({ email: 'user@example.com', amount: '10' }, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });

    expect(result.errors).toEqual({});
    expect(result.values).toEqual({ email: 'user@example.com', amount: 10 });
  });

  it('traduce los issues de Zod a errores por campo', async () => {
    const resolver = zodResolver<{ email: string; amount: string }>(schema);
    const result = await resolver({ email: 'invalido', amount: '0' }, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });

    expect(result.errors.email?.type).toBe('invalid_string');
    expect(result.errors.amount?.type).toBe('too_small');
  });
});
