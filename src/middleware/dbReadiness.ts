import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — positive results only

const tableExistsCache = new Map<string, number>(); // tableName -> expiresAt epoch ms

async function checkTableExists(tableName: string): Promise<boolean> {
  const now = Date.now();
  const cached = tableExistsCache.get(tableName);
  if (cached !== undefined && now < cached) return true;

  const [rows] = await pool.execute<any[]>(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [tableName]
  );

  const exists = rows.length > 0;
  if (exists) {
    tableExistsCache.set(tableName, now + CACHE_TTL_MS);
  } else {
    // Negative results are never cached — table may appear shortly after deploy
    tableExistsCache.delete(tableName);
  }
  return exists;
}

/**
 * Middleware that guards a route behind one or more table existence checks.
 * - Table missing → 503 DB_NOT_READY (with missingTable field)
 * - Table present but empty → request passes through (caller decides meaning)
 * - Positive results cached 5 minutes; negative results never cached
 */
export function requireTables(...tableNames: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      for (const table of tableNames) {
        const exists = await checkTableExists(table);
        if (!exists) {
          res.status(503).json({
            success: false,
            error: 'DB_NOT_READY',
            missingTable: table,
            message: `Required table "${table}" does not exist. Run migrations before using this endpoint.`,
          });
          return;
        }
      }
      next();
    } catch (err: any) {
      res.status(503).json({
        success: false,
        error: 'DB_NOT_READY',
        message: 'Database readiness check failed.',
      });
    }
  };
}

/** Single-table convenience alias */
export const requireTable = (tableName: string) => requireTables(tableName);

/** Exposed for testing — clears the positive-result cache */
export function clearTableExistsCache(): void {
  tableExistsCache.clear();
}
