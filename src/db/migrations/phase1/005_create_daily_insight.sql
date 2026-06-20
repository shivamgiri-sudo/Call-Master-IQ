CREATE TABLE IF NOT EXISTS `daily_insight` (
  `insight_id`    INT AUTO_INCREMENT PRIMARY KEY,
  `insight_date`  DATE NOT NULL,
  `scope_type`    ENUM('analyst','branch','process','company','tq','hr') NOT NULL,
  `scope_value`   VARCHAR(100) NOT NULL,
  `insight_json`  LONGTEXT,
  `generated_by`  VARCHAR(20) DEFAULT 'SQL',
  `created_at`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_insight` (`insight_date`, `scope_type`, `scope_value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
