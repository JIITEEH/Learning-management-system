-- Learning Management System — seed data
--
-- Structural rows only: the roles and permission codes the server checks
-- against. No accounts, courses, or content — those are real data and get
-- created through the application.
--
-- Run after schema.sql:
--   mysql -u root -p lms < database/seed.sql

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

INSERT INTO roles (name, label, description, is_system) VALUES
  ('admin',      'Administrator', 'Full access to every part of the system.', 1),
  ('instructor', 'Instructor',    'Owns courses, authors content, grades work.', 1),
  ('student',    'Student',       'Enrolls in courses and submits work.', 1);

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO permissions (code, category, description) VALUES
  ('user.read',         'accounts',  'View accounts.'),
  ('user.create',       'accounts',  'Create accounts.'),
  ('user.update',       'accounts',  'Edit accounts.'),
  ('user.delete',       'accounts',  'Delete accounts.'),
  ('role.manage',       'accounts',  'Create roles and assign permissions.'),

  ('course.read',       'courses',   'View courses.'),
  ('course.create',     'courses',   'Create courses.'),
  ('course.update',     'courses',   'Edit courses.'),
  ('course.delete',     'courses',   'Delete courses.'),
  ('course.publish',    'courses',   'Publish or archive a course.'),

  ('lesson.read',       'content',   'View lessons.'),
  ('lesson.manage',     'content',   'Create, edit, and remove lessons and modules.'),

  ('enrollment.read',   'enrollment','View enrollment records.'),
  ('enrollment.manage', 'enrollment','Enroll and unenroll students.'),
  ('enrollment.self',   'enrollment','Enroll oneself in an open course.'),

  ('assignment.read',   'assessment','View assignments.'),
  ('assignment.manage', 'assessment','Create and edit assignments.'),
  ('submission.create', 'assessment','Submit work.'),
  ('submission.read',   'assessment','View submissions from others.'),
  ('submission.grade',  'assessment','Score and return submissions.'),

  ('file.upload',       'files',     'Upload files.'),
  ('file.read',         'files',     'Download files they have access to.'),
  ('file.delete',       'files',     'Delete uploaded files.'),

  ('schedule.read',     'schedules', 'View schedules.'),
  ('schedule.manage',   'schedules', 'Create and edit course schedules.');

-- ---------------------------------------------------------------------------
-- Role → permission grants
-- ---------------------------------------------------------------------------

-- Administrator: everything.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'admin';

-- Instructor: owns course content and assessment, but not account admin.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE r.name = 'instructor' AND p.code IN (
  'user.read',
  'course.read', 'course.create', 'course.update', 'course.publish',
  'lesson.read', 'lesson.manage',
  'enrollment.read', 'enrollment.manage',
  'assignment.read', 'assignment.manage',
  'submission.read', 'submission.grade',
  'file.upload', 'file.read', 'file.delete',
  'schedule.read', 'schedule.manage'
);

-- Student: consumes content and submits work.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE r.name = 'student' AND p.code IN (
  'course.read',
  'lesson.read',
  'enrollment.self',
  'assignment.read',
  'submission.create',
  'file.upload', 'file.read',
  'schedule.read'
);
