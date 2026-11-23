import assert from 'node:assert/strict';
import { createQuestion, validateQuestion, isCorrect, isAnswered, optionsOf } from './Question.js';

const hasError = (question, fragment) =>
  validateQuestion(question).some((message) => message.includes(fragment));

const base = {
  subject: 'Matematika',
  grade: '3',
  chapter: 'Pecahan',
  type: 'pg',
  prompt: '1/2 + 1/2 = ?',
  optionA: '1',
  optionB: '2',
  answer: 'a',
  explanation: 'Dua setengah kalau digabung menjadi satu.',
  active: true,
};

const choice = createQuestion(base);
assert.equal(choice.grade, 3, 'kelas stored as a number');
assert.equal(choice.chapter, 'Pecahan');
assert.deepEqual(validateQuestion(choice), [], 'active question passes the PRD rules');
assert.equal(isAnswered('   '), false, 'whitespace is not an answer');
assert.equal(isAnswered('4'), true);

assert.equal(isCorrect(choice, 'A'), true, 'answer letter is case-insensitive');
assert.equal(isCorrect(choice, 'a'), true);
assert.equal(isCorrect(choice, 'B'), false);
assert.equal(isCorrect(choice, ''), false, 'empty answer is wrong');
assert.deepEqual(
  optionsOf(choice).map((option) => option.letter),
  ['A', 'B'],
  'only filled options are offered'
);

assert.deepEqual(validateQuestion(createQuestion({})), [], 'draft (active = false) may stay empty');

assert.equal(hasError(createQuestion({ ...base, answer: 'E' }), 'huruf A, B, C'), true);
assert.equal(hasError(createQuestion({ ...base, answer: 'C' }), 'Opsi C belum diisi'), true);
assert.equal(hasError(createQuestion({ ...base, optionB: '' }), 'minimal 2 opsi'), true);
assert.equal(hasError(createQuestion({ ...base, explanation: '  ' }), 'Pembahasan wajib'), true);
assert.equal(hasError(createQuestion({ ...base, grade: 7 }), 'Kelas harus 1 sampai 6'), true);
assert.equal(hasError(createQuestion({ ...base, subject: '' }), 'Mapel wajib'), true);

const short = createQuestion({
  subject: 'IPA',
  grade: 3,
  type: 'isian',
  prompt: 'Es berubah menjadi air disebut...',
  answer: 'mencair|melebur',
  explanation: 'Perubahan dari padat ke cair.',
  active: true,
});

assert.deepEqual(validateQuestion(short), [], 'isian needs no options');
assert.equal(isCorrect(short, 'Melebur'), true, 'accepted alternatives match');
assert.equal(isCorrect(short, '  mencair  '), true, 'surrounding spaces are ignored');
assert.equal(isCorrect(short, 'menguap'), false);
assert.equal(hasError(createQuestion({ ...short, answer: '' }), 'Kunci jawaban isian'), true);

console.log('Question domain checks passed.');
