-- 07 · Communication
--
-- Announcements an instructor (or an administrator) posts to one course, for
-- everyone taking it. There is no site-wide announcement: each belongs to a
-- course, and is seen by whoever can see that course.
--
-- Tables: announcements
-- Depends on: 01_identity (announcements.author_id -> users.id),
--             02_catalog (announcements.course_id -> courses.id)

CREATE TABLE announcements (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id    INT UNSIGNED NOT NULL,
  author_id    INT UNSIGNED NULL,
  title        VARCHAR(200) NOT NULL,
  body         TEXT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_announcements_course_created (course_id, created_at),
  CONSTRAINT fk_announcements_course
    FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  -- An announcement outlives its author's account; it then shows no author
  CONSTRAINT fk_announcements_author
    FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
