-- LexicalSpark: New tables for Shivamgiri (read/write layer)
-- Run against the Shivamgiri database

USE Shivamgiri;

-- ─────────────────────────────────────────────
-- 1. Configurable audit prompts per client/LOB/process
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_prompt_config (
  prompt_id     INT AUTO_INCREMENT PRIMARY KEY,
  client_id     VARCHAR(50) NOT NULL,
  process_name  VARCHAR(255),
  business_lob  VARCHAR(100),
  source_type   ENUM('Inbound','Outbound','Chat','Email') NOT NULL,
  prompt_version INT DEFAULT 1,
  system_prompt MEDIUMTEXT NOT NULL,
  is_active     TINYINT DEFAULT 1,
  created_by    VARCHAR(100),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by    VARCHAR(100),
  updated_at    TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_apc_client (client_id),
  INDEX idx_apc_lob (business_lob),
  INDEX idx_apc_active (is_active)
);

-- ─────────────────────────────────────────────
-- 2. Manual QA audit entries
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manual_qa_audit (
  audit_id                         INT AUTO_INCREMENT PRIMARY KEY,
  source_call_id                   BIGINT NOT NULL,
  source_type                      ENUM('Inbound','Outbound','Chat','Email') NOT NULL,
  auditor_user_id                  INT NOT NULL,
  client_id                        VARCHAR(50) NOT NULL,
  process_name                     VARCHAR(255),
  business_lob                     VARCHAR(100),
  campaign_name                    VARCHAR(100),
  call_date                        DATE,
  agent_employee_code              VARCHAR(100),
  -- 19 QA parameters (0=fail, 1=pass, NULL=not applicable)
  call_answered_within_5_seconds   TINYINT,
  customer_concern_acknowledged    TINYINT,
  professionalism_maintained       TINYINT,
  assurance_or_appreciation_provided TINYINT,
  pronunciation_and_clarity        TINYINT,
  enthusiasm_and_no_fumbling       TINYINT,
  active_listening                 TINYINT,
  politeness_and_no_sarcasm        TINYINT,
  proper_grammar                   TINYINT,
  accurate_issue_probing           TINYINT,
  proper_hold_procedure            TINYINT,
  proper_transfer_and_language     TINYINT,
  dead_air_under_10_seconds        TINYINT,
  case_escalated_correctly         TINYINT,
  address_recorded_completely      TINYINT,
  correct_and_complete_information TINYINT,
  upselling_or_offers_suggested    TINYINT,
  further_assistance_offered       TINYINT,
  proper_call_closure              TINYINT,
  express_empathy                  TINYINT,
  manual_total_score               INT,
  manual_max_score                 INT,
  manual_quality_percentage        DECIMAL(5,2),
  manual_remarks                   MEDIUMTEXT,
  audit_status                     ENUM('draft','submitted') DEFAULT 'draft',
  created_at                       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at                       TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (auditor_user_id) REFERENCES user_master(user_id),
  INDEX idx_mqa_call (source_call_id),
  INDEX idx_mqa_agent (agent_employee_code),
  INDEX idx_mqa_date (call_date),
  INDEX idx_mqa_status (audit_status),
  INDEX idx_mqa_client (client_id)
);

-- ─────────────────────────────────────────────
-- 3. Calibration sessions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calibration_session (
  session_id              INT AUTO_INCREMENT PRIMARY KEY,
  session_name            VARCHAR(255) NOT NULL,
  client_id               VARCHAR(50) NOT NULL,
  process_name            VARCHAR(255),
  source_type             ENUM('Inbound','Outbound') NOT NULL,
  created_by_user_id      INT NOT NULL,
  session_status          ENUM('open','closed') DEFAULT 'open',
  discrepancy_summary     MEDIUMTEXT,
  prompt_improvement_notes MEDIUMTEXT,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_user_id) REFERENCES user_master(user_id),
  INDEX idx_cs_client (client_id),
  INDEX idx_cs_status (session_status)
);

CREATE TABLE IF NOT EXISTS calibration_call (
  calibration_id           INT AUTO_INCREMENT PRIMARY KEY,
  session_id               INT NOT NULL,
  source_call_id           BIGINT NOT NULL,
  manual_audit_id          INT,
  ai_quality_percentage    DECIMAL(5,2),
  manual_quality_percentage DECIMAL(5,2),
  variance                 DECIMAL(5,2),
  parameter_discrepancies  JSON,
  created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES calibration_session(session_id),
  FOREIGN KEY (manual_audit_id) REFERENCES manual_qa_audit(audit_id),
  INDEX idx_cc_session (session_id),
  INDEX idx_cc_call (source_call_id)
);

