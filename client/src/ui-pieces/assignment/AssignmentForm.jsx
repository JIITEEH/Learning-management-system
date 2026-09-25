// The form for a new assignment, or for editing one: title, instructions, due date, maximum score
import { useState } from 'react';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { fromLocalInput, toLocalInput } from '../../helpers/format.js';
import { Notice } from '../basics/Feedback.jsx';

// `assignment` is null for a new one. `onSave` receives the fields, ready for the API.
export default function AssignmentForm({ assignment, submitLabel, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: assignment?.title ?? '',
    instructions: assignment?.instructions ?? '',
    due: toLocalInput(assignment?.dueAt),
    maxScore: String(assignment?.maxScore ?? 100),
  });
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  const prefix = assignment ? `edit-${assignment.id}` : 'new';

  const save = useSubmit(async () => {
    if (!form.title.trim()) throw new Error('An assignment needs a title.');
    await onSave({
      title: form.title.trim(),
      instructions: form.instructions,
      // The browser turns the local date and time typed here into UTC for the server
      dueAt: fromLocalInput(form.due),
      maxScore: Number(form.maxScore),
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
            <label htmlFor={`${prefix}-due`}>Due (your local time)</label>
            <input className="input" id={`${prefix}-due`} type="datetime-local" value={form.due} onChange={update('due')}
              aria-describedby={`${prefix}-due-hint`} />
            <p className="field-hint" id={`${prefix}-due-hint`}>Leave empty for no deadline. Work handed in after it is marked late.</p>
          </div>
          <div className="field">
            <label htmlFor={`${prefix}-max`}>Maximum score</label>
            <input className="input" id={`${prefix}-max`} type="number" min="1" max="1000" required value={form.maxScore}
              onChange={update('maxScore')} />
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
