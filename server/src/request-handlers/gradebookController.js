// A course's gradebook: every student against every assignment, with totals, on screen and as CSV.
// For the course's instructor and administrators; the instructor's view counts graded work even
// before it is returned to students.
import * as Assignment from '../database-queries/assignmentModel.js';
import * as Enrollment from '../database-queries/enrollmentModel.js';
import * as Submission from '../database-queries/submissionModel.js';
import { sendCsv, toCsv } from '../helpers/csv.js';
import { nowUtc, totalFor } from '../helpers/grades.js';
import { manageCourse } from '../permission-rules/access.js';
import { assignmentToJson, isLate } from './assignmentController.js';

// Everything both the screen and the CSV need, from four queries however big the course is
async function buildGradebook(req) {
  const { course } = await manageCourse(req, req.params.id);
  const [assignments, enrollments, submissions] = await Promise.all([
    Assignment.listForCourse(course.id),
    Enrollment.listForCourse(course.id),
    Submission.listForCourse(course.id),
  ]);
  // Look-up by "student:assignment", so each cell is found without searching the whole list
  const byCell = new Map(submissions.map((row) => [`${row.user_id}:${row.assignment_id}`, row]));

  const students = enrollments
    .filter((enrollment) => enrollment.status !== 'dropped')
    .map((enrollment) => {
      const cellFor = (assignment) => byCell.get(`${enrollment.user_id}:${assignment.id}`) ?? null;
      const result = (assignment) => {
        const cell = cellFor(assignment);
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
        total: totalFor(assignments, result),
      };
    });

  return { course, assignments, students };
}

export async function getGradebook(req, res) {
  const { assignments, students } = await buildGradebook(req);
  res.json({ assignments: assignments.map(assignmentToJson), students });
}

// One row per student: name, email, a column per assignment, then the totals. A cell is the
// score; "handed in" when not graded yet; "missing" when nothing was handed in and the due date
// has passed (it counts as 0, as on screen); empty when not due yet.
export async function exportGradebook(req, res) {
  const { course, assignments, students } = await buildGradebook(req);
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
    { header: 'Points earned', value: (student) => student.total.earned },
    { header: 'Points possible', value: (student) => student.total.possible },
    { header: 'Percent', value: (student) => student.total.percent ?? '' },
  ];
  sendCsv(res, `${course.code}-gradebook`, toCsv(columns, students));
}
