CREATE TABLE IF NOT EXISTS `qa_watch_list` (
  `watch_list_id`          INT AUTO_INCREMENT PRIMARY KEY,
  `analyst_employee_code`  VARCHAR(50) NOT NULL UNIQUE,
  `added_by_user_id`       INT NOT NULL,
  `reason`                 TEXT,
  `active`                 TINYINT(1) DEFAULT 1,
  `created_at`             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_analyst` (`analyst_employee_code`),
  INDEX `idx_active`  (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
