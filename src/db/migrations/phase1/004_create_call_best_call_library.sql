CREATE TABLE IF NOT EXISTS `call_best_call_library` (
  `library_id`         INT AUTO_INCREMENT PRIMARY KEY,
  `source_call_id`     BIGINT NOT NULL,
  `source_type`        VARCHAR(20),
  `process_name`       VARCHAR(100),
  `branch_short_name`  VARCHAR(50),
  `quality_score`      DECIMAL(5,2),
  `reason_flagged`     VARCHAR(200),
  `flagged_by`         ENUM('AUTO','MANUAL') DEFAULT 'AUTO',
  `flagged_by_user`    INT NULL,
  `active_status`      TINYINT(1) DEFAULT 1,
  `created_at`         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_process` (`process_name`),
  INDEX `idx_branch`  (`branch_short_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
