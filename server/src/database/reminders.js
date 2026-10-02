// Reminds students about deadlines: a day before an assignment is due or a quiz closes, and once an
// assignment is overdue (late work is still accepted). Each reminder is a notification on the bell
// and an email with the same words, and is recorded so it is never sent twice, however often this
// runs. The same job as the thesis management system's.
//
// Run once a day from the top of the project:  npm run reminders
// (for example from cron: 0 7 * * *  cd /path/to/web-portfolio && npm run reminders)
import { pathToFileURL } from 'node:url';
import config from '../config/index.js';
import * as Notification from '../database-queries/notificationModel.js';
import * as Reminder from '../database-queries/reminderModel.js';
import { nowUtc } from '../helpers/grades.js';
import { deadlineReminderMessage, explainEmailError, sendEmail } from '../helpers/email.js';
import { pool } from './index.js';

// What the reminder says. No exact time: the server cannot know each reader's time zone, and the
// page it links to shows the time in theirs.
export function reminderWords(row) {
  const course = `${row.course_code} · ${row.course_title}.`;
  if (row.item_type === 'quiz') {
    return {
      headline: `${row.title} closes within a day`,
      detail: `${course} You have not taken this quiz yet, and once it closes it cannot be started.`,
    };
  }
  if (row.kind === 'overdue') {
    return {
      headline: `${row.title} is overdue`,
      detail: `${course} Nothing has been handed in yet. Late work is still accepted, and is marked late.`,
    };
  }
  return { headline: `${row.title} is due within a day`, detail: `${course} You have not handed it in yet.` };
}

const linkFor = (row) => `/courses/${row.course_id}/${row.item_type === 'quiz' ? 'quizzes' : 'assignments'}/${row.item_id}`;

// Sends every reminder owed now. Returns what happened, for the command line and the tests.
// `now` (UTC 'YYYY-MM-DD HH:MM:SS') and `send` can be replaced in tests.
export async function sendDeadlineReminders({ now = nowUtc(), send = sendEmail } = {}) {
  const summary = { reminders: 0, emailed: 0, emailFailures: [] };

  for (const row of await Reminder.owed(now)) {
    // Recorded first: if another run got here at the same moment, it has claimed this one
    const claimed = await Reminder.record({
      userId: row.user_id, itemType: row.item_type, itemId: row.item_id, dueAt: row.due_at, kind: row.kind,
    });
    if (!claimed) continue;

    const words = reminderWords(row);
    await Notification.notify({
      recipients: [row.user_id],
      type: `reminder.${row.kind}`,
      title: words.headline,
      body: words.detail,
      link: linkFor(row),
    });
    summary.reminders += 1;

    // A failed email is reported but not retried: the student has already been told on the bell
    try {
      await send(deadlineReminderMessage({ to: row.email, fullName: row.full_name, ...words, url: `${config.appUrl}${linkFor(row)}` }));
      if (config.mail.host) summary.emailed += 1;
    } catch (error) {
      summary.emailFailures.push({ to: row.email, error: explainEmailError(error) });
    }
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const summary = await sendDeadlineReminders();
    const stamp = new Date().toISOString();
    if (summary.reminders === 0) console.log(`${stamp} No deadline reminders due.`);
    else console.log(`${stamp} Sent ${summary.reminders} deadline reminder(s), ${summary.emailed} by email.`);
    for (const failure of summary.emailFailures) console.warn(`  Could not email ${failure.to}: ${failure.error}`);
  } finally {
    await pool.end();
  }
}
