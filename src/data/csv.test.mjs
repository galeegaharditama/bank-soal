import assert from 'node:assert/strict';
import { parseCsv, rowsToQuestions } from './csv.js';

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

console.log('CSV import checks passed.');
