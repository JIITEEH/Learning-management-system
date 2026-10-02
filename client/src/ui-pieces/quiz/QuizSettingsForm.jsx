// The form for a new quiz, or for changing one's settings: title, instructions, closing time,
// time limit and attempts allowed. Questions are added on the quiz's own page.
import { useState } from 'react';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { fromLocalInput, toLocalInput } from '../../helpers/format.js';
import { Notice } from '../basics/Feedback.jsx';

// `quiz` is null for a new one. `onSave` receives the fields, ready for the API.
export default function QuizSettingsForm({ quiz, submitLabel, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: quiz?.title ?? '',
    instructions: quiz?.instructions ?? '',
    due: toLocalInput(quiz?.dueAt),
    timeLimit: quiz?.timeLimitMinutes ? String(quiz.timeLimitMinutes) : '',
    attempts: String(quiz?.maxAttempts ?? 1),
  });
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  const prefix = quiz ? `quiz-${quiz.id}` : 'new-quiz';

  const save = useSubmit(async () => {
    if (!form.title.trim()) throw new Error('A quiz needs a title.');
    await onSave({
      title: form.title.trim(),
      instructions: form.instructions,
      // The browser turns the local date and time typed here into UTC for the server
      dueAt: fromLocalInput(form.due),
      timeLimitMinutes: form.timeLimit ? Number(form.timeLimit) : null,
      maxAttempts: Number(form.attempts),
    });
  });

  return (
    <>
      <Notice>{save.error}</Notice>
      <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); save.run(); }}>
        <div className="field">
          <label htmlFor={`${prefix}-title`}>Title</label>
          <input className="input" id={`${prefix}-title`} maxLength={200} required value={form.title} onChange={update('title')} />
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-instructions`}>Instructions</label>
          <textarea className="textarea" id={`${prefix}-instructions`} maxLength={20000} value={form.instructions}
            onChange={update('instructions')} />
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor={`${prefix}-due`}>Closes (your local time)</label>
            <input className="input" id={`${prefix}-due`} type="datetime-local" value={form.due} onChange={update('due')}
              aria-describedby={`${prefix}-due-hint`} />
            <p className="field-hint" id={`${prefix}-due-hint`}>Leave empty to keep it open. Once closed, it cannot be started.</p>
          </div>
          <div className="field">
            <label htmlFor={`${prefix}-limit`}>Time limit in minutes</label>
            <input className="input" id={`${prefix}-limit`} type="number" min="1" max="600" value={form.timeLimit}
              onChange={update('timeLimit')} aria-describedby={`${prefix}-limit-hint`} />
            <p className="field-hint" id={`${prefix}-limit-hint`}>Leave empty for no limit.</p>
          </div>
          <div className="field">
            <label htmlFor={`${prefix}-attempts`}>Attempts allowed</label>
            <input className="input" id={`${prefix}-attempts`} type="number" min="1" max="10" required value={form.attempts}
              onChange={update('attempts')} aria-describedby={`${prefix}-attempts-hint`} />
            <p className="field-hint" id={`${prefix}-attempts-hint`}>The best score counts.</p>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={save.busy} data-loading={save.busy}>{submitLabel}</button>
          {onCancel && <button className="btn" type="button" onClick={onCancel}>Cancel</button>}
        </div>
      </form>
    </>
  );
}
