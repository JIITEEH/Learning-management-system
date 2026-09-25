-- Adds course announcements (roadmap step 9) to a database built before them.
-- A fresh database gets the same from schema/07_communication.sql and the seed
-- files, and records this migration as already applied.
--
-- Written to be safe to run on a database that already has any part of it:
-- IF NOT EXISTS and INSERT IGNORE skip what is already there.

CREATE TABLE IF NOT EXISTS announcements (
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
  CONSTRAINT fk_announcements_author
    FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT IGNORE INTO permissions (code, category, description) VALUES
  ('announcement.read',   'communication', 'Read announcements in courses they can see.'),
  ('announcement.manage', 'communication', 'Post, edit, and remove announcements in courses they manage.');

-- The same grants as seed/03_role_permissions.sql: administrators everything,
-- instructors both, students read only
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE (r.name IN ('admin', 'instructor') AND p.code IN ('announcement.read', 'announcement.manage'))
   OR (r.name = 'student' AND p.code = 'announcement.read');
