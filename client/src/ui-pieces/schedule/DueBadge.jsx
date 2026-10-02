// A student's mark on one deadline in the month calendar. The server works the mark out (see
// myDeadlines in scheduleController.js); this only chooses its words and colour. Nothing is shown
// for work not due yet, or to someone who teaches the course, so a busy day stays readable.
const MARKS = {
  handedIn: { label: 'Handed in', tone: 'tag-ok' },
  late: { label: 'Late', tone: 'tag-warn' },
  missing: { label: 'Missing', tone: 'tag-warn' },
};

export default function DueBadge({ status }) {
  const mark = MARKS[status];
  if (!mark) return null;
  return <span className={`tag ${mark.tone}`}>{mark.label}</span>;
}
