// SQL for lesson progress (the lesson_progress table, schema/03_enrollment.sql): which lessons each
// student has marked as done.
import { query } from '../database/index.js';

// The ids of the lessons in a course that this account has finished, as a Set
export async function completedInCourse(userId, courseId) {
  const rows = await query(
    `SELECT p.lesson_id
       FROM lesson_progress p
       JOIN lessons l ON l.id = p.lesson_id
       JOIN modules m ON m.id = l.module_id
      WHERE p.user_id = :userId AND m.course_id = :courseId AND p.completed_at IS NOT NULL`,
    { userId, courseId },
  );
  return new Set(rows.map((row) => row.lesson_id));
}

// Marks a lesson done (recording when) or not done. The table allows one row per person per
// lesson, so marking it done twice updates the same row instead of failing.
export function setCompleted(userId, lessonId, completed) {
  return query(
    `INSERT INTO lesson_progress (user_id, lesson_id, completed_at)
     VALUES (:userId, :lessonId, IF(:completed, CURRENT_TIMESTAMP, NULL))
     ON DUPLICATE KEY UPDATE completed_at = IF(:completed, COALESCE(completed_at, CURRENT_TIMESTAMP), NULL)`,
    { userId, lessonId, completed: completed ? 1 : 0 },
  );
}
