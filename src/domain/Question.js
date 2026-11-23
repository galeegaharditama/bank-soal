/**
 * Question entity: one exam item. Plain object, no I/O.
 * @typedef {Object} Question
 * @property {string|null} id
 * @property {string} subject
 * @property {string|null} topic
 * @property {'multiple_choice'|'short_answer'} type
 * @property {string} prompt
 * @property {string|null} optionA
 * @property {string|null} optionB
 * @property {string|null} optionC
 * @property {string|null} optionD
 * @property {string} answer  a letter A-D for multiple choice, free text otherwise ('|' separates accepted answers)
 * @property {string|null} explanation
 * @property {string|null} imagePath  object path inside the bucket, not a URL
 */

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const optionalText = (value) => text(value) || null;

export function createQuestion(input = {}) {
  return {
    id: input.id ?? null,
    subject: text(input.subject),
    topic: optionalText(input.topic),
    type: input.type === 'short_answer' ? 'short_answer' : 'multiple_choice',
    prompt: text(input.prompt),
    optionA: optionalText(input.optionA),
    optionB: optionalText(input.optionB),
    optionC: optionalText(input.optionC),
    optionD: optionalText(input.optionD),
    answer: text(input.answer),
    explanation: optionalText(input.explanation),
    imagePath: input.imagePath ?? null,
  };
}

export function validateQuestion(question) {
  const errors = [];
  if (!question.subject) errors.push('Subject is required.');
  if (!question.prompt) errors.push('Question text is required.');
  if (!question.answer) errors.push('Answer is required.');

  if (question.type === 'multiple_choice') {
    if (!question.optionA || !question.optionB) errors.push('Multiple choice needs at least options A and B.');
    if (!/^[a-d]$/i.test(question.answer)) errors.push('Multiple choice answer must be a letter A, B, C or D.');
  }
  return errors;
}

export function isCorrect(question, response) {
  const given = text(response).toLowerCase();
  if (!given) return false;
  if (question.type === 'multiple_choice') return given === question.answer.toLowerCase();

  return question.answer
    .toLowerCase()
    .split('|')
    .map((accepted) => accepted.trim())
    .includes(given);
}