-- ─────────────────────────────────────────────
-- 4. Coaching content + assignments
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coaching_content (
  coaching_id               INT AUTO_INCREMENT PRIMARY KEY,
  client_id                 VARCHAR(50) NOT NULL,
  process_name              VARCHAR(255),
  business_lob              VARCHAR(100),
  source_type               ENUM('Inbound','Outbound','Chat','Email'),
  defect_parameter          VARCHAR(150),
  coaching_title            VARCHAR(255),
  coaching_body             MEDIUMTEXT,
  example_transcript_excerpt MEDIUMTEXT,
  generated_by              ENUM('AI','Manual') DEFAULT 'AI',
  created_by_user_id        INT,
  active_status             TINYINT DEFAULT 1,
  created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cc_client (client_id),
  INDEX idx_cc_lob (business_lob),
  INDEX idx_cc_defect (defect_parameter),
  INDEX idx_cc_active (active_status)
);

CREATE TABLE IF NOT EXISTS coaching_assignment (
  assignment_id       INT AUTO_INCREMENT PRIMARY KEY,
  coaching_id         INT NOT NULL,
  employee_code       VARCHAR(100) NOT NULL,
  assigned_by_user_id INT NOT NULL,
  completion_status   ENUM('pending','viewed','completed') DEFAULT 'pending',
  assigned_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at        TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (coaching_id) REFERENCES coaching_content(coaching_id),
  INDEX idx_ca_employee (employee_code),
  INDEX idx_ca_status (completion_status)
);

-- ─────────────────────────────────────────────
-- 5. Quality alerts
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_alert (
  alert_id              INT AUTO_INCREMENT PRIMARY KEY,
  alert_type            ENUM('CRITICAL_CALL','QUALITY_DIP','FRAUD_FLAG','SENSITIVE_WORD') NOT NULL,
  severity              ENUM('High','Medium','Low') NOT NULL,
  client_id             VARCHAR(50) NOT NULL,
  process_name          VARCHAR(255),
  branch_short_name     VARCHAR(50),
  agent_employee_code   VARCHAR(100),
  source_call_id        BIGINT,
  source_type           ENUM('Inbound','Outbound'),
  alert_message         TEXT,
  is_acknowledged       TINYINT DEFAULT 0,
  acknowledged_by       INT,
  acknowledged_at       TIMESTAMP NULL DEFAULT NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_qa_client (client_id),
  INDEX idx_qa_type (alert_type),
  INDEX idx_qa_severity (severity),
  INDEX idx_qa_ack (is_acknowledged),
  INDEX idx_qa_created (created_at)
);

-- ─────────────────────────────────────────────
-- 6. Daily performance snapshots (pre-computed)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_performance_snapshot (
  snapshot_id           INT AUTO_INCREMENT PRIMARY KEY,
  snapshot_date         DATE NOT NULL,
  client_id             VARCHAR(50) NOT NULL,
  process_name          VARCHAR(255) NOT NULL DEFAULT '',
  business_lob          VARCHAR(100) NOT NULL DEFAULT '',
  branch_short_name     VARCHAR(50) NOT NULL DEFAULT '',
  source_type           ENUM('Inbound','Outbound','Chat','Email') NOT NULL,
  agent_employee_code   VARCHAR(100) NOT NULL DEFAULT '',
  total_calls           INT DEFAULT 0,
  audited_calls         INT DEFAULT 0,
  avg_quality_score     DECIMAL(5,2),
  calls_above_80        INT DEFAULT 0,
  calls_below_50        INT DEFAULT 0,
  critical_calls        INT DEFAULT 0,
  fraud_flag_calls      INT DEFAULT 0,
  -- parameter failure counts
  fail_call_answered          INT DEFAULT 0,
  fail_concern_acknowledged   INT DEFAULT 0,
  fail_professionalism        INT DEFAULT 0,
  fail_assurance              INT DEFAULT 0,
  fail_clarity                INT DEFAULT 0,
  fail_enthusiasm             INT DEFAULT 0,
  fail_active_listening       INT DEFAULT 0,
  fail_politeness             INT DEFAULT 0,
  fail_grammar                INT DEFAULT 0,
  fail_probing                INT DEFAULT 0,
  fail_hold_procedure         INT DEFAULT 0,
  fail_transfer               INT DEFAULT 0,
  fail_dead_air               INT DEFAULT 0,
  fail_escalation             INT DEFAULT 0,
  fail_address_recorded       INT DEFAULT 0,
  fail_correct_info           INT DEFAULT 0,
  fail_upselling              INT DEFAULT 0,
  fail_further_assistance     INT DEFAULT 0,
  fail_call_closure           INT DEFAULT 0,
  created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_snapshot (snapshot_date, client_id, process_name, branch_short_name, source_type, agent_employee_code),
  INDEX idx_dps_date (snapshot_date),
  INDEX idx_dps_client (client_id),
  INDEX idx_dps_branch (branch_short_name),
  INDEX idx_dps_agent (agent_employee_code)
);
