// The Quizzes tab: a course's quizzes, soonest closing first. A student sees their attempts and
// best score on each; the instructor also sees quizzes still being built, and can start a new one.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../api-client/api.js';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import useApi from '../../reusable-logic/useApi.js';
import { closingText, isPastDue } from '../../helpers/format.js';
import { Notice } from '../basics/Feedback.jsx';
import QuizSettingsForm from './QuizSettingsForm.jsx';

export default function QuizList({ course }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { data, error } = useApi(() => api.listQuizzes(course.id), [course.id]);
  const [creating, setCreating] = useState(false);
  const manages = (course.relation === 'teaching' || course.relation === 'overseeing') && can('quiz.manage');
  const quizzes = data?.quizzes ?? [];

  // A new quiz opens straight away, ready for its questions
  async function create(fields) {
    const { quiz } = await api.createQuiz(course.id, fields);
    navigate(`/courses/${course.id}/quizzes/${quiz.id}`);
  }

  if (error) return <Notice>{error.message}</Notice>;
  if (!data) return null;

  return (
    <>
      <div className="card-head">
        <h2>Quizzes</h2>
        {manages && (
          <button className="btn btn-primary" type="button" aria-expanded={creating} aria-controls="new-quiz"
            onClick={() => setCreating((open) => !open)}>
            New quiz
          </button>
        )}
      </div>
      {creating && (
        <div className="inset" id="new-quiz">
          <QuizSettingsForm quiz={null} submitLabel="Create quiz" onSave={create} onCancel={() => setCreating(false)} />
        </div>
      )}

      {quizzes.length === 0 ? (
        <p className="empty">{manages ? 'No quizzes yet.' : 'Your instructor has not set any quizzes yet.'}</p>
      ) : (
        <ul className="file-list">
          {quizzes.map((quiz) => (
            <li key={quiz.id} className="outline-row">
              <Link to={`/courses/${course.id}/quizzes/${quiz.id}`}>{quiz.title}</Link>
              <span className="field-hint">{closingText(quiz.dueAt)}</span>
              {manages && !quiz.isPublished && <span className="tag tag-info">Not published</span>}
              {'attemptsUsed' in quiz && (
                quiz.bestScore === null
                  ? <span className={`tag ${isPastDue(quiz.dueAt) ? 'tag-warn' : ''}`}>{isPastDue(quiz.dueAt) ? 'Missed' : 'Not taken'}</span>
                  : <span className="tag tag-ok">Best {quiz.bestScore}/{quiz.totalPoints}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
