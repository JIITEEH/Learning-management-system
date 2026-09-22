-- Learning Management System — schema
-- MySQL 8. Run once against an empty database:
--   mysql -u root -p lms < database/schema.sql

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS schedules;
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS lesson_progress;
DROP TABLE IF EXISTS lessons;
DROP TABLE IF EXISTS modules;
DROP TABLE IF EXISTS enrollments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS user_permissions;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

SET FOREIGN_KEY_CHECKS = 1;

-- ===========================================================================
-- FOUNDATION: roles and permissions
--
-- Roles are rows, not an ENUM, so a new role can be added without a schema
-- change. A role carries a set of permissions; a permission is a bare code
-- such as 'course.create' that the server checks before acting.
-- ===========================================================================

CREATE TABLE roles (
  id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(40) NOT NULL,
  label        VARCHAR(80) NOT NULL,
  description  VARCHAR(255) NULL,
  is_system    TINYINT(1) NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE permissions (
  id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code         VARCHAR(64) NOT NULL,
  category     VARCHAR(40) NOT NULL,
  description  VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_code (code),
  KEY idx_permissions_category (category)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE role_permissions (
  role_id        SMALLINT UNSIGNED NOT NULL,
  permission_id  SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_role_permissions_permission (permission_id),
  CONSTRAINT fk_role_permissions_role
    FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ===========================================================================
-- FOUNDATION: accounts
-- ===========================================================================

CREATE TABLE users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email          VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  full_name      VARCHAR(160) NOT NULL,
  role_id        SMALLINT UNSIGNED NOT NULL,
  status         ENUM('pending', 'active', 'suspended') NOT NULL DEFAULT 'pending',
  last_login_at  TIMESTAMP NULL DEFAULT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role_id),
  KEY idx_users_status (status),
  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Per-account grant or revoke layered on top of the role. `effect` lets an
-- individual be denied something their role would otherwise allow.
CREATE TABLE user_permissions (
  user_id        INT UNSIGNED NOT NULL,
  permission_id  SMALLINT UNSIGNED NOT NULL,
  effect         ENUM('allow', 'deny') NOT NULL DEFAULT 'allow',
  granted_by     INT UNSIGNED NULL,
  granted_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, permission_id),
  KEY idx_user_permissions_permission (permission_id),
  CONSTRAINT fk_user_permissions_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_permissions_granter
    FOREIGN KEY (granted_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ===========================================================================
-- Courses and their contents
-- ===========================================================================

CREATE TABLE courses (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code           VARCHAR(32) NOT NULL,
  title          VARCHAR(200) NOT NULL,
  description    TEXT NULL,
  instructor_id  INT UNSIGNED NULL,
  status         ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_courses_code (code),
  KEY idx_courses_instructor (instructor_id),
  KEY idx_courses_status (status),
  CONSTRAINT fk_courses_instructor
    FOREIGN KEY (instructor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE modules (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id    INT UNSIGNED NOT NULL,
  title        VARCHAR(200) NOT NULL,
  position     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_modules_course_position (course_id, position),
  CONSTRAINT fk_modules_course
    FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE lessons (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  module_id    INT UNSIGNED NOT NULL,
  title        VARCHAR(200) NOT NULL,
  content      MEDIUMTEXT NULL,
  position     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_lessons_module_position (module_id, position),
  CONSTRAINT fk_lessons_module
    FOREIGN KEY (module_id) REFERENCES modules (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ===========================================================================
-- Enrollment and progress
-- ===========================================================================

CREATE TABLE enrollments (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  course_id    INT UNSIGNED NOT NULL,
  status       ENUM('active', 'completed', 'dropped') NOT NULL DEFAULT 'active',
  enrolled_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  -- One enrollment row per person per course.
  UNIQUE KEY uq_enrollments_user_course (user_id, course_id),
  KEY idx_enrollments_course (course_id),
  CONSTRAINT fk_enrollments_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_enrollments_course
    FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE lesson_progress (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NOT NULL,
  lesson_id     INT UNSIGNED NOT NULL,
  completed_at  TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_progress_user_lesson (user_id, lesson_id),
  KEY idx_progress_lesson (lesson_id),
  CONSTRAINT fk_progress_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_lesson
    FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ===========================================================================
-- FOUNDATION: file uploads
--
-- One table for every upload in the system. `owner_type` / `owner_id` say
-- what the file is attached to, so submissions, lessons, and courses can all
-- carry attachments without a table each. Files are stored on disk under
-- storage/uploads; only the metadata lives here.
-- ===========================================================================

CREATE TABLE files (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uploaded_by    INT UNSIGNED NULL,
  owner_type     ENUM('submission', 'assignment', 'lesson', 'course', 'user') NOT NULL,
  owner_id       INT UNSIGNED NULL,
  original_name  VARCHAR(255) NOT NULL,
  stored_name    VARCHAR(255) NOT NULL,
  mime_type      VARCHAR(127) NOT NULL,
  size_bytes     INT UNSIGNED NOT NULL,
  checksum       CHAR(64) NULL,
  uploaded_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_files_stored_name (stored_name),
  KEY idx_files_owner (owner_type, owner_id),
  KEY idx_files_uploader (uploaded_by),
  CONSTRAINT fk_files_uploader
    FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ===========================================================================
-- FOUNDATION: schedules
--
-- A recurring weekly meeting for a course, bounded by an effective date
-- range so a timetable can change mid-term without losing its history.
-- ===========================================================================

CREATE TABLE schedules (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id       INT UNSIGNED NOT NULL,
  title           VARCHAR(200) NULL,
  day_of_week     TINYINT UNSIGNED NOT NULL COMMENT '0 = Sunday … 6 = Saturday',
  starts_at       TIME NOT NULL,
  ends_at         TIME NOT NULL,
  location        VARCHAR(160) NULL,
  effective_from  DATE NOT NULL,
  effective_to    DATE NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_schedules_course_day (course_id, day_of_week),
  KEY idx_schedules_effective (effective_from, effective_to),
  CONSTRAINT fk_schedules_course
    FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  CONSTRAINT chk_schedules_day CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT chk_schedules_time CHECK (ends_at > starts_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ===========================================================================
-- Assessment
-- ===========================================================================

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
