// /schedule: a person's time across all their courses, in two views. "Week" shows their classes
// day by day; "Month" is a calendar of assignment due dates. /schedule?view=month opens the month.
import { useSearchParams } from 'react-router';
import Tabs from '../ui-pieces/basics/Tabs.jsx';
import MonthView from '../ui-pieces/schedule/MonthView.jsx';
import WeekView from '../ui-pieces/schedule/WeekView.jsx';

export default function Schedule() {
  const [searchParams] = useSearchParams();
  const tabs = [
    { id: 'week', label: 'Week', content: <WeekView /> },
    { id: 'month', label: 'Month', content: <MonthView /> },
  ];

  return (
    <main className="stack stack-wide" id="main">
      <title>Schedule — LearnHub</title>
      <Tabs label="Schedule views" tabs={tabs} initialId={searchParams.get('view') ?? undefined}>
        <h1>Schedule</h1>
        <p className="card-intro">Your classes week by week, and every due date month by month.</p>
      </Tabs>
    </main>
  );
}
