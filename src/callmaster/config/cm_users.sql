-- Run in MySQL Workbench against Shivamgiri database
CREATE TABLE IF NOT EXISTS cm_users (
  user_id       INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(150) NOT NULL,
  role          ENUM('admin','ceo','tq_head','branch_manager','process_manager','analyst') NOT NULL,
  branch_ids    JSON,
  process_ids   JSON,
  employee_code VARCHAR(100),
  active        TINYINT DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed admin user (password: Admin@2026)
-- Generate hash separately with: node -e "const b=require('bcryptjs');b.hash('Admin@2026',10).then(h=>console.log(h))"
-- Then replace the hash below
INSERT INTO cm_users (username, password_hash, full_name, role, branch_ids, process_ids)
VALUES (
  'admin',
  '$2b$10$86/YvLLhzRCettpizUt2ve/JDZ3I1b.lIpjRQrwUqQQD2taVjuUYO',
  'System Administrator',
  'admin',
  JSON_ARRAY('*'),
  JSON_ARRAY('*')
)
ON DUPLICATE KEY UPDATE username = username;
