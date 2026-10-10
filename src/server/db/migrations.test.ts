import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * E13 F13.3: the journal and the folder must agree, otherwise `drizzle-kit
 * migrate` either skips a file or fails on a missing one. Schema drift is
 * covered separately by `pnpm db:check` (scripts/check-migrations.mjs).
 */
const dir = join(__dirname, 'migrations');
const journal = JSON.parse(readFileSync(join(dir, 'meta', '_journal.json'), 'utf8')) as {
  entries: { idx: number; when: number; tag: string }[];
};
const sqlFiles = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

describe('migrations folder', () => {
  it('has a SQL file and a snapshot for every journal entry', () => {
    for (const e of journal.entries) {
      expect(existsSync(join(dir, `${e.tag}.sql`))).toBe(true);
      expect(existsSync(join(dir, 'meta', `${String(e.idx).padStart(4, '0')}_snapshot.json`))).toBe(true);
    }
  });

  it('lists every SQL file in the journal', () => {
    expect(sqlFiles).toEqual(journal.entries.map((e) => `${e.tag}.sql`).sort());
  });

  it('numbers entries sequentially, in chronological order', () => {
    journal.entries.forEach((e, i) => {
      expect(e.idx).toBe(i);
      expect(e.tag.startsWith(`${String(i).padStart(4, '0')}_`)).toBe(true);
      if (i > 0) expect(e.when).toBeGreaterThan(journal.entries[i - 1].when);
    });
  });
});
