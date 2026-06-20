CREATE TABLE IF NOT EXISTS `call_plan_glide_milestones` (
  `milestone_id`    INT AUTO_INCREMENT PRIMARY KEY,
  `plan_id`         INT NOT NULL,
  `week_number`     INT NOT NULL,
  `week_start_date` DATE,
  `target_score`    DECIMAL(5,2),
  `actual_score`    DECIMAL(5,2) NULL,
  `on_track`        TINYINT(1) NULL,
  `created_at`      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`plan_id`) REFERENCES `call_plan_of_action`(`plan_id`) ON DELETE CASCADE,
  INDEX `idx_plan_week` (`plan_id`, `week_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
