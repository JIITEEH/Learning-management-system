// SQL for the dashboard: small summaries across every course an account is linked to. Each
// function is one query, however many courses there are.
//
// "Visible courses" follow the rule in permission-rules/access.js: courses the account teaches,
// plus those it takes (not dropped) once they are out of draft; every course for an account that
// oversees them all.
import { query, queryOne } from '../database/index.js';

const VISIBLE_COURSE = `
  (:seesAll
   OR c.instructor_id = :userId
   OR (c.status <> 'draft' AND EXISTS (
        SELECT 1 FROM enrollments e
         WHERE e.course_id = c.id AND e.user_id = :userId AND e.status <> 'dropped')))
`;

// The courses a student takes, with how many lessons each has and how many they have finished
export function studentCourses(userId) {
  return query(
    `SELECT c.id, c.code, c.title,
            (SELECT COUNT(*) FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = c.id) AS lesson_count,
            (SELECT COUNT(*) FROM lesson_progress p JOIN lessons l ON l.id = p.lesson_id JOIN modules m ON m.id = l.module_id
              WHERE m.course_id = c.id AND p.user_id = :userId AND p.completed_at IS NOT NULL) AS lessons_done
       FROM courses c
       JOIN enrollments e ON e.course_id = c.id AND e.user_id = :userId AND e.status <> 'dropped'
      WHERE c.status <> 'draft'
      ORDER BY c.title`,
    { userId },
  );
}

// Assignments a student has not handed in, in open courses, soonest due first (overdue ones
// first of all). Only those with a due date: "due soon" means nothing without one.
export function studentDueSoon(userId, limit = 8) {
  return query(
    `SELECT a.id, a.title, a.due_at, c.id AS course_id, c.code AS course_code
       FROM assignments a
       JOIN courses c ON c.id = a.course_id AND c.status = 'published'
       JOIN enrollments e ON e.course_id = c.id AND e.user_id = :userId AND e.status = 'active'
      WHERE a.due_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id = a.id AND s.user_id = :userId)
      ORDER BY a.due_at
      LIMIT :limit`,
    // LIMIT takes a placeholder like any other value; MySQL's prepared statements want it as text
    { userId, limit: String(limit) },
  );
}

// A student's most recently returned grades
export function studentRecentGrades(userId, limit = 5) {
  return query(
    `SELECT s.id, s.score, s.graded_at, a.id AS assignment_id, a.title, a.max_score,
            c.id AS course_id, c.code AS course_code
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN courses c ON c.id = a.course_id
      WHERE s.user_id = :userId AND s.status = 'returned'
      ORDER BY s.graded_at DESC
      LIMIT :limit`,
    { userId, limit: String(limit) },
  );
}

// For someone who teaches (or oversees): assignments with work waiting for a score
export function workToGrade(userId, { seesAll }, limit = 8) {
  return query(
    `SELECT a.id, a.title, c.id AS course_id, c.code AS course_code, COUNT(*) AS waiting
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN courses c ON c.id = a.course_id
      WHERE s.status = 'submitted' AND (:seesAll OR c.instructor_id = :userId)
      GROUP BY a.id, a.title, c.id, c.code
      ORDER BY MIN(s.submitted_at)
      LIMIT :limit`,
    { userId, seesAll: seesAll ? 1 : 0, limit: String(limit) },
  );
}

// Deadlines still ahead in courses someone teaches (or oversees)
export function upcomingDeadlines(userId, { seesAll }, limit = 5) {
  return query(
    `SELECT a.id, a.title, a.due_at, c.id AS course_id, c.code AS course_code
       FROM assignments a
       JOIN courses c ON c.id = a.course_id
      WHERE a.due_at >= UTC_TIMESTAMP() AND (:seesAll OR c.instructor_id = :userId)
      ORDER BY a.due_at
      LIMIT :limit`,
    { userId, seesAll: seesAll ? 1 : 0, limit: String(limit) },
  );
}

// The newest announcements across every course this account can see
export function recentAnnouncements(userId, { seesAll }, limit = 5) {
  return query(
    `SELECT n.id, n.title, n.created_at, c.id AS course_id, c.code AS course_code
       FROM announcements n
       JOIN courses c ON c.id = n.course_id
      WHERE ${VISIBLE_COURSE}
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT :limit`,
    { userId, seesAll: seesAll ? 1 : 0, limit: String(limit) },
  );
}

// Totals for an administrator
export function siteTotals() {
  return queryOne(
    `SELECT (SELECT COUNT(*) FROM users) AS accounts,
            (SELECT COUNT(*) FROM users WHERE status = 'pending') AS pending_accounts,
            (SELECT COUNT(*) FROM courses) AS courses,
            (SELECT COUNT(*) FROM courses WHERE status = 'published') AS open_courses`,
  );
}
