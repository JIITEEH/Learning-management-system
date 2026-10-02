-- Adds quizzes (roadmap step 10) to a database built before them. A fresh
-- database gets the same from schema/04_assessment.sql and the seed files, and
-- records this migration as already applied.
--
-- Safe to run on a database that already has any part of it: IF NOT EXISTS and
-- INSERT IGNORE skip what is already there.

CREATE TABLE IF NOT EXISTS quizzes (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id           INT UNSIGNED NOT NULL,
  title               VARCHAR(200) NOT NULL,
  instructions        TEXT NULL,
  -- When the quiz closes, in UTC like an assignment's due date; NULL stays open
  due_at              DATETIME NULL,
  -- Minutes from starting an attempt to its end; NULL has no limit
  time_limit_minutes  SMALLINT UNSIGNED NULL,
  max_attempts        TINYINT UNSIGNED NOT NULL DEFAULT 1,
  -- Students see a quiz only once it is published, so it can be built first
  is_published        TINYINT(1) NOT NULL DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_quizzes_course_due (course_id, due_at),
  CONSTRAINT fk_quizzes_course
    FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- kind: 'single' (one right option), 'multiple' (every right option and no
-- wrong one), 'true_false' (two options, True and False), 'short' (typed;
-- its options are the accepted answers, compared ignoring case and spaces)
CREATE TABLE IF NOT EXISTS quiz_questions (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  quiz_id    INT UNSIGNED NOT NULL,
  position   SMALLINT UNSIGNED NOT NULL,
  kind       ENUM('single', 'multiple', 'true_false', 'short') NOT NULL,
  prompt     TEXT NOT NULL,
  points     DECIMAL(6, 2) NOT NULL DEFAULT 1.00,
  PRIMARY KEY (id),
  KEY idx_quiz_questions_quiz (quiz_id, position),
  CONSTRAINT fk_quiz_questions_quiz
    FOREIGN KEY (quiz_id) REFERENCES quizzes (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_options (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  question_id  INT UNSIGNED NOT NULL,
  position     SMALLINT UNSIGNED NOT NULL,
  label        VARCHAR(500) NOT NULL,
  is_correct   TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_quiz_options_question (question_id, position),
  CONSTRAINT fk_quiz_options_question
    FOREIGN KEY (question_id) REFERENCES quiz_questions (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- One row per try. ends_at is fixed when the attempt starts (the time limit,
-- or the closing time if that comes sooner) so the server, not the browser,
-- decides when time is up. score stays NULL until it is handed in.
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  quiz_id         INT UNSIGNED NOT NULL,
  user_id         INT UNSIGNED NOT NULL,
  attempt_number  TINYINT UNSIGNED NOT NULL,
  started_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at         DATETIME NULL,
  submitted_at    TIMESTAMP NULL DEFAULT NULL,
  score           DECIMAL(6, 2) NULL,
  max_score       DECIMAL(6, 2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_quiz_attempts_number (quiz_id, user_id, attempt_number),
  KEY idx_quiz_attempts_user (user_id),
  CONSTRAINT fk_quiz_attempts_quiz
    FOREIGN KEY (quiz_id) REFERENCES quizzes (id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_attempts_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- What was answered, and how it was marked. option_ids lists the chosen
-- options ('12,15'); text_answer holds a typed answer.
CREATE TABLE IF NOT EXISTS quiz_answers (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  attempt_id      INT UNSIGNED NOT NULL,
  question_id     INT UNSIGNED NOT NULL,
  option_ids      VARCHAR(255) NOT NULL DEFAULT '',
  text_answer     VARCHAR(500) NOT NULL DEFAULT '',
  is_correct      TINYINT(1) NOT NULL DEFAULT 0,
  points_awarded  DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id),
  UNIQUE KEY uq_quiz_answers_question (attempt_id, question_id),
  CONSTRAINT fk_quiz_answers_attempt
    FOREIGN KEY (attempt_id) REFERENCES quiz_attempts (id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_answers_question
    FOREIGN KEY (question_id) REFERENCES quiz_questions (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT IGNORE INTO permissions (code, category, description) VALUES
  ('quiz.read',   'assessment', 'View quizzes in courses they can see.'),
  ('quiz.manage', 'assessment', 'Create and edit quizzes, and see everyone''s results.'),
  ('quiz.take',   'assessment', 'Take quizzes.');

-- The same grants as seed/03_role_permissions.sql
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE (r.name = 'admin' AND p.code IN ('quiz.read', 'quiz.manage', 'quiz.take'))
   OR (r.name = 'instructor' AND p.code IN ('quiz.read', 'quiz.manage'))
   OR (r.name = 'student' AND p.code IN ('quiz.read', 'quiz.take'));
