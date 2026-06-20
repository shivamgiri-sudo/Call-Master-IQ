require('dotenv').config();
const mysql = require('mysql2/promise');
async function run() {
  const au = mysql.createPool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT||3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_AUDIT_NAME });
  const sh = mysql.createPool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT||3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });

  const [br] = await sh.query(`SELECT branch_short_name, COUNT(*) AS row_cnt, SUM(total_calls) AS calls, ROUND(AVG(avg_quality_score),1) AS avg_q
    FROM daily_performance_snapshot WHERE avg_quality_score > 0
    GROUP BY branch_short_name ORDER BY calls DESC LIMIT 8`);
  console.log('BRANCH_DATA:', JSON.stringify(br));

  const [ag] = await sh.query(`SELECT COUNT(DISTINCT agent_employee_code) AS agents, COUNT(DISTINCT process_name) AS processes
    FROM daily_performance_snapshot WHERE agent_employee_code IS NOT NULL AND agent_employee_code != ''`);
  console.log('SNAPSHOT_AGENTS:', JSON.stringify(ag[0]));

  const [sw] = await au.query(`SELECT sensetive_word AS word, COUNT(*) AS cnt FROM call_quality_assessment
    WHERE sensetive_word IS NOT NULL AND sensetive_word != ''
    GROUP BY sensetive_word ORDER BY cnt DESC LIMIT 10`);
  console.log('SENSITIVE_WORDS:', JSON.stringify(sw));

  await au.end(); await sh.end();
}
run().catch(e => console.error('ERR:', e.message));
