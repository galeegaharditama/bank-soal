import assert from 'node:assert/strict';
import { chapterKey, nameKey, normalizeName, validateName } from './Taxonomy.js';

assert.equal(normalizeName('  Matematika   Dasar '), 'Matematika Dasar', 'trims and collapses spaces');
assert.equal(normalizeName(null), '');
assert.equal(nameKey('PECAHAN'), 'pecahan', 'comparison ignores case');
assert.equal(nameKey('  Pecahan '), 'pecahan');

assert.deepEqual(validateName('Matematika'), []);
assert.deepEqual(validateName('   '), ['Nama wajib diisi.']);
assert.deepEqual(validateName('x'.repeat(61)), ['Nama maksimal 60 karakter.']);
assert.deepEqual(validateName('', 'Nama mapel'), ['Nama mapel wajib diisi.']);

assert.equal(chapterKey('subject-1', 3, 'Pecahan'), 'subject-1|3|pecahan');
assert.equal(chapterKey('subject-1', 3, ' pecahan '), 'subject-1|3|pecahan');
assert.notEqual(chapterKey('subject-1', 3, 'Pecahan'), chapterKey('subject-1', 4, 'Pecahan'));

console.log('Taxonomy checks passed.');
