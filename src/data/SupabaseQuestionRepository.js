import { QuestionRepository } from '../domain/QuestionRepository.js';
import { createQuestion } from '../domain/Question.js';
import { supabase } from './supabaseClient.js';

const TABLE = 'questions';
const COLUMNS = 'id, subject, topic, type, prompt, option_a, option_b, option_c, option_d, answer, explanation, image_path';

const toEntity = (row) =>
  createQuestion({
    id: row.id,
    subject: row.subject,
    topic: row.topic,
    type: row.type,
    prompt: row.prompt,
    optionA: row.option_a,
    optionB: row.option_b,
    optionC: row.option_c,
    optionD: row.option_d,
    answer: row.answer,
    explanation: row.explanation,
    imagePath: row.image_path,
  });

const toRow = (question) => ({
  subject: question.subject,
  topic: question.topic,
  type: question.type,
  prompt: question.prompt,
  option_a: question.optionA,
  option_b: question.optionB,
  option_c: question.optionC,
  option_d: question.optionD,
  answer: question.answer,
  explanation: question.explanation,
  image_path: question.imagePath,
});

export class SupabaseQuestionRepository extends QuestionRepository {
  async list({ subject } = {}) {
    let query = supabase.from(TABLE).select(COLUMNS).order('created_at', { ascending: false });
    if (subject) query = query.eq('subject', subject);

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
}
