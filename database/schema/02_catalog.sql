-- 02 · Catalog
--
-- The teaching material itself: a course holds ordered modules, and a module
-- holds ordered lessons. `position` is what the ordering is read from, not
-- the insertion order, so content can be rearranged without renumbering ids.
--
-- Tables: courses, modules, lessons
-- Depends on: 01_identity (courses.instructor_id -> users.id)

-- `code` is the public catalogue code a school prints ("CS101"). `join_code`
-- is the secret an instructor hands to their class so students can enroll
-- themselves; it is random, and can be replaced if it leaks, without the
-- course's public code changing.
CREATE TABLE courses (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code           VARCHAR(32) NOT NULL,
  join_code      CHAR(8) NOT NULL,
  title          VARCHAR(200) NOT NULL,
  description    TEXT NULL,
  instructor_id  INT UNSIGNED NULL,
  status         ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_courses_code (code),
  UNIQUE KEY uq_courses_join_code (join_code),
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
