import { describe, expect, it } from 'vitest';

import { isUuid, uuidv7 } from './uuid';

const bytes = (fill: number) => new Uint8Array(10).fill(fill);

describe('uuidv7', () => {
  it('produces a valid v7 UUID with the RFC variant', () => {
    const id = uuidv7(bytes(0xff), 1_759_536_000_000);
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe('7');
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
  });

  it('encodes the timestamp in the first 48 bits, big-endian', () => {
    const id = uuidv7(bytes(0), 0x0123456789ab);
    expect(id.startsWith('01234567-89ab-7')).toBe(true);
  });

  it('sorts by time', () => {
    const a = uuidv7(bytes(0xff), 1_000);
    const b = uuidv7(bytes(0x00), 2_000);
    expect(a < b).toBe(true);
  });

  it('rejects too few random bytes', () => {
    expect(() => uuidv7(new Uint8Array(4))).toThrow();
  });
});

describe('isUuid', () => {
  it('accepts v4 and v7, rejects junk', () => {
    expect(isUuid('6ba7b810-9dad-41d1-80b4-00c04fd430c8')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });
});
