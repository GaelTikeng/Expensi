/**
 * UUID v7: 48-bit millisecond timestamp + random. Time-sortable, so ids
 * generated on the device index well in Postgres (CLAUDE.md D9).
 *
 * Pure: the caller supplies 10 random bytes so this runs identically under
 * vitest (Node) and on device (expo-crypto). See features/expenses/ids.ts.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function uuidv7(randomBytes: Uint8Array, timestampMs = Date.now()): string {
  if (randomBytes.length < 10) throw new Error('uuidv7 needs 10 random bytes');
  const b = new Uint8Array(16);

  // 48-bit big-endian timestamp. ms < 2^48, exact in a double.
  let t = timestampMs;
  for (let i = 5; i >= 0; i--) {
    b[i] = t % 256;
    t = Math.floor(t / 256);
  }

  b.set(randomBytes.subarray(0, 10), 6);
  b[6] = (b[6] & 0x0f) | 0x70; // version 7
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant

  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
