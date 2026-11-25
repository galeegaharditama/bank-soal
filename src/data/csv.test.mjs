import assert from 'node:assert/strict';
import { parseCsv, rowsToQuestions, questionsToCsv } from './csv.js';
import { createQuestion } from '../domain/Question.js';
import { buildTemplateCsv } from './csvTemplate.js';

assert.deepEqual(parseCsv('a,b\n"x, y","say ""hi"""\n'), [
  ['a', 'b'],
  ['x, y', 'say "hi"'],
]);

assert.deepEqual(parseCsv('mapel;kelas\nMatematika;3'), [
  ['mapel', 'kelas'],
  ['Matematika', '3'],
], 'semicolon export from Excel is detected');

assert.deepEqual(parseCsv('a,b\n"baris\nbaru",c'), [
  ['a', 'b'],
  ['baris\nbaru', 'c'],
], 'newline inside quotes stays in the field');

const HEADER =
  'mapel,kelas,bab,tipe,soal,gambar,opsi_a,opsi_b,opsi_c,opsi_d,jawaban,pembahasan,aktif';

const csv = [
  HEADER,
  'Matematika,3,Pecahan,pg,1/2 + 1/2 = ?,,1,2,,,A,Setengah tambah setengah jadi satu,tidak',
  'Matematika,3,Pecahan,pg,2/4 + 2/4 = ?,,1,2,,,A,Sama-sama seperempat jadi satu,ya',
  'IPA,3,Benda,esai,Sebutkan wujud air,,air,es,,,,Pembahasan,tidak',
  'IPA,3,Benda,isian,Sebutkan wujud air,,air,es,,,mencair,,ya',
  '',
].join('\n');

const { questions, rejected } = rowsToQuestions(csv);

assert.equal(questions.length, 2, 'two rows are ready, blank line ignored');
assert.equal(rejected.length, 2, 'two rows are rejected');
assert.deepEqual(rejected.map((entry) => entry.line), [4, 5]);
assert.match(rejected[0].errors[0], /Tipe tidak dikenal/);
assert.match(rejected[1].errors.join(' '), /Pembahasan wajib/);

assert.equal(questions[0].active, false, 'aktif = tidak stays a draft');
assert.equal(questions[1].active, true, 'aktif = ya publishes');
assert.equal(questions[1].grade, 3, 'kelas is a number');
assert.equal(questions[0].imagePath, null, 'empty gambar becomes null');

const withoutActive = rowsToQuestions(
  'mapel,kelas,tipe,soal,jawaban,pembahasan\nMatematika,3,isian,Soal?,Jawaban,Pembahasan'
);
assert.equal(withoutActive.questions[0].active, true, 'no aktif column means published');

const aliasHeaders = rowsToQuestions(
  ' Mata Pelajaran ,Kelas,Type,Prompt,Answer,Explanation\nIPA,4,isian,Apa itu hujan?,Titik air,Penjelasan'
);
assert.equal(aliasHeaders.questions.length, 1, 'header aliases are accepted');
assert.equal(aliasHeaders.questions[0].subject, 'IPA');
assert.equal(aliasHeaders.questions[0].type, 'isian');

assert.throws(() => rowsToQuestions('kelas,soal\n3,Halo'), /Kolom wajib tidak ditemukan: mapel/);

// The downloadable template must import as it is.
const template = rowsToQuestions(buildTemplateCsv());
assert.equal(template.questions.length, 2, 'template carries two example rows');
assert.equal(template.rejected.length, 0, 'template rows are valid');
assert.deepEqual(template.questions.map((question) => question.type), ['pg', 'isian']);
assert.ok(
  template.questions.every((question) => question.active === false),
  'examples stay drafts so a mistaken import cannot publish them'
);

// Export must survive this same importer untouched: comma, quote, newline, draft, alternatives.
const exported = questionsToCsv([
  createQuestion({
    subject: 'Matematika', grade: 3, chapter: 'Pecahan', type: 'pg',
    prompt: 'A, B "kutip" dan\nbaris baru', optionA: '1', optionB: '2',
    answer: 'A', explanation: 'Pembahasan', active: true,
  }),
  createQuestion({
    subject: 'Bahasa Jawa', grade: 1, type: 'isian',
    prompt: 'Mripat kanggo ...', answer: 'ndeleng|ningali', explanation: 'Pembahasan', active: false,
  }),
]);

assert.equal(
  exported.replace(/^\uFEFF/, '').split('\r\n')[0],
  '"mapel";"kelas";"bab";"tipe";"soal";"gambar";"opsi_a";"opsi_b";"opsi_c";"opsi_d";"jawaban";"pembahasan";"aktif"'
);

const roundTrip = rowsToQuestions(exported);
assert.equal(roundTrip.questions.length, 2, 'export can be imported back');
assert.equal(roundTrip.rejected.length, 0, 'exported rows are valid');
assert.equal(roundTrip.questions[0].prompt, 'A, B "kutip" dan\nbaris baru');
assert.equal(roundTrip.questions[0].grade, 3, 'kelas survives as a number');
assert.equal(roundTrip.questions[1].answer, 'ndeleng|ningali');
assert.equal(roundTrip.questions[1].chapter, null, 'empty bab becomes null');
assert.equal(roundTrip.questions[1].active, false, 'draft stays a draft');

console.log('CSV import checks passed.');
