import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getExternalPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '192.168.10.6',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_EXTERNAL_NAME || 'db_external',
      waitForConnections: true,
      connectionLimit: 5,
    });
  }
  return pool;
}

const dbExternalPool = new Proxy({} as mysql.Pool, {
  get(_target, prop) {
    return (getExternalPool() as unknown as Record<string, unknown>)[prop as string];
  },
});

export default dbExternalPool;
