import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';

let _pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!_pool) {
    _pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME, // Shivamgiri
      waitForConnections: true,
      connectionLimit: 10,
      timezone: '+05:30',
    });
  }
  return _pool;
}

export const db = new Proxy({} as mysql.Pool, {
  get(_t, prop) {
    return (getPool() as any)[prop];
  },
});

export default db;

export async function pingDb() {
  const [rows]: any = await db.query(
    'SELECT DATABASE() current_database, USER() login_user, NOW() server_time'
  );
  return rows[0];
}
