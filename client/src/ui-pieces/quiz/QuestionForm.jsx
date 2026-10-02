// The form for adding a question to a quiz, or changing one. What it asks for depends on the kind:
//   single / multiple   two to ten options, with the right one(s) ticked
//   true_false          whether the statement is true
//   short               the accepted answers, one per line
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { Notice } from '../basics/Feedback.jsx';

export const KIND_LABELS = {
  single: 'Single choice',
  multiple: 'Multiple choice',
  true_false: 'True or false',
  short: 'Short answer',
};
const MAX_OPTIONS = 10;

// The form's starting values, from an existing question (as the server sends it to the
// instructor, with isCorrect on each option) or blank
function startingForm(question) {
  if (!question) {
    return { kind: 'single', prompt: '', points: '1', options: [{ label: '', isCorrect: true }, { label: '', isCorrect: false }], answer: 'true', accepted: '' };
  }
  const isChoice = question.kind === 'single' || question.kind === 'multiple';
  return {
    kind: question.kind,
    prompt: question.prompt,
    points: String(question.points),
    options: isChoice ? question.options.map(({ label, isCorrect }) => ({ label, isCorrect })) : [{ label: '', isCorrect: true }, { label: '', isCorrect: false }],
    answer: question.kind === 'true_false' && !question.options.find((option) => option.label === 'True')?.isCorrect ? 'false' : 'true',
    accepted: question.kind === 'short' ? question.options.map((option) => option.label).join('\n') : '',
  };
}

// `question` is null for a new one. `onSave` receives the question, ready for the API.
export default function QuestionForm({ question, submitLabel, onSave, onCancel }) {
  const [form, setForm] = useState(() => startingForm(question));
  const prefix = question ? `question-${question.id}` : 'new-question';
  const set = (changes) => setForm((current) => ({ ...current, ...changes }));

  function setOption(index, changes) {
    set({ options: form.options.map((option, i) => (i === index ? { ...option, ...changes } : option)) });
  }
  // Single choice has one right option: ticking one unticks the rest
  function markRight(index, checked) {
    if (form.kind === 'single') set({ options: form.options.map((option, i) => ({ ...option, isCorrect: i === index })) });
    else setOption(index, { isCorrect: checked });
  }

  const save = useSubmit(async () => {
    if (!form.prompt.trim()) throw new Error('Write the question first.');
    const body = { kind: form.kind, prompt: form.prompt.trim(), points: Number(form.points) };
    if (form.kind === 'true_false') body.answer = form.answer === 'true';
    else if (form.kind === 'short') body.acceptedAnswers = form.accepted.split('\n').map((line) => line.trim()).filter(Boolean);
    else body.options = form.options.map((option) => ({ label: option.label.trim(), isCorrect: option.isCorrect }));
    await onSave(body);
  });

  return (
    <>
      <Notice>{save.error}</Notice>
      <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); save.run(); }}>
        <div className="form-row">
          <div className="field">
            <label htmlFor={`${prefix}-kind`}>Type of question</label>
            <select className="select" id={`${prefix}-kind`} value={form.kind} onChange={(event) => set({ kind: event.target.value })}>
              {Object.entries(KIND_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${prefix}-points`}>Points</label>
            <input className="input" id={`${prefix}-points`} type="number" min="0.5" max="1000" step="0.5" value={form.points}
              onChange={(event) => set({ points: event.target.value })} />
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-prompt`}>{form.kind === 'true_false' ? 'Statement' : 'Question'}</label>
          <textarea className="textarea" id={`${prefix}-prompt`} maxLength={2000} value={form.prompt}
            onChange={(event) => set({ prompt: event.target.value })} />
        </div>

        {(form.kind === 'single' || form.kind === 'multiple') && (
          <fieldset className="field choice-editor">
            <legend>Options <span className="field-hint">— tick {form.kind === 'single' ? 'the right one' : 'every right one'}</span></legend>
            {form.options.map((option, index) => (
              <div key={index} className="choice-edit-row">
                <input className="check" type={form.kind === 'single' ? 'radio' : 'checkbox'} name={`${prefix}-right`}
                  checked={option.isCorrect} onChange={(event) => markRight(index, event.target.checked)}
                  aria-label={`Option ${index + 1} is right`} />
                <input className="input" maxLength={500} value={option.label} aria-label={`Option ${index + 1}`}
                  onChange={(event) => setOption(index, { label: event.target.value })} />
                <button className="icon-btn icon-btn-danger" type="button" disabled={form.options.length <= 2}
                  onClick={() => set({ options: form.options.filter((_, i) => i !== index) })}>
                  <span className="visually-hidden">Remove option {index + 1}</span>
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            ))}
            {form.options.length < MAX_OPTIONS && (
              <button className="btn btn-sm" type="button" onClick={() => set({ options: [...form.options, { label: '', isCorrect: false }] })}>
                <Plus aria-hidden="true" /> Add an option
              </button>
            )}
          </fieldset>
        )}

        {form.kind === 'true_false' && (
          <fieldset className="field">
            <legend>The statement is</legend>
            <div className="choice-inline">
              {['true', 'false'].map((value) => (
                <label key={value} className="choice-row">
                  <input className="check" type="radio" name={`${prefix}-answer`} value={value} checked={form.answer === value}
                    onChange={() => set({ answer: value })} />
                  {value === 'true' ? 'True' : 'False'}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {form.kind === 'short' && (
          <div className="field">
            <label htmlFor={`${prefix}-accepted`}>Accepted answers, one per line</label>
            <textarea className="textarea" id={`${prefix}-accepted`} value={form.accepted} aria-describedby={`${prefix}-accepted-hint`}
              onChange={(event) => set({ accepted: event.target.value })} />
            <p className="field-hint" id={`${prefix}-accepted-hint`}>
              Capital letters and extra spaces are ignored, so &quot;Paris&quot; also accepts &quot; paris &quot;.
            </p>
          </div>
        )}

        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={save.busy} data-loading={save.busy}>{submitLabel}</button>
          {onCancel && <button className="btn" type="button" onClick={onCancel}>Cancel</button>}
        </div>
      </form>
    </>
  );
}
