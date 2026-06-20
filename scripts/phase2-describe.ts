/**
 * Phase 2 Column Verification Script
 * Reads DB connection from .env, runs DESCRIBE queries, writes sanitized output.
 * Does NOT print DB password or connection string.
 */
import 'dotenv/config';
import * as mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';

const TABLES_TO_DESCRIBE = [
  { database: 'Shivamgiri', table: 'v_call_master_unified_kpi' },
  { database: 'Shivamgiri', table: 'v_call_master_inbound_kpi' },
  { database: 'Shivamgiri', table: 'v_call_master_outbound_kpi' },
  { database: 'db_external', table: 'CallDetails' },
];

async function main() {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (!host || !user || !password) {
    console.error('❌ Missing DB_HOST, DB_USER, or DB_PASSWORD in .env');
    process.exit(1);
  }

  console.log('Phase 2 Column Verification');
  console.log(`Connecting to: ${host}:${port} as ${user}`);

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: false,
  });

  let output = `# Phase 2 Column Verification\n\n`;
  output += `**Generated:** ${new Date().toISOString()}\n`;
  output += `**Host:** ${host}:${port}\n`;
  output += `**User:** ${user}\n\n`;
  output += `---\n\n`;

  for (const { database, table } of TABLES_TO_DESCRIBE) {
    console.log(`\nDESCRIBE ${database}.${table}`);
    try {
      const [rows] = await connection.execute(`DESCRIBE \`${database}\`.\`${table}\``);
      output += `## ${database}.${table}\n\n`;
      output += `| Field | Type | Null | Key | Default | Extra |\n`;
      output += `|-------|------|------|-----|---------|-------|\n`;
      for (const row of rows as any[]) {
        output += `| ${row.Field} | ${row.Type} | ${row.Null} | ${row.Key || ''} | ${row.Default === null ? 'NULL' : row.Default || ''} | ${row.Extra || ''} |\n`;
      }
      output += `\n**Total columns:** ${(rows as any[]).length}\n\n`;
      console.log(`✅ ${(rows as any[]).length} columns found`);
    } catch (err: any) {
      output += `## ${database}.${table}\n\n`;
      output += `❌ **Error:** ${err.message}\n\n`;
      console.error(`❌ Error: ${err.message}`);
    }
  }

  await connection.end();

  const outputPath = path.join(process.cwd(), 'docs', 'phase2-column-verification.md');
  fs.writeFileSync(outputPath, output, 'utf8');
  console.log(`\n✅ Column verification written to: ${outputPath}`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
