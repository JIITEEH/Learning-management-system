// The bell in the top bar, with a panel that opens under it. The badge counts unread notifications:
// new announcements and assignments, returned grades, and being added to a course. Below them,
// "Coming up" lists the next few deadlines. The same design as the thesis management system's bell.
//
// The count refreshes every minute while the tab is in view, and whenever the panel opens.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Bell } from 'lucide-react';
import { api } from '../../api-client/api.js';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { formatDue, timeAgo } from '../../helpers/format.js';

const REFRESH_MS = 60 * 1000;
const UPCOMING_DAYS = 14;
const UPCOMING_SHOWN = 3;

// The next deadlines still to meet: due in the next two weeks, and for a student not handed in yet
async function loadUpcoming() {
  const now = new Date();
  const { deadlines } = await api.myDeadlines(now, new Date(now.getTime() + UPCOMING_DAYS * 86400000));
  return deadlines.filter((deadline) => deadline.status !== 'handedIn' && deadline.status !== 'late');
}

export default function Notifications() {
  const { can } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState(null);
  const [upcoming, setUpcoming] = useState(null);
  const [error, setError] = useState('');
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const seesDeadlines = can('schedule.read');

  const load = useCallback(async () => {
    try {
      setFeed(await api.listNotifications());
      setError('');
    } catch (failure) {
      setError(failure.message);
    }
  }, []);

  // Keep the badge current in the background, without asking while the tab is hidden
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Opening another screen closes the panel
  useEffect(() => setOpen(false), [location.pathname, location.search]);

  // While open: fresh contents, and Escape or a tap outside closes it
  useEffect(() => {
    if (!open) return undefined;
    load();
    if (seesDeadlines) loadUpcoming().then(setUpcoming, () => setUpcoming([]));

    function onKey(event) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(event) {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, load, seesDeadlines]);

  // Following a notification marks it read, so opening the thing is enough to dismiss it.
  // The badge changes straight away; if the server refuses, the next load puts it right.
  function follow(notification) {
    if (notification.readAt) return;
    setFeed((previous) => ({
      unread: Math.max(0, previous.unread - 1),
      notifications: previous.notifications.map((n) => (n.id === notification.id ? { ...n, readAt: 'now' } : n)),
    }));
    api.markNotificationRead(notification.id).catch(load);
  }

  async function markAllRead() {
    setFeed((previous) => ({ unread: 0, notifications: previous.notifications.map((n) => ({ ...n, readAt: n.readAt ?? 'now' })) }));
    try {
      await api.markAllNotificationsRead();
    } catch {
      load();
    }
  }

  const unread = feed?.unread ?? 0;
  const buttonLabel = unread ? `Notifications, ${unread} unread` : 'Notifications';

  return (
    <div className="notif" ref={wrapperRef}>
      <button ref={buttonRef} className="icon-btn" type="button" title={buttonLabel}
        aria-haspopup="dialog" aria-expanded={open} aria-controls="notif-panel" onClick={() => setOpen((value) => !value)}>
        <span className="visually-hidden">{buttonLabel}</span>
        <Bell aria-hidden="true" />
        {unread > 0 && <span className="notif-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel" id="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <h2>Notifications</h2>
            {unread > 0 && <button className="btn btn-sm" type="button" onClick={markAllRead}>Mark all as read</button>}
          </div>

          {!feed && error && <p className="notice notice-error">{error}</p>}
          {!feed && !error && <p className="field-hint">Loading…</p>}
          {feed && feed.notifications.length === 0 && <p className="field-hint">You are all caught up.</p>}
          {feed && feed.notifications.length > 0 && (
            <ul className="notif-list">
              {feed.notifications.map((n) => (
                <li key={n.id} className={n.readAt ? 'notif-item' : 'notif-item notif-unread'}>
                  <Link to={n.link || '/dashboard'} onClick={() => follow(n)}>
                    <span className="notif-dot" aria-hidden="true" />
                    <span className="notif-title">
                      {!n.readAt && <span className="visually-hidden">Unread: </span>}
                      {n.title}
                    </span>
                    {n.body && <span className="notif-body">{n.body}</span>}
                    <span className="notif-time">{timeAgo(n.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {seesDeadlines && (
            <div className="notif-section">
              <h3>Coming up</h3>
              {!upcoming && <p className="field-hint">Loading…</p>}
              {upcoming?.length === 0 && <p className="field-hint">Nothing due in the next {UPCOMING_DAYS} days.</p>}
              {upcoming?.length > 0 && (
                <ul className="notif-list">
                  {upcoming.slice(0, UPCOMING_SHOWN).map((deadline) => (
                    <li key={deadline.id} className="notif-item">
                      <Link to={`/courses/${deadline.courseId}/assignments/${deadline.id}`}>
                        <span className="notif-title">{deadline.courseCode} · {deadline.title}</span>
                        <span className="notif-time">Due {formatDue(deadline.dueAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link className="btn btn-sm" to="/schedule?view=month">
                {upcoming?.length > UPCOMING_SHOWN ? `See all ${upcoming.length} on the calendar` : 'Open the calendar'}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
