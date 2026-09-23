-- 03 · Role -> permission grants
--
-- Which codes each shipped role holds. The grants are written as SELECTs
-- against roles and permissions rather than as literal ids, so the file stays
-- correct however the auto-increment values fall.
--
-- Depends on: 01_roles, 02_permissions

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
