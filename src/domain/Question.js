/**
 * Question entity: one exam item, matching the PRD columns.
 * @typedef {Object} Question
 * @property {string|null} id
 * @property {string} subject        mapel
 * @property {number|null} grade     kelas, 1-6
 * @property {string|null} chapter   bab
 * @property {'pg'|'isian'} type     tipe
 * @property {string} prompt         soal
 * @property {string|null} imagePath gambar (object path inside the bucket, not a URL)
 * @property {string|null} optionA
 * @property {string|null} optionB
 * @property {string|null} optionC
 * @property {string|null} optionD
 * @property {string} answer         jawaban: letter A-D for pg, text otherwise ('|' separates accepted answers)
 * @property {string|null} explanation pembahasan
 * @property {boolean} active        aktif
 */

export const GRADES = [1, 2, 3, 4, 5, 6];
export const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const optionalText = (value) => text(value) || null;
const normalize = (value) => text(value).toLowerCase().replace(/\s+/g, ' ');

const gradeOf = (value) => {
  const grade = Number(value);
  return GRADES.includes(grade) ? grade : null;
};

export function createQuestion(input = {}) {
  return {
    id: input.id ?? null,
    subject: text(input.subject),
    grade: gradeOf(input.grade),
    chapter: optionalText(input.chapter),
    type: input.type === 'isian' ? 'isian' : 'pg',
    prompt: text(input.prompt),
    imagePath: input.imagePath ?? null,
    optionA: optionalText(input.optionA),
    optionB: optionalText(input.optionB),
    optionC: optionalText(input.optionC),
    optionD: optionalText(input.optionD),
    answer: text(input.answer),
    explanation: optionalText(input.explanation),
    active: Boolean(input.active),
  };
}

export function optionText(question, letter) {
  return question[`option${letter.toUpperCase()}`] ?? null;
}

/** Filled options only, in A-D order. */
export function optionsOf(question) {
  return OPTION_LETTERS.map((letter) => ({ letter, text: optionText(question, letter) })).filter(
    (option) => option.text
  );
}

/**
 * PRD rules. A draft (active = false) is allowed to be incomplete,
 * so the editor can save half-written rows and review them before publishing.
 */
export function validateQuestion(question) {
  if (!question.active) return [];

  const errors = [];
  if (!question.subject) errors.push('Mapel wajib diisi.');
  if (!question.grade) errors.push('Kelas harus 1 sampai 6.');
  if (!question.prompt) errors.push('Soal wajib diisi.');
  if (!question.explanation) errors.push('Pembahasan wajib diisi.');

  if (question.type === 'pg') {
    if (optionsOf(question).length < 2) errors.push('Pilihan ganda butuh minimal 2 opsi.');

    const answer = question.answer.toUpperCase();
    if (!OPTION_LETTERS.includes(answer)) {
      errors.push('Jawaban pilihan ganda harus huruf A, B, C, atau D.');
    } else if (!optionText(question, answer)) {
      errors.push(`Opsi ${answer} belum diisi.`);
    }
  } else if (!question.answer) {
    errors.push('Kunci jawaban isian wajib diisi.');
  }

  return errors;
}

/** Empty is always wrong. Both sides are compared lowercased with collapsed spaces (PRD 4.1). */
export function isCorrect(question, response) {
  const given = normalize(response);
  if (!given) return false;
  if (question.type === 'pg') return given === question.answer.toLowerCase();

  return question.answer.toLowerCase().split('|').map(normalize).includes(given);
}

export function isAnswered(value) {
  return normalize(value) !== '';
}
