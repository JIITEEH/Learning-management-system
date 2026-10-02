// A student's side of a quiz: their attempts so far, a button to start (or carry on with) one,
// the questions while answering, and the result once handed in.
import { useState } from 'react';
import { api } from '../../api-client/api.js';
import useApi from '../../reusable-logic/useApi.js';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { plural } from '../../helpers/format.js';
import { Notice } from '../basics/Feedback.jsx';
import AttemptResult from './AttemptResult.jsx';
import QuizTaker from './QuizTaker.jsx';

export default function StudentQuiz({ quiz }) {
  const { data, error, reload } = useApi(() => api.myAttempts(quiz.id), [quiz.id]);
  // What the panel shows: the list (null), an attempt being answered, or a result
  const [taking, setTaking] = useState(null);
  const [result, setResult] = useState(null);

  const start = useSubmit(async () => {
    setResult(null);
    setTaking(await api.startAttempt(quiz.id));
  });
  const view = useSubmit(async (attemptId) => {
    setTaking(null);
    setResult(await api.getAttempt(attemptId));
  });

  function finished(reply) {
    setTaking(null);
    setResult(reply);
    reload();
  }

  if (error) return <section className="card"><Notice>{error.message}</Notice></section>;
  if (!data) return null;

  if (taking) {
    return (
      <section className="card" aria-label="Your attempt">
        <QuizTaker attempt={taking.attempt} questions={taking.questions} serverNow={taking.serverNow} onFinished={finished} />
      </section>
    );
  }

  const handedIn = data.attempts.filter((attempt) => attempt.submittedAt);
  const left = quiz.maxAttempts - data.attempts.length;
  const best = handedIn.length ? Math.max(...handedIn.map((attempt) => attempt.score)) : null;

  return (
    <>
      {result && (
        <section className="card" aria-label="Result">
          <AttemptResult attempt={result.attempt} questions={result.questions} />
        </section>
      )}

      <section className="card" aria-labelledby="your-attempts">
        <div className="card-head">
          <h2 id="your-attempts">Your attempts</h2>
          {best !== null && <span className="tag tag-ok">Best {best}/{quiz.totalPoints}</span>}
        </div>
        <Notice>{start.error || view.error}</Notice>

        {handedIn.length === 0 ? (
          <p className="field-hint">You have not handed in an attempt yet.</p>
        ) : (
          <ul className="file-list">
            {handedIn.map((attempt) => (
              <li key={attempt.id} className="outline-row">
                <span>Attempt {attempt.attemptNumber}</span>
                <span className="tag" data-numeric>{attempt.score}/{attempt.maxScore}</span>
                <button className="btn btn-sm" type="button" onClick={() => view.run(attempt.id)} disabled={view.busy}>
                  See result<span className="visually-hidden"> of attempt {attempt.attemptNumber}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="actions">
          {data.canStart ? (
            <button className="btn btn-primary" type="button" onClick={start.run} disabled={start.busy} data-loading={start.busy}>
              {data.openAttemptId ? 'Carry on with your attempt' : handedIn.length ? 'Try again' : 'Start the quiz'}
            </button>
          ) : (
            <p className="field-hint">
              {left <= 0 ? 'You have used every attempt.' : 'This quiz is closed.'}
            </p>
          )}
          {data.canStart && !data.openAttemptId && (
            <span className="field-hint">
              {plural(left, 'attempt')} left{quiz.timeLimitMinutes ? ` · ${quiz.timeLimitMinutes} minutes once you start` : ''}
            </span>
          )}
        </div>
      </section>
    </>
  );
}
