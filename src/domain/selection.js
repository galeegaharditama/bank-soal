/**
 * How many of the requested questions are multiple choice. Keep it here so it is easy to change.
 */
export const PG_SHARE = 0.75;

const countOf = (questions, type) => questions.filter((question) => question.type === type).length;

/**
 * Pick one session out of the candidates, with every multiple choice question first.
 * A short type is topped up from the other one, so the session is as long as the bank allows.
 * @param {import('./Question.js').Question[]} pool already shuffled by the caller
 * @param {number} amount how many questions were asked for
 * @param {number} [pgShare]
 * @returns {import('./Question.js').Question[]}
 */
export function selectQuestions(pool, amount, pgShare = PG_SHARE) {
  const requested = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  if (!requested) return [];

  const pg = pool.filter((question) => question.type === 'pg');
  const isian = pool.filter((question) => question.type === 'isian');

  const pgTarget = Math.min(pg.length, Math.round(requested * pgShare));
  const isianTarget = Math.min(isian.length, requested - pgTarget);

  const shortfall = requested - pgTarget - isianTarget;
  const pgExtra = Math.min(shortfall, pg.length - pgTarget);
  const isianExtra = Math.min(shortfall - pgExtra, isian.length - isianTarget);

  return [
    ...pg.slice(0, pgTarget + pgExtra),
    ...isian.slice(0, isianTarget + isianExtra),
  ];
}

/** Same grouping without picking: used by "repeat the wrong ones", which keeps exactly that set. */
export function groupByType(questions) {
  return [
    ...questions.filter((question) => question.type === 'pg'),
    ...questions.filter((question) => question.type === 'isian'),
  ];
}

/** Counts shown on the start screen. */
export function countByType(questions) {
  return { total: questions.length, pg: countOf(questions, 'pg'), isian: countOf(questions, 'isian') };
}
