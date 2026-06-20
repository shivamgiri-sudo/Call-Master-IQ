require('dotenv').config();
const mysql = require('mysql2/promise');
async function run() {
  const au = mysql.createPool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT||3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_AUDIT_NAME });
  const ex = mysql.createPool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT||3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_EXTERNAL_NAME });
  const sh = mysql.createPool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT||3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });

  const [cols] = await au.query(`SHOW COLUMNS FROM call_quality_assessment`);
  console.log('INBOUND_COLUMNS:', JSON.stringify(cols.map(c => c.Field)));

  const [fd] = await au.query(`SELECT COUNT(*) total,
    SUM(overall_fraud_risk_score > 0) fraud_nonzero,
    SUM(agent_english_cuss_count > 0) eng_cuss,
    SUM(agent_hindi_cuss_count > 0) hin_cuss,
    SUM(data_theft_or_misuse = 1) theft,
    SUM(unprofessional_behavior = 1) unprofessional,
    MIN(CallDate) earliest, MAX(CallDate) latest
    FROM call_quality_assessment`);
  console.log('INBOUND_FRAUD:', JSON.stringify(fd[0]));

  const [xcols] = await ex.query(`SHOW COLUMNS FROM CallDetails`);
  console.log('OUTBOUND_COLUMNS:', JSON.stringify(xcols.map(c => c.Field)));

  const [sd] = await ex.query(`SELECT COUNT(*) total,
    SUM(SaleDone = 1) sales_done, SUM(SaleDone = 0) no_sale,
    SUM(CallDisposition IS NOT NULL AND CallDisposition != '') has_disposition,
    SUM(CustomerObjectionCategory IS NOT NULL AND CustomerObjectionCategory != '') has_objection,
    SUM(AgentRebuttalCategory IS NOT NULL AND AgentRebuttalCategory != '') has_rebuttal,
    MIN(CallDate) earliest, MAX(CallDate) latest FROM CallDetails`);
  console.log('OUTBOUND_SALES:', JSON.stringify(sd[0]));

  await au.end(); await ex.end(); await sh.end();
}
run().catch(e => console.error('ERR:', e.message));
