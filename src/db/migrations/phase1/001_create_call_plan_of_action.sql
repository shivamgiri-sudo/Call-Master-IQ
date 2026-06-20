CREATE TABLE IF NOT EXISTS `call_plan_of_action` (
  `plan_id`              INT AUTO_INCREMENT PRIMARY KEY,
  `scope_type`           ENUM('analyst','process','branch','company') NOT NULL,
  `scope_value`          VARCHAR(100) NOT NULL,
  `trigger_reason`       TEXT,
  `trigger_metric`       VARCHAR(100),
  `trigger_value`        DECIMAL(8,2),
  `generated_by`         VARCHAR(20) DEFAULT 'AI',
  `ai_status`            ENUM('success','failed','timeout','not_configured') NULL,
  `status`               ENUM('active','completed','dismissed') DEFAULT 'active',
  `ai_content`           LONGTEXT,
  `created_by_user_id`   INT NULL,
  `created_at`           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_scope`  (`scope_type`, `scope_value`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
