// The instructor's table of results: every student in the course, their attempts handed in and
// their best score, which is what counts in the gradebook
import { api } from '../../api-client/api.js';
import useApi from '../../reusable-logic/useApi.js';
import { formatDateTime, isPastDue } from '../../helpers/format.js';
import { Notice } from '../basics/Feedback.jsx';

export default function QuizResults({ quiz }) {
  const { data, error } = useApi(() => api.quizResults(quiz.id), [quiz.id]);
  if (error) return <Notice>{error.message}</Notice>;
  if (!data) return null;

  return (
    <>
      <div className="card-head"><h2>Results</h2></div>
      {data.students.length === 0 ? (
        <p className="empty">Nobody is enrolled yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Attempts</th>
                <th scope="col">Best score</th>
                <th scope="col">Last handed in</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((student) => (
                <tr key={student.userId}>
                  <td className="cell-strong">{student.fullName}</td>
                  <td data-label="Attempts" data-numeric>{student.attempts} of {quiz.maxAttempts}</td>
                  <td data-label="Best score" data-numeric>
                    {student.bestScore !== null
                      ? `${student.bestScore}/${quiz.totalPoints}`
                      : isPastDue(quiz.dueAt) ? <span className="tag tag-warn">Missed</span> : '–'}
                  </td>
                  <td data-label="Last handed in">{student.lastSubmittedAt ? formatDateTime(student.lastSubmittedAt) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
