CREATE TABLE IF NOT EXISTS `sheets_sync_log` (
  `log_id`         INT AUTO_INCREMENT PRIMARY KEY,
  `config_id`      INT NOT NULL,
  `started_at`     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `completed_at`   TIMESTAMP NULL,
  `rows_read`      INT,
  `rows_inserted`  INT,
  `rows_skipped`   INT,
  `rows_errored`   INT,
  `status`         ENUM('pending','success','partial','failed') DEFAULT 'pending',
  `error_message`  TEXT,
  FOREIGN KEY (`config_id`) REFERENCES `sheets_sync_config`(`config_id`) ON DELETE CASCADE,
  INDEX `idx_config` (`config_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
