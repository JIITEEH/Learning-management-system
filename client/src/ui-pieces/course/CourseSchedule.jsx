// The Schedule tab: a course's weekly meetings, Monday first. Its instructor and administrators add,
// edit and remove them; a meeting that overlaps another of the course is saved with a warning.
import { useState } from 'react';
import { MapPin, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../api-client/api.js';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { useToast } from '../../shared-state/ToastContext.jsx';
import useApi from '../../reusable-logic/useApi.js';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { formatDate } from '../../helpers/format.js';
import { DAY_NAMES, WEEK_ORDER, timeRange } from '../../helpers/schedule.js';
import { Notice } from '../basics/Feedback.jsx';

const EMPTY = { title: '', dayOfWeek: '1', startsAt: '', endsAt: '', location: '', effectiveFrom: '', effectiveTo: '' };

// Dates here are calendar days ('2026-06-02'), not moments, so they are shown without time zones
const showDay = (day) => formatDate(`${day} 12:00:00`);

function MeetingForm({ meeting, onSave, onCancel }) {
  const [form, setForm] = useState(
    meeting ? { ...meeting, dayOfWeek: String(meeting.dayOfWeek), title: meeting.title ?? '', location: meeting.location ?? '', effectiveTo: meeting.effectiveTo ?? '' } : EMPTY,
  );
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  const prefix = meeting ? `meeting-${meeting.id}` : 'new-meeting';
  const save = useSubmit(async () => {
    if (!form.startsAt || !form.endsAt || !form.effectiveFrom) throw new Error('A class needs a start time, an end time and a first date.');
    await onSave({ ...form, dayOfWeek: Number(form.dayOfWeek), effectiveTo: form.effectiveTo || null });
  });

  return (
    <>
      <Notice>{save.error}</Notice>
      <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); save.run(); }}>
        <div className="form-row">
          <div className="field">
            <label htmlFor={`${prefix}-title`}>What (optional)</label>
            <input className="input" id={`${prefix}-title`} maxLength={200} placeholder="Lecture" value={form.title} onChange={update('title')} />
          </div>
          <div className="field">
            <label htmlFor={`${prefix}-location`}>Room or place (optional)</label>
            <input className="input" id={`${prefix}-location`} maxLength={160} value={form.location} onChange={update('location')} />
          </div>
        </div>
        <div className="form-row form-row-3">
          <div className="field">
            <label htmlFor={`${prefix}-day`}>Day</label>
            <select className="select" id={`${prefix}-day`} value={form.dayOfWeek} onChange={update('dayOfWeek')}>
              {WEEK_ORDER.map((day) => <option key={day} value={day}>{DAY_NAMES[day]}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${prefix}-start`}>Starts</label>
            <input className="input" id={`${prefix}-start`} type="time" required value={form.startsAt} onChange={update('startsAt')} />
          </div>
          <div className="field">
            <label htmlFor={`${prefix}-end`}>Ends</label>
            <input className="input" id={`${prefix}-end`} type="time" required value={form.endsAt} onChange={update('endsAt')} />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor={`${prefix}-from`}>First date</label>
            <input className="input" id={`${prefix}-from`} type="date" required value={form.effectiveFrom} onChange={update('effectiveFrom')} />
          </div>
          <div className="field">
            <label htmlFor={`${prefix}-to`}>Last date (optional)</label>
            <input className="input" id={`${prefix}-to`} type="date" value={form.effectiveTo} onChange={update('effectiveTo')}
              aria-describedby={`${prefix}-to-hint`} />
            <p className="field-hint" id={`${prefix}-to-hint`}>To change a time mid-term, give this class a last date and add a new one.</p>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={save.busy} data-loading={save.busy}>
            {meeting ? 'Save class' : 'Add class'}
          </button>
          {onCancel && <button className="btn" type="button" onClick={onCancel}>Cancel</button>}
        </div>
      </form>
    </>
  );
}

export default function CourseSchedule({ course }) {
  const { can } = useAuth();
  const toast = useToast();
  const { data, error, reload } = useApi(() => api.listCourseSchedule(course.id), [course.id]);
  const [editingId, setEditingId] = useState(null); // a meeting's id, 'new', or null
  const [warnings, setWarnings] = useState([]);
  const manages = (course.relation === 'teaching' || course.relation === 'overseeing') && can('schedule.manage');

  async function saved(reply, message) {
    setWarnings(reply.warnings);
    toast.success(message);
    setEditingId(null);
    reload();
  }
  async function remove(meeting) {
    if (!window.confirm(`Remove the ${DAY_NAMES[meeting.dayOfWeek]} ${timeRange(meeting)} class?`)) return;
    try {
      await api.deleteMeeting(meeting.id);
      toast.success('Class removed.');
      reload();
    } catch (failure) {
      toast.error(failure.message);
    }
  }

  if (error) return <Notice>{error.message}</Notice>;
  if (!data) return null;
  const byDay = WEEK_ORDER.map((day) => ({ day, meetings: data.schedules.filter((m) => m.dayOfWeek === day) })).filter((group) => group.meetings.length);

  return (
    <>
      <div className="card-head">
        <h2>Schedule</h2>
        {manages && editingId !== 'new' && (
          <button className="btn btn-primary" type="button" aria-expanded="false" aria-controls="new-meeting-form" onClick={() => setEditingId('new')}>
            Add class
          </button>
        )}
      </div>
      {warnings.length > 0 && <p className="notice notice-warn">{warnings.join('. ')}. Saved anyway, in case the overlap is on purpose.</p>}
      {editingId === 'new' && (
        <div className="inset" id="new-meeting-form">
          <MeetingForm onCancel={() => setEditingId(null)} onSave={async (form) => saved(await api.addMeeting(course.id, form), 'Class added.')} />
        </div>
      )}

      {byDay.length === 0 ? (
        <p className="empty">{manages ? 'No weekly classes yet. Add the first one.' : 'No weekly classes have been set for this course.'}</p>
      ) : (
        byDay.map(({ day, meetings }) => (
          <section key={day} className="outline-module" aria-labelledby={`day-${day}`}>
            <h3 id={`day-${day}`}>{DAY_NAMES[day]}</h3>
            <ul className="file-list">
              {meetings.map((meeting) =>
                editingId === meeting.id ? (
                  <li key={meeting.id} className="inset">
                    <MeetingForm meeting={meeting} onCancel={() => setEditingId(null)}
                      onSave={async (form) => saved(await api.updateMeeting(meeting.id, form), 'Class saved.')} />
                  </li>
                ) : (
                  <li key={meeting.id} className="outline-row meeting-row">
                    <span className="meeting-time" data-numeric>{timeRange(meeting)}</span>
                    <span className="meeting-what">
                      {meeting.title ?? 'Class'}
                      {meeting.location && <span className="field-hint"><MapPin aria-hidden="true" /> {meeting.location}</span>}
                      <span className="field-hint">
                        {meeting.effectiveTo ? `${showDay(meeting.effectiveFrom)} to ${showDay(meeting.effectiveTo)}` : `From ${showDay(meeting.effectiveFrom)}`}
                      </span>
                    </span>
                    {manages && (
                      <span className="outline-tools">
                        <button className="icon-btn" type="button" title="Edit" onClick={() => { setWarnings([]); setEditingId(meeting.id); }}>
                          <span className="visually-hidden">Edit the {DAY_NAMES[day]} {timeRange(meeting)} class</span>
                          <Pencil aria-hidden="true" />
                        </button>
                        <button className="icon-btn icon-btn-danger" type="button" title="Remove" onClick={() => remove(meeting)}>
                          <span className="visually-hidden">Remove the {DAY_NAMES[day]} {timeRange(meeting)} class</span>
                          <Trash2 aria-hidden="true" />
                        </button>
                      </span>
                    )}
                  </li>
                ),
              )}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
