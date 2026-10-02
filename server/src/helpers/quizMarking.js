// How a quiz answer is marked. Each question is all or nothing: its full points, or none.
//   single, true_false   the one option chosen is a right one
//   multiple             every right option is chosen, and no wrong one
//   short                the typed answer matches an accepted answer, ignoring capital letters
//                        and extra spaces ("  Paris " and "paris" both match "Paris")

// "  New   York " -> "new york"
export const normalise = (text) => String(text ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// `question` is a quiz_questions row, `options` its quiz_options rows, `answer` what the student
// sent: { optionIds: [..], text: '' }. Returns what is stored in quiz_answers.
export function markAnswer(question, options, answer = {}) {
  const points = Number(question.points);
  const optionIds = Array.isArray(answer.optionIds) ? answer.optionIds.map(Number) : [];
  const text = String(answer.text ?? '').slice(0, 500);

  if (question.kind === 'short') {
    const isCorrect = text.trim() !== '' && options.some((option) => normalise(option.label) === normalise(text));
    return { questionId: question.id, optionIds: '', textAnswer: text, isCorrect, pointsAwarded: isCorrect ? points : 0 };
  }

  // Only this question's own options count: an id from another question is simply ignored
  const ownIds = new Set(options.map((option) => option.id));
  const chosen = [...new Set(optionIds.filter((id) => ownIds.has(id)))].sort((a, b) => a - b);
  const right = options.filter((option) => option.is_correct).map((option) => option.id).sort((a, b) => a - b);

  let isCorrect;
  if (question.kind === 'multiple') {
    isCorrect = chosen.length === right.length && chosen.every((id, index) => id === right[index]);
  } else {
    isCorrect = chosen.length === 1 && right.includes(chosen[0]);
  }
  return { questionId: question.id, optionIds: chosen.join(','), textAnswer: '', isCorrect, pointsAwarded: isCorrect ? points : 0 };
}

// Marks a whole attempt. `answers` is the list the student sent; a question they left out is
// marked as unanswered (wrong). Returns { answers, score }.
export function markAttempt(questions, options, answers = []) {
  const sent = new Map((Array.isArray(answers) ? answers : []).map((answer) => [Number(answer?.questionId), answer]));
  const marked = questions.map((question) =>
    markAnswer(question, options.filter((option) => option.question_id === question.id), sent.get(question.id)),
  );
  // Points are kept to two decimal places, as in the table
  const score = Math.round(marked.reduce((sum, answer) => sum + answer.pointsAwarded, 0) * 100) / 100;
  return { answers: marked, score };
}
