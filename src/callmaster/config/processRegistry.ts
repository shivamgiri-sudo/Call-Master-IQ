// src/callmaster/config/processRegistry.ts
import db from '../../config/db';
import dbAuditPool from '../../config/dbAudit';
import dbExternalPool from '../../config/dbExternal';
import { Pool } from 'mysql2/promise';

export type SourceType = 'Inbound' | 'Outbound';

export interface ProcessConfig {
  processName: string;
  sourceType: SourceType;
  pool: Pool;
  targetCqPct: number;
}

let _registry: Map<string, ProcessConfig> | null = null;

export async function getRegistry(): Promise<Map<string, ProcessConfig>> {
  if (_registry) return _registry;

  const [rows] = await (db as any).execute(
    `SELECT process_name, source_type,
            COALESCE(target_cq_pct, CASE WHEN source_type='Inbound' THEN 95 ELSE 80 END) AS target_cq_pct
     FROM process_mapping_master
     WHERE active_status = 1`
  ) as any[];

  _registry = new Map();
  for (const row of rows) {
    _registry.set(row.process_name, {
      processName: row.process_name,
      sourceType:  row.source_type as SourceType,
      pool:        row.source_type === 'Inbound' ? (dbAuditPool as unknown as Pool) : (dbExternalPool as unknown as Pool),
      targetCqPct: Number(row.target_cq_pct),
    });
  }
  return _registry;
}

export function clearRegistryCache(): void {
  _registry = null;
}

export async function getProcessConfig(processName: string): Promise<ProcessConfig | undefined> {
  const reg = await getRegistry();
  return reg.get(processName);
}
