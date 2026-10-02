// One quiz, at /courses/:courseId/quizzes/:quizId. A student takes it here and sees their results;
// its instructor and administrators change its settings and questions, publish it, and see
// everyone's results. The server checks every one of those again.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api-client/api.js';
import { useAuth } from '../shared-state/AuthContext.jsx';
import { useToast } from '../shared-state/ToastContext.jsx';
import useApi from '../reusable-logic/useApi.js';
import useSubmit from '../reusable-logic/useSubmit.js';
import { closingText, plural } from '../helpers/format.js';
import { Notice } from '../ui-pieces/basics/Feedback.jsx';
import LessonText from '../ui-pieces/lesson/LessonText.jsx';
import QuestionList from '../ui-pieces/quiz/QuestionList.jsx';
import QuizResults from '../ui-pieces/quiz/QuizResults.jsx';
import QuizSettingsForm from '../ui-pieces/quiz/QuizSettingsForm.jsx';
import StudentQuiz from '../ui-pieces/quiz/StudentQuiz.jsx';

function QuizNotFound({ courseId }) {
  return (
    <main className="stack" id="main">
      <section className="card">
        <h1>Quiz not found</h1>
        <p className="card-intro">There is no quiz at this address that your account can open.</p>
        <div className="actions"><Link className="btn" to={`/courses/${courseId}?tab=quizzes`}>Back to the course</Link></div>
      </section>
    </main>
  );
}

export default function Quiz() {
  const { courseId, quizId } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, error, reload } = useApi(() => api.getQuiz(quizId), [quizId]);
  const [editing, setEditing] = useState(false);

  const publish = useSubmit(async (isPublished) => {
    await api.updateQuiz(data.quiz.id, { isPublished });
    toast.success(isPublished ? 'Quiz published. Students can take it now.' : 'Quiz hidden from students.');
    reload();
  });
  const remove = useSubmit(async () => {
    if (!window.confirm(`Delete "${data.quiz.title}" with its questions and every attempt at it? This cannot be undone.`)) return;
    await api.deleteQuiz(data.quiz.id);
    toast.success('Quiz deleted.');
    navigate(`/courses/${data.course.id}?tab=quizzes`);
  });

  if (error?.status === 404) return <QuizNotFound courseId={courseId} />;
  if (error) return <main className="stack" id="main"><Notice>{error.message}</Notice></main>;
  if (!data) return null;

  const { quiz, course } = data;
  const manages = course.relation !== 'enrolled' && can('quiz.manage');

  async function save(fields) {
    await api.updateQuiz(quiz.id, fields);
    toast.success('Quiz saved.');
    setEditing(false);
    reload();
  }

  return (
    <main className="stack" id="main">
      <title>{`${quiz.title} — ${course.title}`}</title>

      <section className="card" aria-labelledby="quiz-title">
        <Link className="back-link" to={`/courses/${course.id}?tab=quizzes`}>
          <ArrowLeft aria-hidden="true" />
          {course.code} · {course.title}
        </Link>
        <span className="tag-row">
          <span className="tag">{plural(quiz.questionCount, 'question')} · {quiz.totalPoints} points</span>
          <span className="tag">{quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} minutes` : 'No time limit'}</span>
          <span className="tag">{plural(quiz.maxAttempts, 'attempt')}</span>
          {manages && <span className={`tag ${quiz.isPublished ? 'tag-ok' : 'tag-info'}`}>{quiz.isPublished ? 'Published' : 'Not published'}</span>}
        </span>
        <h1 id="quiz-title" className="course-title">{quiz.title}</h1>
        <p className="card-intro">{closingText(quiz.dueAt)}</p>

        {editing ? (
          <QuizSettingsForm quiz={quiz} submitLabel="Save quiz" onSave={save} onCancel={() => setEditing(false)} />
        ) : (
          <LessonText text={quiz.instructions} emptyText="No instructions." />
        )}

        {manages && !editing && (
          <div className="actions">
            {!quiz.isPublished && (
              <button className="btn btn-primary" type="button" onClick={() => publish.run(true)} disabled={publish.busy}
                data-loading={publish.busy}>
                Publish
              </button>
            )}
            {quiz.isPublished && !data.locked && (
              <button className="btn" type="button" onClick={() => publish.run(false)} disabled={publish.busy}>Hide from students</button>
            )}
            <button className="btn" type="button" onClick={() => setEditing(true)}>Edit settings</button>
            <button className="btn btn-danger" type="button" onClick={remove.run} disabled={remove.busy} data-loading={remove.busy}>
              Delete quiz
            </button>
          </div>
        )}
        <Notice>{publish.error || remove.error}</Notice>
      </section>

      {manages && (
        <>
          <section className="card" aria-label="Questions">
            <QuestionList quiz={quiz} questions={data.questions} locked={data.locked} onChanged={reload} />
          </section>
          {quiz.isPublished && (
            <section className="card" aria-label="Results">
              <QuizResults quiz={quiz} />
            </section>
          )}
        </>
      )}

      {course.relation === 'enrolled' && can('quiz.take') && <StudentQuiz quiz={quiz} />}
    </main>
  );
}
