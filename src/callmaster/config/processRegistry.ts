// src/callmaster/config/processRegistry.ts
import db from '../../config/db';
import dbAuditPool from '../../config/dbAudit';
import dbExternalPool from '../../config/dbExternal';
import { Pool, RowDataPacket } from 'mysql2/promise';

export type SourceType = 'Inbound' | 'Outbound';

export interface ProcessConfig {
  processName: string;
  sourceType: SourceType;
  pool: Pool;
  targetCqPct: number;
}

interface ProcessRow extends RowDataPacket {
  process_name: string;
  source_type: string;
  target_cq_pct: number;
}

let _registryPromise: Promise<Map<string, ProcessConfig>> | null = null;

async function loadRegistry(): Promise<Map<string, ProcessConfig>> {
  const [rows] = await (db as any).execute(
    `SELECT process_name, source_type,
            COALESCE(target_cq_pct, CASE WHEN source_type='Inbound' THEN 95 ELSE 80 END) AS target_cq_pct
     FROM process_mapping_master
     WHERE active_status = 1`
  ) as unknown as [ProcessRow[]];

  const VALID_SOURCE_TYPES = new Set<string>(['Inbound', 'Outbound']);
  const registry = new Map<string, ProcessConfig>();

  for (const row of rows) {
    if (!VALID_SOURCE_TYPES.has(row.source_type)) {
      throw new Error(`processRegistry: unknown source_type '${row.source_type}' for process '${row.process_name}'`);
    }

    registry.set(row.process_name, {
      processName: row.process_name,
      sourceType:  row.source_type as SourceType,
      pool:        row.source_type === 'Inbound' ? (dbAuditPool as unknown as Pool) : (dbExternalPool as unknown as Pool),
      targetCqPct: Number(row.target_cq_pct),
    });
  }
  return registry;
}

export function getRegistry(): Promise<Map<string, ProcessConfig>> {
  if (!_registryPromise) {
    _registryPromise = loadRegistry().catch((err) => {
      _registryPromise = null; // allow retry on next call
      throw err;
    });
  }
  return _registryPromise;
}

export function clearRegistryCache(): void {
  _registryPromise = null;
}

export async function getProcessConfig(processName: string): Promise<ProcessConfig | undefined> {
  const reg = await getRegistry();
  return reg.get(processName);
}
