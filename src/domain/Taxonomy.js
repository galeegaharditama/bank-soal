/** Normalise a mapel/chapter name the same way everywhere (form, import, comparison). */
export const normalizeName = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

export const nameKey = (value) => normalizeName(value).toLowerCase();

/** Unique key for "this chapter in this mapel and kelas", used by the import planner. */
export const chapterKey = (subjectRef, grade, name) => `${subjectRef}|${grade}|${nameKey(name)}`;

export function validateName(value, label = 'Nama') {
  const name = normalizeName(value);
  if (!name) return [`${label} wajib diisi.`];
  if (name.length > 60) return [`${label} maksimal 60 karakter.`];
  return [];
}
