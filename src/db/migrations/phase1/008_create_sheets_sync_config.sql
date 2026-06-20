CREATE TABLE IF NOT EXISTS `sheets_sync_config` (
  `config_id`       INT AUTO_INCREMENT PRIMARY KEY,
  `sheet_id`        VARCHAR(100) NOT NULL,
  `tab_name`        VARCHAR(100) NOT NULL,
  `col_mapping`     JSON,
  `client_id`       VARCHAR(100),
  `process_name`    VARCHAR(100),
  `schedule`        VARCHAR(50) DEFAULT 'nightly',
  `is_active`       TINYINT(1) DEFAULT 1,
  `last_synced_at`  TIMESTAMP NULL,
  `last_row_count`  INT NULL,
  `created_at`      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_sheet` (`sheet_id`, `tab_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
