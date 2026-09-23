-- 04 · Assessment
--
-- Assignments and the work handed in against them. One submission per person
-- per assignment: resubmitting updates the existing row rather than adding a
-- second. Submitted and graded times are recorded by the server, never taken
-- from the browser. Attachments are not here -- they live in 05_files with
-- owner_type = 'submission'.
--
-- Tables: assignments, submissions
-- Depends on: 01_identity (users), 02_catalog (courses)

CREATE TABLE assignments (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id    INT UNSIGNED NOT NULL,
  title        VARCHAR(200) NOT NULL,
  instructions TEXT NULL,
  due_at       DATETIME NULL,
  max_score    DECIMAL(6, 2) NOT NULL DEFAULT 100.00,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_assignments_course_due (course_id, due_at),
  CONSTRAINT fk_assignments_course
    FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE submissions (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  assignment_id  INT UNSIGNED NOT NULL,
  user_id        INT UNSIGNED NOT NULL,
  body           MEDIUMTEXT NULL,
  score          DECIMAL(6, 2) NULL,
  feedback       TEXT NULL,
  status         ENUM('submitted', 'graded', 'returned') NOT NULL DEFAULT 'submitted',
  submitted_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  graded_at      TIMESTAMP NULL DEFAULT NULL,
  graded_by      INT UNSIGNED NULL,
  PRIMARY KEY (id),
  -- One submission per person per assignment; resubmitting updates the row.
  -- Attachments live in `files` with owner_type = 'submission'.
  UNIQUE KEY uq_submissions_assignment_user (assignment_id, user_id),
  KEY idx_submissions_user (user_id),
  CONSTRAINT fk_submissions_assignment
    FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE,
  CONSTRAINT fk_submissions_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_submissions_grader
    FOREIGN KEY (graded_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
