CREATE TABLE IF NOT EXISTS `app_notification` (
  `notification_id`     INT AUTO_INCREMENT PRIMARY KEY,
  `recipient_user_id`   INT NOT NULL,
  `sender_user_id`      INT,
  `type`                VARCHAR(50),
  `title`               VARCHAR(200) NOT NULL,
  `body`                TEXT,
  `read_at`             TIMESTAMP NULL,
  `created_at`          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_recipient` (`recipient_user_id`),
  INDEX `idx_unread`    (`recipient_user_id`, `read_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
