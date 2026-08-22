import { z } from 'zod';

/**
 * A URL safe to hand back to a browser.
 *
 * `z.string().url()` only checks that the URL parses, so it happily accepts
 * `javascript:`, `data:` and `file:`. These values are stored and then served
 * to other users on public trip pages, so the scheme is restricted here rather
 * than relying on every render site to be careful.
 */
export const httpUrl = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => {
      try {
        const { protocol } = new URL(value);
        return protocol === 'http:' || protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Must be an http or https URL');
