// How a student's total is worked out. One function, used by the gradebook, its CSV export and a
// student's own summary, so the three can never disagree.
//
// Quizzes count the same way, as items with a due date (when they close) and a maximum (their
// questions' points); quizItems() below turns quiz rows into that shape.
//
// Each assignment falls into one of three cases:
//   scored            the score counts, out of the assignment's maximum
//   waiting           handed in but not scored yet (or, for a student, not returned yet): left out
//   nothing handed in counts as 0 out of the maximum once past due; before that, left out

// The current time in the form MySQL stores (UTC 'YYYY-MM-DD HH:MM:SS'), so it can be compared
// with due dates as text
export const nowUtc = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

// Published quizzes as gradebook items: the same due_at and max_score fields an assignment has
export const quizItems = (quizzes) =>
  quizzes.filter((quiz) => quiz.is_published).map((quiz) => ({ ...quiz, max_score: quiz.total_points, isQuiz: true }));

// `resultFor(assignment)` returns a number (the score to count), 'waiting', or null (nothing
// handed in). Returns { earned, possible, percent }; percent is null while nothing counts.
export function totalFor(assignments, resultFor, now = nowUtc()) {
  let earned = 0;
  let possible = 0;
  for (const assignment of assignments) {
    const result = resultFor(assignment);
    const pastDue = assignment.due_at !== null && assignment.due_at < now;
    if (typeof result === 'number') {
      earned += result;
      possible += Number(assignment.max_score);
    } else if (result === null && pastDue) {
      possible += Number(assignment.max_score);
    }
  }
  return { earned, possible, percent: possible > 0 ? Math.round((earned / possible) * 1000) / 10 : null };
}
