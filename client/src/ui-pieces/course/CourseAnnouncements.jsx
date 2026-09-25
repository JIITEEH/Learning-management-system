// The Announcements tab: a course's announcements, newest first. Its instructor and
// administrators post, edit and delete them.
import { useState } from 'react';
import { api } from '../../api-client/api.js';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { useToast } from '../../shared-state/ToastContext.jsx';
import useApi from '../../reusable-logic/useApi.js';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { formatDateTime } from '../../helpers/format.js';
import { Notice } from '../basics/Feedback.jsx';
import LessonText from '../lesson/LessonText.jsx';

// Posting a new announcement, or editing one (`announcement` given)
function AnnouncementForm({ announcement, onSave, onCancel }) {
  const [form, setForm] = useState({ title: announcement?.title ?? '', body: announcement?.body ?? '' });
  const prefix = announcement ? `edit-announcement-${announcement.id}` : 'new-announcement';
  const save = useSubmit(async () => {
    if (!form.title.trim()) throw new Error('An announcement needs a title.');
    await onSave(form);
    if (!announcement) setForm({ title: '', body: '' });
  });
  return (
    <>
      <Notice>{save.error}</Notice>
      <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); save.run(); }}>
        <div className="field">
          <label htmlFor={`${prefix}-title`}>Title</label>
          <input className="input" id={`${prefix}-title`} maxLength={200} value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-body`}>Message</label>
          <textarea className="textarea" id={`${prefix}-body`} maxLength={10000} value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })} />
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={save.busy} data-loading={save.busy}>
            {announcement ? 'Save' : 'Post announcement'}
          </button>
          {onCancel && <button className="btn" type="button" onClick={onCancel}>Cancel</button>}
        </div>
      </form>
    </>
  );
}

export default function CourseAnnouncements({ course }) {
  const { can } = useAuth();
  const toast = useToast();
  const { data, error, reload } = useApi(() => api.listAnnouncements(course.id), [course.id]);
  const [editingId, setEditingId] = useState(null);
  const manages = (course.relation === 'teaching' || course.relation === 'overseeing') && can('announcement.manage');

  async function post(form) {
    await api.postAnnouncement(course.id, form);
    toast.success('Announcement posted.');
    reload();
  }
  async function save(id, form) {
    await api.updateAnnouncement(id, form);
    toast.success('Announcement saved.');
    setEditingId(null);
    reload();
  }
  async function remove(announcement) {
    if (!window.confirm(`Delete the announcement "${announcement.title}"?`)) return;
    try {
      await api.deleteAnnouncement(announcement.id);
      toast.success('Announcement deleted.');
      reload();
    } catch (failure) {
      toast.error(failure.message);
    }
  }

  if (error) return <Notice>{error.message}</Notice>;
  if (!data) return null;

  return (
    <>
      <h2>Announcements</h2>
      {manages && (
        <div className="inset">
          <AnnouncementForm onSave={post} />
        </div>
      )}
      {data.announcements.length === 0 ? (
        <p className="empty">No announcements yet.</p>
      ) : (
        data.announcements.map((announcement) => (
          <article key={announcement.id} className="inset outline-module" aria-labelledby={`announcement-${announcement.id}`}>
            {editingId === announcement.id ? (
              <AnnouncementForm announcement={announcement} onSave={(form) => save(announcement.id, form)} onCancel={() => setEditingId(null)} />
            ) : (
              <>
                <h3 id={`announcement-${announcement.id}`}>{announcement.title}</h3>
                <p className="field-hint">
                  {announcement.authorName ?? 'A former member of staff'} · {formatDateTime(announcement.createdAt)}
                </p>
                <LessonText text={announcement.body} emptyText="" />
                {manages && (
                  <div className="actions">
                    <button className="btn btn-sm" type="button" onClick={() => setEditingId(announcement.id)}>Edit</button>
                    <button className="btn btn-sm btn-danger" type="button" onClick={() => remove(announcement)}>Delete</button>
                  </div>
                )}
              </>
            )}
          </article>
        ))
      )}
    </>
  );
}
