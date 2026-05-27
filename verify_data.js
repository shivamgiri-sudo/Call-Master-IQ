const mysql = require('mysql2/promise');
async function run() {
  const au = mysql.createPool({ host:'192.168.10.6', port:3306, user:'shivam_user', password:'qwersdfg!@#hjk', database:'db_audit' });
  const ex = mysql.createPool({ host:'192.168.10.6', port:3306, user:'shivam_user', password:'qwersdfg!@#hjk', database:'db_external' });
  const sh = mysql.createPool({ host:'192.168.10.6', port:3306, user:'shivam_user', password:'qwersdfg!@#hjk', database:'Shivamgiri' });

  // What columns exist in call_quality_assessment?
  const [cols] = await au.query(`SHOW COLUMNS FROM call_quality_assessment`);
  const colNames = cols.map(c => c.Field);
  console.log('INBOUND_COLUMNS:', JSON.stringify(colNames));

  // INBOUND: fraud/risk - use only columns we know exist
  const [fd] = await au.query(`SELECT COUNT(*) total,
    SUM(overall_fraud_risk_score > 0) fraud_nonzero,
    SUM(agent_english_cuss_count > 0) eng_cuss,
    SUM(agent_hindi_cuss_count > 0) hin_cuss,
    SUM(data_theft_or_misuse = 1) theft,
    SUM(unprofessional_behavior = 1) unprofessional,
    MIN(CallDate) earliest, MAX(CallDate) latest
    FROM call_quality_assessment`);
  console.log('INBOUND_FRAUD:', JSON.stringify(fd[0]));

  // What columns exist in CallDetails?
  const [xcols] = await ex.query(`SHOW COLUMNS FROM CallDetails`);
  const xcolNames = xcols.map(c => c.Field);
  console.log('OUTBOUND_COLUMNS:', JSON.stringify(xcolNames));

  // OUTBOUND: sales columns
  const [sd] = await ex.query(`SELECT COUNT(*) total,
    SUM(SaleDone = 1) sales_done,
    SUM(SaleDone = 0) no_sale,
    SUM(CallDisposition IS NOT NULL AND CallDisposition != '') has_disposition,
    SUM(CustomerObjectionCategory IS NOT NULL AND CustomerObjectionCategory != '') has_objection,
    SUM(AgentRebuttalCategory IS NOT NULL AND AgentRebuttalCategory != '') has_rebuttal,
    MIN(CallDate) earliest, MAX(CallDate) latest
    FROM CallDetails`);
  console.log('OUTBOUND_SALES:', JSON.stringify(sd[0]));

  // Top dispositions
  const [cd] = await ex.query(`SELECT CallDisposition, COUNT(*) cnt FROM CallDetails
    WHERE CallDisposition IS NOT NULL AND CallDisposition != ''
    GROUP BY CallDisposition ORDER BY cnt DESC LIMIT 8`);
  console.log('TOP_DISPOSITIONS:', JSON.stringify(cd));

  // Top objection categories
  const [oc] = await ex.query(`SELECT CustomerObjectionCategory, COUNT(*) cnt FROM CallDetails
    WHERE CustomerObjectionCategory IS NOT NULL AND CustomerObjectionCategory != ''
    GROUP BY CustomerObjectionCategory ORDER BY cnt DESC LIMIT 8`);
  console.log('TOP_OBJECTIONS:', JSON.stringify(oc));

  // Top rebuttal categories
  const [rb] = await ex.query(`SELECT AgentRebuttalCategory, COUNT(*) cnt FROM CallDetails
    WHERE AgentRebuttalCategory IS NOT NULL AND AgentRebuttalCategory != ''
    GROUP BY AgentRebuttalCategory ORDER BY cnt DESC LIMIT 8`);
  console.log('TOP_REBUTTALS:', JSON.stringify(rb));

  // Quality trend sample from snapshot
  const [qt] = await sh.query(`SELECT snapshot_date, ROUND(AVG(avg_quality_score),2) avg_q, SUM(total_calls) calls
    FROM daily_performance_snapshot WHERE avg_quality_score > 0
    GROUP BY snapshot_date ORDER BY snapshot_date DESC LIMIT 10`);
  console.log('TREND_SAMPLE:', JSON.stringify(qt));

  // Fail columns totals
  const [fc] = await sh.query(`SELECT
    SUM(fail_call_answered) fa, SUM(fail_dead_air) fd, SUM(fail_professionalism) fp,
    SUM(fail_upselling) fu, SUM(fail_call_closure) fc,
    SUM(CASE WHEN avg_quality_score > 0 THEN 1 ELSE 0 END) rows_with_score
    FROM daily_performance_snapshot`);
  console.log('FAIL_COLS_TOTALS:', JSON.stringify(fc[0]));

  // Branch breakdown in snapshot
  const [br] = await sh.query(`SELECT branch_short_name, COUNT(*) rows, SUM(total_calls) calls, ROUND(AVG(avg_quality_score),1) avg_q
    FROM daily_performance_snapshot WHERE avg_quality_score > 0
    GROUP BY branch_short_name ORDER BY calls DESC LIMIT 8`);
  console.log('BRANCH_DATA:', JSON.stringify(br));

  // Sensitive words from unified view
  const [sw] = await sh.query(`SELECT sensitive_word, COUNT(*) cnt FROM v_call_master_unified
    WHERE sensitive_word IS NOT NULL AND sensitive_word != ''
    GROUP BY sensitive_word ORDER BY cnt DESC LIMIT 10`);
  console.log('SENSITIVE_WORDS:', JSON.stringify(sw));

  // Fraud data from unified view
  const [frv] = await sh.query(`SELECT
    SUM(CASE WHEN overall_fraud_risk_score > 0 THEN 1 ELSE 0 END) fraud_nonzero,
    SUM(CASE WHEN fraud_potentiality_percentage > 50 THEN 1 ELSE 0 END) high_fraud,
    COUNT(*) total
    FROM v_call_master_unified`);
  console.log('FRAUD_IN_VIEW:', JSON.stringify(frv[0]));

  await au.end(); await ex.end(); await sh.end();
}
run().catch(e => console.error('ERR:', e.message));
