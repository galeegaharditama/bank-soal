import { createQuestion, validateQuestion } from '../domain/Question.js';

/** Header aliases, so an existing sheet works without renaming columns. */
const ALIASES = {
  mapel: ['mapel', 'mata_pelajaran', 'subject'],
  kelas: ['kelas', 'grade'],
  bab: ['bab', 'chapter'],
  tipe: ['tipe', 'type'],
  soal: ['soal', 'pertanyaan', 'prompt'],
  gambar: ['gambar', 'image', 'image_path'],
  opsi_a: ['opsi_a', 'option_a'],
  opsi_b: ['opsi_b', 'option_b'],
  opsi_c: ['opsi_c', 'option_c'],
  opsi_d: ['opsi_d', 'option_d'],
  jawaban: ['jawaban', 'answer'],
  pembahasan: ['pembahasan', 'explanation'],
  aktif: ['aktif', 'active'],
};

const normalizeHeader = (value) => String(value).trim().toLowerCase().replace(/\s+/g, '_');

const detectDelimiter = (text) => {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
};

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, newlines inside quotes, comma or semicolon. */
export function parseCsv(text) {
  const source = String(text).replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(source);

  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index++) {
    const char = source[index];

    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

const findColumn = (headers, key) => {
  for (const alias of ALIASES[key]) {
    const index = headers.indexOf(alias);
    if (index !== -1) return index;
  }
  return -1;
};

const typeOf = (value) => {
  const raw = value.toLowerCase();
  if (!raw || raw === 'pg' || raw === 'pilihan ganda' || raw === 'pilihan_ganda') return 'pg';
  if (raw === 'isian' || raw === 'jawaban singkat' || raw === 'jawaban_singkat') return 'isian';
  return null;
};

const activeOf = (value, hasColumn) => {
  if (!hasColumn || !value) return true;
  return ['ya', 'y', 'true', '1', 'aktif'].includes(value.toLowerCase());
};

/**
 * Turn a CSV export into validated questions.
 * Rows that break the PRD rules are returned separately with their line number,
 * nothing is written by this function.
 */
export function rowsToQuestions(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { questions: [], rejected: [] };

  const headers = rows[0].map(normalizeHeader);
  const missing = ['mapel', 'soal'].filter((key) => findColumn(headers, key) === -1);
  if (missing.length) {
    throw new Error(`Kolom wajib tidak ditemukan: ${missing.join(', ')}.`);
  }

  const columns = Object.fromEntries(
    Object.keys(ALIASES).map((key) => [key, findColumn(headers, key)])
  );
  const hasActiveColumn = columns.aktif !== -1;

  const questions = [];
  const rejected = [];

  rows.slice(1).forEach((cells, index) => {
    const line = index + 2;
    if (cells.every((cell) => cell.trim() === '')) return;

    const value = (key) => (columns[key] === -1 ? '' : (cells[columns[key]] ?? '').trim());

    const type = typeOf(value('tipe'));
    if (!type) {
      rejected.push({ line, errors: [`Tipe tidak dikenal: "${value('tipe')}". Pakai pg atau isian.`] });
      return;
    }

    const question = createQuestion({
      subject: value('mapel'),
      grade: value('kelas'),
      chapter: value('bab'),
      type,
      prompt: value('soal'),
      imagePath: value('gambar') || null,
      optionA: value('opsi_a'),
      optionB: value('opsi_b'),
      optionC: value('opsi_c'),
      optionD: value('opsi_d'),
      answer: value('jawaban'),
      explanation: value('pembahasan'),
      active: activeOf(value('aktif'), hasActiveColumn),
    });

    const errors = validateQuestion(question);
    if (errors.length) rejected.push({ line, errors, prompt: question.prompt });
    else questions.push(question);
  });

  return { questions, rejected };
}
