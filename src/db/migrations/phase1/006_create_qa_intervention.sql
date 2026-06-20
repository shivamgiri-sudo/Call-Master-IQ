CREATE TABLE IF NOT EXISTS `qa_intervention` (
  `intervention_id`        INT AUTO_INCREMENT PRIMARY KEY,
  `analyst_employee_code`  VARCHAR(50) NOT NULL,
  `qa_user_id`             INT NOT NULL,
  `intervention_type`      ENUM('escalation','notification','formal_warning','watch_list') NOT NULL,
  `reason`                 TEXT,
  `process_name`           VARCHAR(100),
  `call_reference`         VARCHAR(100),
  `created_at`             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_analyst`  (`analyst_employee_code`),
  INDEX `idx_qa_user`  (`qa_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
