// A course's gradebook: every student against every assignment and published quiz, with totals,
// on screen and as CSV. A quiz counts its student's best handed-in score.
// For the course's instructor and administrators; the instructor's view counts graded work even
// before it is returned to students.
import * as Assignment from '../database-queries/assignmentModel.js';
import * as Attempt from '../database-queries/attemptModel.js';
import * as Enrollment from '../database-queries/enrollmentModel.js';
import * as Quiz from '../database-queries/quizModel.js';
import * as Submission from '../database-queries/submissionModel.js';
import { sendCsv, toCsv } from '../helpers/csv.js';
import { nowUtc, quizItems, totalFor } from '../helpers/grades.js';
import { manageCourse } from '../permission-rules/access.js';
import { assignmentToJson, isLate } from './assignmentController.js';
import { quizToJson } from './quizController.js';

// Everything both the screen and the CSV need, from six queries however big the course is
async function buildGradebook(req) {
  const { course } = await manageCourse(req, req.params.id);
  const [assignments, enrollments, submissions, quizRows, quizScores] = await Promise.all([
    Assignment.listForCourse(course.id),
    Enrollment.listForCourse(course.id),
    Submission.listForCourse(course.id),
    Quiz.listForCourse(course.id, { publishedOnly: true }),
    Attempt.bestScoresForCourse(course.id),
  ]);
  const quizzes = quizItems(quizRows);
  // Look-up by "student:assignment", so each cell is found without searching the whole list
  const byCell = new Map(submissions.map((row) => [`${row.user_id}:${row.assignment_id}`, row]));
  const bestQuizScore = new Map(quizScores.map((row) => [`${row.user_id}:${row.quiz_id}`, Number(row.best_score)]));

  const students = enrollments
    .filter((enrollment) => enrollment.status !== 'dropped')
    .map((enrollment) => {
      const cellFor = (assignment) => byCell.get(`${enrollment.user_id}:${assignment.id}`) ?? null;
      const quizScore = (quiz) => bestQuizScore.get(`${enrollment.user_id}:${quiz.id}`) ?? null;
      const result = (item) => {
        if (item.isQuiz) return quizScore(item);
        const cell = cellFor(item);
        if (!cell) return null;
        return cell.score === null ? 'waiting' : Number(cell.score);
      };
      return {
        userId: enrollment.user_id,
        fullName: enrollment.full_name,
        email: enrollment.email,
        cells: assignments.map((assignment) => {
          const cell = cellFor(assignment);
          return {
            assignmentId: assignment.id,
            submissionId: cell?.id ?? null,
            status: cell?.status ?? null,
            score: cell && cell.score !== null ? Number(cell.score) : null,
            late: cell ? isLate(cell, assignment) : false,
          };
        }),
        quizCells: quizzes.map((quiz) => ({ quizId: quiz.id, score: quizScore(quiz) })),
        total: totalFor([...assignments, ...quizzes], result),
      };
    });

  return { course, assignments, quizzes, students };
}

export async function getGradebook(req, res) {
  const { assignments, quizzes, students } = await buildGradebook(req);
  res.json({ assignments: assignments.map(assignmentToJson), quizzes: quizzes.map(quizToJson), students });
}

// One row per student: name, email, a column per assignment, then the totals. A cell is the
// score; "handed in" when not graded yet; "missing" when nothing was handed in and the due date
// has passed (it counts as 0, as on screen); empty when not due yet.
export async function exportGradebook(req, res) {
  const { course, assignments, quizzes, students } = await buildGradebook(req);
  const now = nowUtc();
  const columns = [
    { header: 'Student', value: (student) => student.fullName },
    { header: 'Email', value: (student) => student.email },
    ...assignments.map((assignment, index) => ({
      header: `${assignment.title} (/${Number(assignment.max_score)})`,
      value: (student) => {
        const cell = student.cells[index];
        if (cell.score !== null) return cell.score;
        if (cell.status) return 'handed in';
        return assignment.due_at !== null && assignment.due_at < now ? 'missing' : '';
      },
    })),
    ...quizzes.map((quiz, index) => ({
      header: `Quiz: ${quiz.title} (/${Number(quiz.total_points)})`,
      value: (student) => {
        const { score } = student.quizCells[index];
        if (score !== null) return score;
        return quiz.due_at !== null && quiz.due_at < now ? 'missing' : '';
      },
    })),
    { header: 'Points earned', value: (student) => student.total.earned },
    { header: 'Points possible', value: (student) => student.total.possible },
    { header: 'Percent', value: (student) => student.total.percent ?? '' },
  ];
  sendCsv(res, `${course.code}-gradebook`, toCsv(columns, students));
}
