-- 01 · Roles
--
-- The three roles the system ships with. `is_system` marks them as ones an
-- administrator may not delete, because the application's own checks assume
-- they exist. Additional roles are created through the application.

INSERT INTO roles (name, label, description, is_system) VALUES
  ('admin',      'Administrator', 'Full access to every part of the system.', 1),
  ('instructor', 'Instructor',    'Owns courses, authors content, grades work.', 1),
  ('student',    'Student',       'Enrolls in courses and submits work.', 1);
