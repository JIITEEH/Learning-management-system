// The dashboard: one reply with every section this account's dashboard shows. Which sections are
// included follows the account's permissions and courses, so each role gets its own dashboard
// from the same address:
//   takes courses          its courses with lesson progress, work due soon, recently returned grades
//   teaches or oversees    work waiting to be graded, upcoming deadlines
//   manages accounts       accounts awaiting approval and site totals
//   everyone               the latest announcements from their courses
import * as Dashboard from '../database-queries/dashboardModel.js';
import * as Permission from '../database-queries/permissionModel.js';

export async function getDashboard(req, res) {
  const userId = req.user.id;
  const codes = await Permission.effectiveCodes(userId);
  const seesAll = codes.has('course.manage_any');
  const grades = codes.has('submission.grade');

  // Independent queries, so they run at the same time rather than one after another
  const [courses, dueSoon, recentGrades, toGrade, deadlines, announcements, totals] = await Promise.all([
    codes.has('enrollment.self') ? Dashboard.studentCourses(userId) : null,
    codes.has('submission.create') ? Dashboard.studentDueSoon(userId) : null,
    codes.has('submission.create') ? Dashboard.studentRecentGrades(userId) : null,
    grades ? Dashboard.workToGrade(userId, { seesAll }) : null,
    codes.has('assignment.manage') ? Dashboard.upcomingDeadlines(userId, { seesAll }) : null,
    codes.has('announcement.read') ? Dashboard.recentAnnouncements(userId, { seesAll }) : null,
    codes.has('user.read') ? Dashboard.siteTotals() : null,
  ]);

  res.json({
    courses: courses?.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      lessonCount: Number(row.lesson_count),
      lessonsDone: Number(row.lessons_done),
    })),
    dueSoon: dueSoon?.map((row) => ({ id: row.id, title: row.title, dueAt: row.due_at, courseId: row.course_id, courseCode: row.course_code })),
    recentGrades: recentGrades?.map((row) => ({
      assignmentId: row.assignment_id,
      title: row.title,
      score: Number(row.score),
      maxScore: Number(row.max_score),
      gradedAt: row.graded_at,
      courseId: row.course_id,
      courseCode: row.course_code,
    })),
    toGrade: toGrade?.map((row) => ({ id: row.id, title: row.title, waiting: Number(row.waiting), courseId: row.course_id, courseCode: row.course_code })),
    deadlines: deadlines?.map((row) => ({ id: row.id, title: row.title, dueAt: row.due_at, courseId: row.course_id, courseCode: row.course_code })),
    announcements: announcements?.map((row) => ({ id: row.id, title: row.title, createdAt: row.created_at, courseId: row.course_id, courseCode: row.course_code })),
    totals: totals && {
      accounts: Number(totals.accounts),
      pendingAccounts: Number(totals.pending_accounts),
      courses: Number(totals.courses),
      openCourses: Number(totals.open_courses),
    },
  });
}
