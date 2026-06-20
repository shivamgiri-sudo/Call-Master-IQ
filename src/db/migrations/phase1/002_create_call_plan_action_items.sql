CREATE TABLE IF NOT EXISTS `call_plan_action_items` (
  `item_id`         INT AUTO_INCREMENT PRIMARY KEY,
  `plan_id`         INT NOT NULL,
  `section_title`   VARCHAR(100),
  `action_text`     TEXT NOT NULL,
  `owner_role`      VARCHAR(50),
  `due_date`        DATE,
  `success_metric`  VARCHAR(200),
  `item_status`     ENUM('pending','in_progress','completed','overdue') DEFAULT 'pending',
  `completed_at`    TIMESTAMP NULL,
  `created_at`      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`plan_id`) REFERENCES `call_plan_of_action`(`plan_id`) ON DELETE CASCADE,
  INDEX `idx_plan` (`plan_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
