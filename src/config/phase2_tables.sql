-- Call Master Phase 2 - Required app tables + KPI views
-- Run this inside MySQL Workbench using database Shivamgiri.

CREATE TABLE IF NOT EXISTS dashboard_exclusion_rules (
  exclusion_id INT AUTO_INCREMENT PRIMARY KEY,
  source_db VARCHAR(100) NOT NULL,
  source_table VARCHAR(100) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  client_id VARCHAR(50) NOT NULL,
  campaign_id VARCHAR(100) NULL,
  exclusion_reason VARCHAR(255) NOT NULL,
  active_status TINYINT DEFAULT 1,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS call_ai_insight (
  insight_id INT AUTO_INCREMENT PRIMARY KEY,
  source_type VARCHAR(50) NOT NULL,
  source_call_id VARCHAR(100) NOT NULL,
  insight_json JSON NOT NULL,
  summary_text TEXT,
  nps_risk VARCHAR(50),
  sales_impact VARCHAR(100),
  generated_by VARCHAR(100),
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_call_ai_lookup (source_type, source_call_id)
);

CREATE TABLE IF NOT EXISTS call_coaching_queue (
  coaching_id INT AUTO_INCREMENT PRIMARY KEY,
  source_type VARCHAR(50) NOT NULL,
  source_call_id VARCHAR(100) NOT NULL,
  branch_short_name VARCHAR(100),
  process_name VARCHAR(150),
  agent_employee_code VARCHAR(100),
  assigned_to VARCHAR(150),
  coaching_title VARCHAR(255),
  coaching_reason TEXT,
  priority VARCHAR(50) DEFAULT 'Medium',
  status VARCHAR(50) DEFAULT 'Open',
  due_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS call_feedback_log (
  feedback_id INT AUTO_INCREMENT PRIMARY KEY,
  source_type VARCHAR(50) NOT NULL,
  source_call_id VARCHAR(100) NOT NULL,
  analyst_user_id INT NULL,
  feedback_status VARCHAR(50) DEFAULT 'Pending',
  feedback_text TEXT,
  evidence_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL
);

INSERT INTO dashboard_exclusion_rules (source_db, source_table, source_type, client_id, campaign_id, exclusion_reason, active_status, created_by)
SELECT 'db_external','CallDetails','Outbound','493',NULL,'Inactive / retired process - excluded from active dashboard and daily email summaries',1,'SYSTEM'
WHERE NOT EXISTS (
  SELECT 1 FROM dashboard_exclusion_rules
  WHERE source_db='db_external' AND source_table='CallDetails' AND source_type='Outbound' AND client_id='493' AND active_status=1
);

CREATE OR REPLACE VIEW v_call_master_inbound_kpi AS
SELECT cqa.id AS source_call_id,'Inbound' AS source_type,cqa.ClientId AS client_id,pm.process_name,pm.business_lob,pm.branch AS branch_short_name,
cqa.Campaign AS campaign_name,cqa.lead_id,cqa.User AS source_agent_name,esa.employee_code AS agent_employee_code,emm.employee_name AS agent_employee_name,
cqa.CallDate AS call_datetime,DATE(cqa.CallDate) AS call_date,cqa.quality_percentage AS quality_score,cqa.total_score,cqa.max_score,
CASE WHEN cqa.quality_percentage>=95 THEN 'Hit' WHEN cqa.quality_percentage>=85 THEN 'Watch' WHEN cqa.quality_percentage IS NULL THEN 'No Score' ELSE 'Miss' END AS quality_band,
CASE WHEN LOWER(TRIM(COALESCE(cqa.data_theft_or_misuse,'')))='yes'
 OR LOWER(TRIM(COALESCE(cqa.unprofessional_behavior,'')))='yes'
 OR LOWER(TRIM(COALESCE(cqa.system_manipulation,'')))='yes'
 OR LOWER(TRIM(COALESCE(cqa.financial_fraud,'')))='yes'
 OR LOWER(TRIM(COALESCE(cqa.escalation_failure,'')))='yes'
 OR LOWER(TRIM(COALESCE(cqa.collusion,'')))='yes'
 OR LOWER(TRIM(COALESCE(cqa.policy_communication_failure,'')))='yes'
 OR COALESCE(cqa.agent_english_cuss_count,0)>0
 OR COALESCE(cqa.agent_hindi_cuss_count,0)>0 THEN 1 ELSE 0 END AS is_critical_call,
CASE WHEN LOWER(TRIM(COALESCE(cqa.data_theft_or_misuse,'')))='yes'
 OR LOWER(TRIM(COALESCE(cqa.financial_fraud,'')))='yes'
 OR LOWER(TRIM(COALESCE(cqa.system_manipulation,'')))='yes'
 OR LOWER(TRIM(COALESCE(cqa.collusion,'')))='yes' THEN 'Critical'
 WHEN LOWER(TRIM(COALESCE(cqa.unprofessional_behavior,'')))='yes'
 OR LOWER(TRIM(COALESCE(cqa.escalation_failure,'')))='yes'
 OR LOWER(TRIM(COALESCE(cqa.policy_communication_failure,'')))='yes'
 OR COALESCE(cqa.agent_english_cuss_count,0)>0
 OR COALESCE(cqa.agent_hindi_cuss_count,0)>0 THEN 'High'
 WHEN cqa.quality_percentage<85 THEN 'Medium' ELSE 'Normal' END AS alert_severity
FROM db_audit.call_quality_assessment cqa
INNER JOIN process_mapping_master pm
 ON CONVERT(pm.dialdesk_client_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(cqa.ClientId USING utf8mb4) COLLATE utf8mb4_unicode_ci
 AND pm.source_type='Inbound' AND pm.active_status=1
LEFT JOIN employee_source_alias esa
 ON CONVERT(esa.source_agent_name USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(cqa.User USING utf8mb4) COLLATE utf8mb4_unicode_ci
 AND esa.active_status=1
LEFT JOIN employee_mapping_master emm ON emm.employee_code=esa.employee_code AND emm.active_status=1;

CREATE OR REPLACE VIEW v_call_master_outbound_kpi AS
SELECT cd.id AS source_call_id,'Outbound' AS source_type,CAST(cd.client_id AS CHAR) AS client_id,pm.process_name,pm.business_lob,pm.branch AS branch_short_name,
cd.campaign_id AS campaign_name,cd.LeadID AS lead_id,cd.AgentName AS source_agent_name,esa.employee_code AS agent_employee_code,emm.employee_name AS agent_employee_name,
cd.CallDate AS call_datetime,DATE(cd.CallDate) AS call_date,NULL AS quality_score,NULL AS total_score,NULL AS max_score,'Call Intelligence' AS quality_band,
CASE WHEN cd.SensitiveWordUsed IS NOT NULL AND TRIM(cd.SensitiveWordUsed)<>'' AND LOWER(TRIM(cd.SensitiveWordUsed)) NOT IN ('no','n/a','na','not available') THEN 1
 WHEN cd.Feedback_Category IS NOT NULL AND TRIM(cd.Feedback_Category)<>'' THEN 1 ELSE 0 END AS is_critical_call,
CASE WHEN cd.SensitiveWordUsed IS NOT NULL AND TRIM(cd.SensitiveWordUsed)<>'' AND LOWER(TRIM(cd.SensitiveWordUsed)) NOT IN ('no','n/a','na','not available') THEN 'High'
 WHEN cd.Feedback_Category IS NOT NULL AND TRIM(cd.Feedback_Category)<>'' THEN 'Medium' ELSE 'Normal' END AS alert_severity
FROM db_external.CallDetails cd
LEFT JOIN dashboard_exclusion_rules der
 ON der.source_db='db_external' AND der.source_table='CallDetails' AND der.source_type='Outbound' AND der.active_status=1
 AND CONVERT(der.client_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(cd.client_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
 AND (der.campaign_id IS NULL OR CONVERT(der.campaign_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(cd.campaign_id USING utf8mb4) COLLATE utf8mb4_unicode_ci)
INNER JOIN process_mapping_master pm
 ON CONVERT(pm.dialdesk_client_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(cd.client_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
 AND pm.source_type='Outbound' AND pm.active_status=1
LEFT JOIN employee_source_alias esa
 ON CONVERT(esa.source_agent_name USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(cd.AgentName USING utf8mb4) COLLATE utf8mb4_unicode_ci
 AND esa.active_status=1
LEFT JOIN employee_mapping_master emm ON emm.employee_code=esa.employee_code AND emm.active_status=1
WHERE der.exclusion_id IS NULL;

CREATE OR REPLACE VIEW v_call_master_unified_kpi AS
SELECT source_call_id,CONVERT(source_type USING utf8mb4) COLLATE utf8mb4_unicode_ci AS source_type,CONVERT(client_id USING utf8mb4) COLLATE utf8mb4_unicode_ci AS client_id,
CONVERT(process_name USING utf8mb4) COLLATE utf8mb4_unicode_ci AS process_name,CONVERT(business_lob USING utf8mb4) COLLATE utf8mb4_unicode_ci AS business_lob,
CONVERT(branch_short_name USING utf8mb4) COLLATE utf8mb4_unicode_ci AS branch_short_name,CONVERT(campaign_name USING utf8mb4) COLLATE utf8mb4_unicode_ci AS campaign_name,
CONVERT(lead_id USING utf8mb4) COLLATE utf8mb4_unicode_ci AS lead_id,CONVERT(source_agent_name USING utf8mb4) COLLATE utf8mb4_unicode_ci AS source_agent_name,
CONVERT(agent_employee_code USING utf8mb4) COLLATE utf8mb4_unicode_ci AS agent_employee_code,CONVERT(agent_employee_name USING utf8mb4) COLLATE utf8mb4_unicode_ci AS agent_employee_name,
call_datetime,call_date,quality_score,total_score,max_score,CONVERT(quality_band USING utf8mb4) COLLATE utf8mb4_unicode_ci AS quality_band,is_critical_call,
CONVERT(alert_severity USING utf8mb4) COLLATE utf8mb4_unicode_ci AS alert_severity
FROM v_call_master_inbound_kpi
UNION ALL
SELECT source_call_id,CONVERT(source_type USING utf8mb4) COLLATE utf8mb4_unicode_ci,CONVERT(client_id USING utf8mb4) COLLATE utf8mb4_unicode_ci,
CONVERT(process_name USING utf8mb4) COLLATE utf8mb4_unicode_ci,CONVERT(business_lob USING utf8mb4) COLLATE utf8mb4_unicode_ci,
CONVERT(branch_short_name USING utf8mb4) COLLATE utf8mb4_unicode_ci,CONVERT(campaign_name USING utf8mb4) COLLATE utf8mb4_unicode_ci,
CONVERT(lead_id USING utf8mb4) COLLATE utf8mb4_unicode_ci,CONVERT(source_agent_name USING utf8mb4) COLLATE utf8mb4_unicode_ci,
CONVERT(agent_employee_code USING utf8mb4) COLLATE utf8mb4_unicode_ci,CONVERT(agent_employee_name USING utf8mb4) COLLATE utf8mb4_unicode_ci,
call_datetime,call_date,quality_score,total_score,max_score,CONVERT(quality_band USING utf8mb4) COLLATE utf8mb4_unicode_ci,is_critical_call,
CONVERT(alert_severity USING utf8mb4) COLLATE utf8mb4_unicode_ci
FROM v_call_master_outbound_kpi;
