import { supabase } from './supabaseClient.js';
import { chapterKey, nameKey, normalizeName } from '../domain/Taxonomy.js';

const SUBJECTS = 'subjects';
const CHAPTERS = 'chapters';

const toSubject = (row) => ({ id: row.id, name: row.name });
const toChapter = (row) => ({ id: row.id, subjectId: row.subject_id, grade: row.grade, name: row.name });

export class SupabaseTaxonomyRepository {
  async listSubjects() {
    const { data, error } = await supabase.from(SUBJECTS).select('id, name').order('name');
    if (error) throw error;
    return data.map(toSubject);
  }

  async listChapters({ subjectId, grade } = {}) {
    let query = supabase.from(CHAPTERS).select('id, subject_id, grade, name').order('grade').order('name');
    if (subjectId) query = query.eq('subject_id', subjectId);
    if (grade) query = query.eq('grade', grade);

    const { data, error } = await query;
    if (error) throw error;
    return data.map(toChapter);
  }

  async createSubject(name) {
    const { data, error } = await supabase
      .from(SUBJECTS)
      .insert({ name: normalizeName(name) })
      .select('id, name')
      .single();

    if (error) throw error;
    return toSubject(data);
  }

  async renameSubject(id, name) {
    const { data, error } = await supabase
      .from(SUBJECTS)
      .update({ name: normalizeName(name) })
      .eq('id', id)
      .select('id, name')
      .single();

    if (error) throw error;
    return toSubject(data);
  }

  async removeSubject(id) {
    const { error } = await supabase.from(SUBJECTS).delete().eq('id', id);
    if (error) throw error;
  }

  async createChapter({ subjectId, grade, name }) {
    const { data, error } = await supabase
      .from(CHAPTERS)
      .insert({ subject_id: subjectId, grade, name: normalizeName(name) })
      .select('id, subject_id, grade, name')
      .single();

    if (error) throw error;
    return toChapter(data);
  }

  async renameChapter(id, name) {
    const { data, error } = await supabase
      .from(CHAPTERS)
      .update({ name: normalizeName(name) })
      .eq('id', id)
      .select('id, subject_id, grade, name')
      .single();

    if (error) throw error;
    return toChapter(data);
  }

  async removeChapter(id) {
    const { error } = await supabase.from(CHAPTERS).delete().eq('id', id);
    if (error) throw error;
  }

  /** Read-only: which mapel/bab an import would create. */
  async plan(questions) {
    const subjects = await this.listSubjects();
    const chapters = await this.listChapters();

    const subjectByKey = new Map(subjects.map((subject) => [nameKey(subject.name), subject]));
    const missingSubjects = [];
    const missingChapters = [];
    const seenSubjects = new Set();
    const seenChapters = new Set();

    for (const question of questions) {
      const subjectToken = nameKey(question.subject);
      if (!subjectToken) continue;

      const subject = subjectByKey.get(subjectToken);
      const subjectRef = subject ? subject.id : `new:${subjectToken}`;

      if (!subject && !seenSubjects.has(subjectToken)) {
        seenSubjects.add(subjectToken);
        missingSubjects.push(normalizeName(question.subject));
      }

      if (!question.chapter || !question.grade) continue;

      const key = chapterKey(subjectRef, question.grade, question.chapter);
      if (seenChapters.has(key)) continue;

      const exists = chapters.some(
        (chapter) =>
          chapter.subjectId === subjectRef &&
          chapter.grade === question.grade &&
          nameKey(chapter.name) === nameKey(question.chapter)
      );
      if (exists) continue;

      seenChapters.add(key);
      missingChapters.push({
        subjectName: normalizeName(question.subject),
        grade: question.grade,
        name: normalizeName(question.chapter),
      });
    }

    return { missingSubjects, missingChapters };
  }

  /** Create whatever an import needs, then hand back the id lookups. */
  async ensure(questions) {
    const subjects = await this.listSubjects();
    const subjectByKey = new Map(subjects.map((subject) => [nameKey(subject.name), subject]));

    for (const question of questions) {
      const token = nameKey(question.subject);
      if (!token || subjectByKey.has(token)) continue;
      subjectByKey.set(token, await this.createSubject(question.subject));
    }

    const chapters = await this.listChapters();
    const chapterByKey = new Map(
      chapters.map((chapter) => [chapterKey(chapter.subjectId, chapter.grade, chapter.name), chapter])
    );

    for (const question of questions) {
      const subject = subjectByKey.get(nameKey(question.subject));
      if (!subject || !question.chapter || !question.grade) continue;

      const key = chapterKey(subject.id, question.grade, question.chapter);
      if (chapterByKey.has(key)) continue;

      chapterByKey.set(
        key,
        await this.createChapter({ subjectId: subject.id, grade: question.grade, name: question.chapter })
      );
    }

    return {
      subjectIdFor: (name) => subjectByKey.get(nameKey(name))?.id ?? null,
      chapterIdFor: (question) => {
        const subject = subjectByKey.get(nameKey(question.subject));
        if (!subject) return null;
        return chapterByKey.get(chapterKey(subject.id, question.grade, question.chapter))?.id ?? null;
      },
    };
  }
}
