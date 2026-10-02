// A handed-in attempt: the score, and for each question whether it was right and what was
// answered. The right answers themselves are never sent to a student, so they are not shown.
import { CircleCheck, CircleX } from 'lucide-react';
import { formatDateTime, plural } from '../../helpers/format.js';

function yourAnswer(question) {
  const answer = question.yourAnswer;
  if (!answer) return 'Not answered';
  if (question.kind === 'short') return answer.text.trim() || 'Not answered';
  const chosen = question.options.filter((option) => answer.optionIds.includes(option.id)).map((option) => option.label);
  return chosen.length ? chosen.join(', ') : 'Not answered';
}

export default function AttemptResult({ attempt, questions }) {
  const right = questions.filter((question) => question.isCorrect).length;
  return (
    <>
      <div className="card-head">
        <h2>Attempt {attempt.attemptNumber}: {attempt.score}/{attempt.maxScore}</h2>
        <span className="tag">{right} of {plural(questions.length, 'question')} right</span>
      </div>
      <p className="field-hint">Handed in {formatDateTime(attempt.submittedAt)}</p>
      <ol className="question-list">
        {questions.map((question, index) => (
          <li key={question.id} className={`inset question-item ${question.isCorrect ? 'question-right' : 'question-wrong'}`}>
            <p className="question-prompt">
              {question.isCorrect ? <CircleCheck aria-hidden="true" /> : <CircleX aria-hidden="true" />}
              <span className="visually-hidden">Question {index + 1}, {question.isCorrect ? 'right' : 'wrong'}: </span>
              {question.prompt}
            </p>
            <p className="field-hint">
              Your answer: {yourAnswer(question)} · {question.pointsAwarded} of {plural(question.points, 'point')}
            </p>
          </li>
        ))}
      </ol>
    </>
  );
}
