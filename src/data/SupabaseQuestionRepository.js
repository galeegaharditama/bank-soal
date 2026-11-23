import { QuestionRepository } from '../domain/QuestionRepository.js';
import { createQuestion } from '../domain/Question.js';
import { supabase } from './supabaseClient.js';

const TABLE = 'questions';
const COLUMNS =
  'id, mapel, kelas, bab, tipe, soal, gambar, opsi_a, opsi_b, opsi_c, opsi_d, jawaban, pembahasan, aktif';

const toEntity = (row) =>
  createQuestion({
    id: row.id,
    subject: row.mapel,
    grade: row.kelas,
    chapter: row.bab,
    type: row.tipe,
    prompt: row.soal,
    imagePath: row.gambar,
    optionA: row.opsi_a,
    optionB: row.opsi_b,
    optionC: row.opsi_c,
    optionD: row.opsi_d,
    answer: row.jawaban,
    explanation: row.pembahasan,
    active: row.aktif,
  });

const toRow = (question) => ({
  mapel: question.subject || null,
  kelas: question.grade,
  bab: question.chapter,
  tipe: question.type,
  soal: question.prompt || null,
  gambar: question.imagePath,
  opsi_a: question.optionA,
  opsi_b: question.optionB,
  opsi_c: question.optionC,
  opsi_d: question.optionD,
  jawaban: question.answer || null,
  pembahasan: question.explanation,
  aktif: question.active,
});

export class SupabaseQuestionRepository extends QuestionRepository {
  /** @param {{ activeOnly?: boolean }} [filter] */
  async list({ activeOnly = false } = {}) {
    let query = supabase.from(TABLE).select(COLUMNS).order('created_at', { ascending: false });
    if (activeOnly) query = query.eq('aktif', true);

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
      .eq('aktif', true)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    return data[0]?.updated_at ?? null;
  }
}
