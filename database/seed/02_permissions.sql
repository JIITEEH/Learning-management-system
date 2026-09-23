-- 02 · Permission codes
--
-- The catalogue of codes the server checks with requirePermission(). A code
-- means nothing until it is listed here, so adding a permission to a route
-- means adding its row to this file and granting it in 03_role_permissions.
--
-- `category` is only used to group the codes on the roles admin screen.

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
