// Answering a quiz: every question on one page, a countdown when there is a time limit, and
// "Hand in". When the countdown reaches zero the answers are handed in automatically.
//
// The countdown is only a display: the server fixed the attempt's end when it started, and does
// not count answers handed in after it. The answers so far are kept in this tab's session
// storage, so a reload carries on where it was rather than losing them.
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api-client/api.js';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { parseTimestamp, plural } from '../../helpers/format.js';
import { Notice } from '../basics/Feedback.jsx';

const storageKey = (attempt) => `quiz-attempt-${attempt.id}`;

// Reading and writing session storage can fail (a private window, storage switched off); the
// quiz still works then, it just forgets the answers on reload
function loadSaved(attempt) {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(attempt))) ?? {};
  } catch {
    return {};
  }
}
function save(attempt, answers) {
  try {
    sessionStorage.setItem(storageKey(attempt), JSON.stringify(answers));
  } catch {
    // Nothing to do: the answers are still on screen
  }
}
function forget(attempt) {
  try {
    sessionStorage.removeItem(storageKey(attempt));
  } catch {
    // As above
  }
}

// 754 seconds -> "12:34"
function clock(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

// Seconds left, by the server's clock: `offset` corrects for a computer whose clock is wrong
function secondsLeft(endsAt, offset) {
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((parseTimestamp(endsAt).getTime() - (Date.now() + offset)) / 1000));
}

export default function QuizTaker({ attempt, questions, serverNow, onFinished }) {
  // { [questionId]: { optionIds: [..] } or { text: '' } }
  const [answers, setAnswers] = useState(() => loadSaved(attempt));
  const [offset] = useState(() => parseTimestamp(serverNow).getTime() - Date.now());
  const [left, setLeft] = useState(() => secondsLeft(attempt.endsAt, offset));
  const [announcement, setAnnouncement] = useState('');
  const handedIn = useRef(false);

  const handIn = useSubmit(async ({ automatic = false } = {}) => {
    if (handedIn.current) return;
    const unanswered = questions.filter((question) => {
      const answer = answers[question.id];
      return !answer || (question.kind === 'short' ? !answer.text?.trim() : !answer.optionIds?.length);
    }).length;
    if (!automatic && unanswered > 0 && !window.confirm(`${plural(unanswered, 'question')} left unanswered. Hand in anyway?`)) return;

    handedIn.current = true;
    const list = questions.map((question) => ({ questionId: question.id, ...answers[question.id] }));
    try {
      const result = await api.submitAttempt(attempt.id, list);
      forget(attempt);
      onFinished(result);
    } catch (failure) {
      // Out of time: the server has closed the attempt, so show what it recorded
      if (failure.status === 409) {
        forget(attempt);
        onFinished(await api.getAttempt(attempt.id));
        return;
      }
      handedIn.current = false;
      throw failure;
    }
  });

  // The countdown below reads the latest hand-in (with the latest answers) through this ref, so
  // the timer does not restart every time an answer changes
  const handInRef = useRef(handIn);
  useEffect(() => {
    handInRef.current = handIn;
  });

  // The countdown, once a second. At zero the answers go in by themselves.
  useEffect(() => {
    if (!attempt.endsAt) return undefined;
    const timer = setInterval(() => {
      const seconds = secondsLeft(attempt.endsAt, offset);
      setLeft(seconds);
      // Screen readers hear the time only at these moments, not every second
      if (seconds === 300) setAnnouncement('5 minutes left');
      if (seconds === 60) setAnnouncement('1 minute left');
      if (seconds === 0) handInRef.current.run({ automatic: true });
    }, 1000);
    return () => clearInterval(timer);
  }, [attempt.endsAt, offset]);

  function choose(question, optionId, checked) {
    const current = answers[question.id]?.optionIds ?? [];
    const optionIds = question.kind === 'multiple'
      ? (checked ? [...current, optionId] : current.filter((id) => id !== optionId))
      : [optionId];
    const next = { ...answers, [question.id]: { optionIds } };
    setAnswers(next);
    save(attempt, next);
  }

  function type(question, text) {
    const next = { ...answers, [question.id]: { text } };
    setAnswers(next);
    save(attempt, next);
  }

  return (
    <>
      <div className="card-head">
        <h2>Attempt {attempt.attemptNumber}</h2>
      </div>
      {/* Outside the heading row, so it can stay in view while scrolling through the questions */}
      {left !== null && (
        <p className={`tag quiz-timer ${left <= 60 ? 'tag-warn' : ''}`} role="timer" aria-live="off" data-numeric>
          {clock(left)} left
        </p>
      )}
      <p className="visually-hidden" aria-live="assertive">{announcement}</p>
      <Notice>{handIn.error}</Notice>

      <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); handIn.run(); }}>
        <ol className="question-list">
          {questions.map((question, index) => (
            <li key={question.id} className="inset question-item">
              <fieldset className="field">
                <legend className="question-prompt">
                  <span className="visually-hidden">Question {index + 1}: </span>
                  {question.prompt} <span className="field-hint">({plural(question.points, 'point')}{question.kind === 'multiple' ? ', tick every right answer' : ''})</span>
                </legend>
                {question.kind === 'short' ? (
                  <input className="input" maxLength={500} aria-label={`Your answer to question ${index + 1}`}
                    value={answers[question.id]?.text ?? ''} onChange={(event) => type(question, event.target.value)} />
                ) : (
                  <div className="choice-list">
                    {question.options.map((option) => (
                      <label key={option.id} className="choice-row">
                        <input className="check" type={question.kind === 'multiple' ? 'checkbox' : 'radio'} name={`question-${question.id}`}
                          checked={(answers[question.id]?.optionIds ?? []).includes(option.id)}
                          onChange={(event) => choose(question, option.id, event.target.checked)} />
                        {option.label}
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            </li>
          ))}
        </ol>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={handIn.busy} data-loading={handIn.busy}>Hand in</button>
        </div>
      </form>
    </>
  );
}
