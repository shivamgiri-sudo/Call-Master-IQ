const mysql = require('mysql2/promise');
async function run() {
  const au = mysql.createPool({ host:'192.168.10.6', port:3306, user:'shivam_user', password:'qwersdfg!@#hjk', database:'db_audit' });
  const sh = mysql.createPool({ host:'192.168.10.6', port:3306, user:'shivam_user', password:'qwersdfg!@#hjk', database:'Shivamgiri' });

  // Branch breakdown
  const [br] = await sh.query(`SELECT branch_short_name, COUNT(*) AS row_cnt, SUM(total_calls) AS calls, ROUND(AVG(avg_quality_score),1) AS avg_q
    FROM daily_performance_snapshot WHERE avg_quality_score > 0
    GROUP BY branch_short_name ORDER BY calls DESC LIMIT 8`);
  console.log('BRANCH_DATA:', JSON.stringify(br));

  // Agent count in snapshot
  const [ag] = await sh.query(`SELECT COUNT(DISTINCT agent_employee_code) AS agents, COUNT(DISTINCT process_name) AS processes
    FROM daily_performance_snapshot WHERE agent_employee_code IS NOT NULL AND agent_employee_code != ''`);
  console.log('SNAPSHOT_AGENTS:', JSON.stringify(ag[0]));

  // Sensitive/cuss words in inbound (column is sensetive_word - typo in source)
  const [sw] = await au.query(`SELECT sensetive_word AS word, COUNT(*) AS cnt FROM call_quality_assessment
    WHERE sensetive_word IS NOT NULL AND sensetive_word != ''
    GROUP BY sensetive_word ORDER BY cnt DESC LIMIT 10`);
  console.log('SENSITIVE_WORDS:', JSON.stringify(sw));

  // Cuss word counts
  const [cw] = await au.query(`SELECT
    SUM(agent_english_cuss_count) AS eng_cuss_total,
    SUM(agent_hindi_cuss_count) AS hindi_cuss_total,
    SUM(CASE WHEN agent_english_cuss_count > 0 THEN 1 ELSE 0 END) AS calls_with_eng_cuss,
    SUM(CASE WHEN agent_hindi_cuss_count > 0 THEN 1 ELSE 0 END) AS calls_with_hindi_cuss
    FROM call_quality_assessment`);
  console.log('CUSS_COUNTS:', JSON.stringify(cw[0]));

  // English cuss words sample
  const [ecw] = await au.query(`SELECT agent_english_cuss_words AS words, COUNT(*) AS cnt FROM call_quality_assessment
    WHERE agent_english_cuss_words IS NOT NULL AND agent_english_cuss_words != ''
    GROUP BY agent_english_cuss_words ORDER BY cnt DESC LIMIT 10`);
  console.log('ENG_CUSS_WORDS:', JSON.stringify(ecw));

  // Process breakdown from snapshot
  const [pr] = await sh.query(`SELECT process_name, SUM(total_calls) AS calls, ROUND(AVG(avg_quality_score),1) AS avg_q, SUM(critical_calls) AS critical
    FROM daily_performance_snapshot WHERE avg_quality_score > 0
    GROUP BY process_name ORDER BY calls DESC LIMIT 10`);
  console.log('PROCESS_DATA:', JSON.stringify(pr));

  // Fraud data from unified view
  const [frv] = await sh.query(`SELECT
    SUM(CASE WHEN overall_fraud_risk_score > 0 THEN 1 ELSE 0 END) AS fraud_nonzero,
    SUM(CASE WHEN fraud_potentiality_percentage > 50 THEN 1 ELSE 0 END) AS high_fraud,
    MAX(fraud_potentiality_percentage) AS max_fraud_pct,
    COUNT(*) AS total
    FROM v_call_master_unified LIMIT 1`);
  console.log('FRAUD_IN_VIEW:', JSON.stringify(frv[0]));

  // Coaching assignment completion status
  const [ca] = await sh.query(`SELECT completion_status, COUNT(*) AS cnt FROM coaching_assignment GROUP BY completion_status`);
  console.log('COACHING_ASSIGN_STATUS:', JSON.stringify(ca));

  // daily_insight sample — what does an analyst insight look like?
  const [di] = await sh.query(`SELECT scope_type, scope_value, generated_by, JSON_LENGTH(insight_json) AS json_keys, insight_date FROM daily_insight LIMIT 5`);
  console.log('INSIGHT_SAMPLE:', JSON.stringify(di));

  await au.end(); await sh.end();
}
run().catch(e => console.error('ERR:', e.message));
