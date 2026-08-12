CREATE DATABASE IF NOT EXISTS interview_bot;
USE interview_bot;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_name VARCHAR(255) NOT NULL DEFAULT 'Guest',
  company VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS responses (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  mode VARCHAR(50) NOT NULL DEFAULT 'send',
  heading VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fixed_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_number INT NOT NULL,
  question_text TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO fixed_questions (question_number, question_text, sort_order) VALUES
(1, 'Tell me about yourself.', 1),
(2, 'Why do you want to work here?', 2),
(3, 'What are your strengths and weaknesses?', 3),
(4, 'Describe a challenging project you worked on.', 4),
(5, 'How do you handle conflict in a team?', 5),
(6, 'Where do you see yourself in 5 years?', 6),
(7, 'Why are you leaving your current role?', 7),
(8, 'Describe your experience with system design.', 8),
(9, 'How do you prioritize tasks under pressure?', 9),
(10, 'Are you willing to relocate if required?', 10);
