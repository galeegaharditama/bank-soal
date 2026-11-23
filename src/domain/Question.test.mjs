import assert from 'node:assert/strict';
import { createQuestion, validateQuestion, isCorrect } from './Question.js';

const choice = createQuestion({
  subject: '  Math ',
  type: 'multiple_choice',
  prompt: '2 + 2 = ?',
  optionA: '3',
  optionB: '4',
  answer: 'B',
});

assert.equal(choice.subject, 'Math', 'trims text');
assert.equal(choice.optionC, null, 'blank options become null');
assert.deepEqual(validateQuestion(choice), [], 'valid multiple choice passes');
assert.equal(isCorrect(choice, 'b'), true, 'answer letter is case-insensitive');
assert.equal(isCorrect(choice, 'A'), false);
assert.equal(isCorrect(choice, '  '), false, 'blank answer is wrong');

assert.equal(
  validateQuestion(createQuestion({ prompt: 'x' })).length,
  4,
  'subject, answer, options and answer letter are all reported'
);
assert.equal(
  validateQuestion(createQuestion({ subject: 's', prompt: 'p', optionA: '1', optionB: '2', answer: 'E' })).length,
  1,
  'answer must be A-D for multiple choice'
);
assert.equal(
  validateQuestion(createQuestion({ subject: 's', prompt: 'p', answer: 'B' })).length,
  1,
  'multiple choice needs options'
);

const short = createQuestion({ subject: 's', type: 'short_answer', prompt: 'p', answer: '3 | tiga' });
assert.equal(isCorrect(short, 'Tiga'), true, 'accepted alternatives are matched');
assert.equal(isCorrect(short, '3'), true);
assert.equal(isCorrect(short, '4'), false);
assert.deepEqual(validateQuestion(short), [], 'short answer needs no options');

console.log('Question domain checks passed.');
