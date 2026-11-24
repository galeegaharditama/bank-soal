import { QuestionRepository } from '../domain/QuestionRepository.js';
import { createQuestion } from '../domain/Question.js';
import { supabase } from './supabaseClient.js';

const TABLE = 'questions';
const COLUMNS =
  'id, subject_id, chapter_id, grade, type, prompt, image_path, option_a, option_b, option_c, option_d, answer, explanation, active';

const toEntity = (row, subjectNames = new Map(), chapterNames = new Map()) =>
  createQuestion({
    id: row.id,
    subjectId: row.subject_id,
    chapterId: row.chapter_id,
    subject: subjectNames.get(row.subject_id) ?? '',
    chapter: chapterNames.get(row.chapter_id) ?? null,
    grade: row.grade,
    type: row.type,
    prompt: row.prompt,
    imagePath: row.image_path,
    optionA: row.option_a,
    optionB: row.option_b,
    optionC: row.option_c,
    optionD: row.option_d,
    answer: row.answer,
    explanation: row.explanation,
    active: row.active,
  });

const toRow = (question) => ({
  ...(question.id ? { id: question.id } : {}),
  subject_id: question.subjectId,
  chapter_id: question.chapterId,
  grade: question.grade,
  type: question.type,
  prompt: question.prompt || null,
  image_path: question.imagePath,
  option_a: question.optionA,
  option_b: question.optionB,
  option_c: question.optionC,
  option_d: question.optionD,
  answer: question.answer || null,
  explanation: question.explanation,
  active: question.active,
});

export class SupabaseQuestionRepository extends QuestionRepository {
  /** @param {{ activeOnly?: boolean }} [filter] */
  async list({ activeOnly = false } = {}) {
    let query = supabase.from(TABLE).select(COLUMNS).order('created_at', { ascending: false });
    if (activeOnly) query = query.eq('active', true);

    const [questions, subjects, chapters] = await Promise.all([
      query,
      supabase.from('subjects').select('id, name'),
      supabase.from('chapters').select('id, name'),
    ]);

    if (questions.error) throw questions.error;
    if (subjects.error) throw subjects.error;
    if (chapters.error) throw chapters.error;

    const subjectNames = new Map(subjects.data.map((row) => [row.id, row.name]));
    const chapterNames = new Map(chapters.data.map((row) => [row.id, row.name]));

    return questions.data.map((row) => toEntity(row, subjectNames, chapterNames));
  }

  async create(question) {
    const { data, error } = await supabase.from(TABLE).insert(toRow(question)).select(COLUMNS).single();
    if (error) throw error;
    return toEntity(data);
  }

  async update(id, question) {
    const { data, error } = await supabase.from(TABLE).update(toRow(question)).eq('id', id).select(COLUMNS).single();
    if (error) throw error;
    return toEntity(data);
  }

  async remove(id) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  }

  /** @param {string[]} ids */
  async removeMany(ids) {
    if (!ids.length) return;
    const { error } = await supabase.from(TABLE).delete().in('id', ids);
    if (error) throw error;
  }

  /** @param {string[]} ids @param {boolean} active */
  async setActive(ids, active) {
    if (!ids.length) return;
    const { error } = await supabase.from(TABLE).update({ active }).in('id', ids);
    if (error) throw error;
  }

  /** How many questions use a mapel or a bab; used before deleting one. */
  async count({ subjectId = null, chapterId = null } = {}) {
    let query = supabase.from(TABLE).select('id', { count: 'exact', head: true });
    if (subjectId) query = query.eq('subject_id', subjectId);
    if (chapterId) query = query.eq('chapter_id', chapterId);

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  /** Bulk insert for the CSV import, 100 rows per request. */
  async createMany(questions) {
    const rows = questions.map(toRow);

    for (let index = 0; index < rows.length; index += 100) {
      const { error } = await supabase.from(TABLE).insert(rows.slice(index, index + 100));
      if (error) throw error;
    }

    return rows.length;
  }

  /** Newest updated_at, shown in the header as "Data per ..." (PRD 6). */
  async latestUpdate() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('updated_at')
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    return data[0]?.updated_at ?? null;
  }
}
