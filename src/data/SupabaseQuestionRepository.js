import { QuestionRepository } from '../domain/QuestionRepository.js';
import { createQuestion } from '../domain/Question.js';
import { supabase } from './supabaseClient.js';

const TABLE = 'questions';
const COLUMNS =
  'id, subject, grade, chapter, type, prompt, image_path, option_a, option_b, option_c, option_d, answer, explanation, active';

const toEntity = (row) =>
  createQuestion({
    id: row.id,
    subject: row.subject,
    grade: row.grade,
    chapter: row.chapter,
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
  subject: question.subject || null,
  grade: question.grade,
  chapter: question.chapter,
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

    const { data, error } = await query;
    if (error) throw error;
    return data.map(toEntity);
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
