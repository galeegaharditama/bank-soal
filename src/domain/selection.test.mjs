import assert from 'node:assert/strict';
import { selectQuestions, groupByType, countByType } from './selection.js';

const make = (type, count) =>
  Array.from({ length: count }, (_, index) => ({ type, id: `${type}-${index}` }));

const typesOf = (questions) => questions.map((question) => question.type);

// 75% of 20 = 15, the rest is 5.
const balanced = selectQuestions([...make('pg', 30), ...make('isian', 10)], 20);
assert.equal(balanced.length, 20);
assert.deepEqual(typesOf(balanced), [...Array(15).fill('pg'), ...Array(5).fill('isian')]);

// Short multiple choice stock is filled up with written questions.
const shortPg = selectQuestions([...make('pg', 4), ...make('isian', 40)], 20);
assert.equal(shortPg.length, 20);
assert.deepEqual(typesOf(shortPg), [...Array(4).fill('pg'), ...Array(16).fill('isian')]);

// Short written stock is filled up with multiple choice.
const shortIsian = selectQuestions([...make('pg', 40), ...make('isian', 2)], 10);
assert.equal(shortIsian.length, 10);
assert.deepEqual(typesOf(shortIsian), [...Array(8).fill('pg'), ...Array(2).fill('isian')]);

// A small bank simply returns everything it has, still grouped.
const smallBank = selectQuestions([...make('pg', 4), ...make('isian', 6)], 20);
assert.equal(smallBank.length, 10);
assert.deepEqual(typesOf(smallBank), [...Array(4).fill('pg'), ...Array(6).fill('isian')]);

// Asking for more than the filter holds (Matematika bab 2 with 10 rows).
const filtered = selectQuestions([...make('pg', 8), ...make('isian', 2)], 50);
assert.equal(filtered.length, 10);

assert.deepEqual(typesOf(selectQuestions(make('isian', 6), 10)), Array(6).fill('isian'));
assert.deepEqual(selectQuestions(make('pg', 5), 0), [], 'zero questions means empty session');
assert.deepEqual(selectQuestions(make('pg', 5), Number.NaN), [], 'invalid amount means empty session');
assert.equal(selectQuestions(make('pg', 5), 1).length, 1);
assert.equal(countByType([...make('pg', 3), ...make('isian', 2)]).pg, 3);
assert.equal(countByType([...make('pg', 3), ...make('isian', 2)]).total, 5);

// Repeat-the-wrong keeps the set, only the order changes.
const wrong = [
  { type: 'isian', id: 'i1' },
  { type: 'pg', id: 'p1' },
  { type: 'isian', id: 'i2' },
  { type: 'pg', id: 'p2' },
];
assert.deepEqual(groupByType(wrong).map((question) => question.id), ['p1', 'p2', 'i1', 'i2']);

console.log('Question selection checks passed.');
