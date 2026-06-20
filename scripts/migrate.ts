import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import pool from '../src/config/db';

const PHASE_DIRS: Record<number, string> = {
  1: path.join(__dirname, '../src/db/migrations/phase1'),
  4: path.join(__dirname, '../src/db/migrations/phase4'),
};

const ALLOWED_PHASES = Object.keys(PHASE_DIRS).map(Number);

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function parseArgs(): { phase: number; dryRun: boolean } {
  const phaseArg = process.argv.find(a => a.startsWith('--phase='));
  const dryRun = process.argv.includes('--dry-run');

  if (!phaseArg) {
    console.error('Usage: ts-node scripts/migrate.ts --phase=<1|4> [--dry-run]');
    process.exit(1);
  }

  const phase = parseInt(phaseArg.split('=')[1], 10);
  if (!ALLOWED_PHASES.includes(phase)) {
    console.error(`Invalid phase "${phase}". Allowed: ${ALLOWED_PHASES.join(', ')}`);
    process.exit(1);
  }

  return { phase, dryRun };
}

async function ensureMigrationsTable(dryRun: boolean): Promise<void> {
  const [rows] = await pool.execute<any[]>(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schema_migrations' LIMIT 1`
  );

  if (rows.length === 0) {
    if (dryRun) {
      console.log('[dry-run] schema_migrations table does not exist — would create it');
      return;
    }
    console.log('[migrate] Creating schema_migrations table...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS \`schema_migrations\` (
        \`migration_id\`   VARCHAR(100) PRIMARY KEY,
        \`phase\`          INT NOT NULL,
        \`filename\`       VARCHAR(200) NOT NULL,
        \`checksum\`       VARCHAR(64) NOT NULL,
        \`applied_at\`     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('[migrate] schema_migrations table created');
  }
}

async function getAppliedMigrations(): Promise<Map<string, string>> {
  try {
    const [rows] = await pool.execute<any[]>(
      'SELECT migration_id, checksum FROM schema_migrations'
    );
    const map = new Map<string, string>();
    for (const row of rows) map.set(row.migration_id, row.checksum);
    return map;
  } catch (err: any) {
    // MySQL error 1146 = ER_NO_SUCH_TABLE (table doesn't exist yet — first run)
    if (err.errno === 1146) return new Map();
    throw err;
  }
}

async function runMigrations(phase: number, dryRun: boolean): Promise<void> {
  const dir = PHASE_DIRS[phase];

  if (!fs.existsSync(dir)) {
    console.error(`[migrate] Migration directory does not exist: ${dir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log(`[migrate] No SQL files found in phase ${phase} directory.`);
    return;
  }

  // Dry-run: no DB connection needed — just list what would be applied
  if (dryRun) {
    for (const filename of files) {
      console.log(`[dry-run] WOULD APPLY: ${filename}`);
    }
    console.log(`\n[migrate] Phase ${phase} dry-run complete. No database changes made.`);
    return;
  }

  await ensureMigrationsTable(false);
  const applied = await getAppliedMigrations();

  for (const filename of files) {
    const migrationId = `p${phase}_${filename}`;
    const filePath = path.join(dir, filename);
    const sql = fs.readFileSync(filePath, 'utf8');
    const hash = sha256(sql);
    const existingHash = applied.get(migrationId);

    if (existingHash !== undefined) {
      if (existingHash !== hash) {
        console.error(`[migrate] CHECKSUM MISMATCH - aborting: ${filename}`);
        console.error(`  stored:   ${existingHash}`);
        console.error(`  current:  ${hash}`);
        process.exit(1);
      }
      console.log(`[migrate] SKIP (already applied): ${filename}`);
      continue;
    }

    console.log(`[migrate] Applying: ${filename}`);
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let stmtIndex = 0;
    try {
      for (const stmt of statements) {
        stmtIndex++;
        await pool.execute(stmt);
      }
      await pool.execute(
        'INSERT INTO schema_migrations (migration_id, phase, filename, checksum) VALUES (?, ?, ?, ?)',
        [migrationId, phase, filename, hash]
      );
    } catch (err: any) {
      console.error(`[migrate] FAILED at statement ${stmtIndex} of ${statements.length} in ${filename}:`);
      console.error(`  SQL: ${statements[stmtIndex - 1]?.slice(0, 120)}...`);
      console.error(`  Error: ${err.message}`);
      console.error('[migrate] Migration aborted. Fix the issue and re-run. Previously applied statements in this file cannot be automatically rolled back (DDL).');
      process.exit(1);
    }

    console.log(`[migrate] Applied: ${filename}`);
  }

  console.log(`\n[migrate] Phase ${phase} migration complete.`);
}

async function main(): Promise<void> {
  const { phase, dryRun } = parseArgs();

  if (dryRun) {
    console.log(`[dry-run] Phase ${phase} — no changes will be made to the database\n`);
  } else {
    console.log(`[migrate] Phase ${phase} — live run against Shivamgiri\n`);
  }

  try {
    await runMigrations(phase, dryRun);
  } finally {
    await (pool as any).end().catch(() => {});
  }
}

main().catch(err => {
  console.error('[migrate] Fatal error:', err.message);
  process.exit(1);
});
