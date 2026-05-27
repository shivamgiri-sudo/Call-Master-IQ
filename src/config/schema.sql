-- DocCraft SaaS - Database Schema

CREATE DATABASE IF NOT EXISTS doccraft;
USE doccraft;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  plan ENUM('free', 'pro') NOT NULL DEFAULT 'free',
  docs_generated INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  type ENUM('pptx', 'xlsx', 'docx', 'pdf') NOT NULL,
  prompt TEXT NOT NULL,
  file_path VARCHAR(500),
  status ENUM('pending', 'processing', 'done', 'failed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
