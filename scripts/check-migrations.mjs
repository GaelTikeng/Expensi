/**
 * E13 drift guard: fails when src/server/db/schema.ts has changed without a
 * migration, or when the migration journal is inconsistent.
 *
 *   pnpm db:check
 *
 * How: the migrations folder is copied to a git-ignored scratch folder and
 * `drizzle-kit generate` runs against the copy. If it would write a new SQL file, the
 * committed migrations no longer match the schema. Needs no database.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// drizzle-kit resolves `out` and `schema` relative to the working directory,
// so the scratch copy lives inside the project (git-ignored) rather than in
// the system temp dir.
const SOURCE = 'src/server/db/migrations';
const SCHEMA = 'src/server/db/schema.ts';
const tmp = '.drift-check';
const out = join(tmp, 'migrations');

rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
cpSync(SOURCE, out, { recursive: true });
const config = join(tmp, 'drizzle.config.ts');
writeFileSync(config, `export default { dialect: 'postgresql', schema: '${SCHEMA}', out: '${out}', strict: false, verbose: false };\n`);

function run(args) {
  // stdin closed: an interactive rename prompt fails instead of hanging CI.
  return spawnSync('pnpm', ['exec', 'drizzle-kit', ...args], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 120_000 });
}

function fail(message, output = '') {
  console.error(`\nmigrations check FAILED: ${message}\n${output}`.trimEnd());
  rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
}

const sqlFiles = (dir) => readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const before = sqlFiles(out);

const check = run(['check', '--config', config]);
if (check.status !== 0) fail('the migration journal is inconsistent (drizzle-kit check)', check.stdout + check.stderr);

const gen = run(['generate', '--config', config, '--name', 'drift_check']);
const added = sqlFiles(out).filter((f) => !before.includes(f));
if (added.length > 0) {
  const sql = added.map((f) => `--- ${f}\n${readFileSync(join(out, f), 'utf8')}`).join('\n');
  fail(
    'src/server/db/schema.ts changed without a migration. Run `pnpm db:generate`, read the SQL, run `pnpm db:migrate`, and commit the migration with the schema.\nThe missing migration would be:\n',
    sql,
  );
}
if (gen.status !== 0) fail('drizzle-kit generate did not complete (a rename prompt?)', gen.stdout + gen.stderr);

rmSync(tmp, { recursive: true, force: true });
console.log(`migrations check OK: ${before.length} migration(s), schema matches the latest snapshot.`);
