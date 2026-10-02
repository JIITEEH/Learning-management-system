// The instructor's view of a quiz's questions, with the right answers marked, and buttons to add,
// change and remove them. Once anyone has started the quiz the questions are fixed (`locked`), so
// everyone is marked against the same ones; the server refuses changes from then on as well.
import { useState } from 'react';
import { CircleCheck, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../api-client/api.js';
import { useToast } from '../../shared-state/ToastContext.jsx';
import { plural } from '../../helpers/format.js';
import QuestionForm, { KIND_LABELS } from './QuestionForm.jsx';

export default function QuestionList({ quiz, questions, locked, onChanged }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  async function add(body) {
    await api.addQuestion(quiz.id, body);
    toast.success('Question added.');
    setAdding(false);
    onChanged();
  }

  async function save(question, body) {
    await api.updateQuestion(question.id, body);
    toast.success('Question saved.');
    setEditingId(null);
    onChanged();
  }

  async function remove(question, index) {
    if (!window.confirm(`Remove question ${index + 1}? This cannot be undone.`)) return;
    try {
      await api.deleteQuestion(question.id);
      toast.success('Question removed.');
      onChanged();
    } catch (failure) {
      toast.error(failure.message);
    }
  }

  return (
    <>
      <div className="card-head">
        <h2>Questions</h2>
        <span className="tag">{plural(questions.length, 'question')} · {quiz.totalPoints} points</span>
      </div>
      {locked && (
        <p className="notice notice-warn">
          Students have started this quiz, so its questions can no longer change. Everyone is marked against the same ones.
        </p>
      )}

      {questions.length === 0 && <p className="empty">No questions yet. Add the first one below.</p>}
      <ol className="question-list">
        {questions.map((question, index) => (
          <li key={question.id} className="inset question-item">
            {editingId === question.id ? (
              <QuestionForm question={question} submitLabel="Save question" onSave={(body) => save(question, body)}
                onCancel={() => setEditingId(null)} />
            ) : (
              <>
                <div className="outline-row">
                  <span className="tag-row">
                    <span className="tag">{KIND_LABELS[question.kind]}</span>
                    <span className="tag">{plural(question.points, 'point')}</span>
                  </span>
                  {!locked && (
                    <span className="outline-tools">
                      <button className="icon-btn" type="button" title="Edit" onClick={() => setEditingId(question.id)}>
                        <span className="visually-hidden">Edit question {index + 1}</span>
                        <Pencil aria-hidden="true" />
                      </button>
                      <button className="icon-btn icon-btn-danger" type="button" title="Remove" onClick={() => remove(question, index)}>
                        <span className="visually-hidden">Remove question {index + 1}</span>
                        <Trash2 aria-hidden="true" />
                      </button>
                    </span>
                  )}
                </div>
                <p className="question-prompt">{question.prompt}</p>
                <ul className="answer-list">
                  {question.options.map((option) => (
                    <li key={option.id} className={option.isCorrect ? 'answer-right' : undefined}>
                      {option.isCorrect && <CircleCheck aria-hidden="true" />}
                      {option.label}
                      {option.isCorrect && <span className="visually-hidden"> (right answer)</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </li>
        ))}
      </ol>

      {!locked && (
        adding ? (
          <div className="inset" id="new-question">
            <QuestionForm question={null} submitLabel="Add question" onSave={add} onCancel={() => setAdding(false)} />
          </div>
        ) : (
          <div className="actions">
            <button className="btn" type="button" aria-expanded="false" aria-controls="new-question" onClick={() => setAdding(true)}>
              Add a question
            </button>
          </div>
        )
      )}
    </>
  );
}
