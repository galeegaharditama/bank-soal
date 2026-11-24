import { GRADES } from '../domain/Question.js';
import { validateName } from '../domain/Taxonomy.js';
import { SupabaseTaxonomyRepository } from '../data/SupabaseTaxonomyRepository.js';
import { SupabaseQuestionRepository } from '../data/SupabaseQuestionRepository.js';
import { signIn, signOut, currentUser } from '../data/auth.js';
import { fillOptions } from './dom.js';
import { SUPABASE_URL } from '../config.js';

const taxonomy = new SupabaseTaxonomyRepository();
const questions = new SupabaseQuestionRepository();
const $ = (id) => document.getElementById(id);

let subjects = [];
let chapters = [];

function setStatus(message, tone = 'info') {
  const status = $('status');
  status.textContent = message;
  status.dataset.tone = tone;
  status.hidden = !message;
}

/** Turn Postgres unique violations into something a teacher can act on. */
const friendly = (error) =>
  error?.code === '23505' ? 'Nama itu sudah dipakai.' : (error?.message ?? 'Terjadi kesalahan.');

function listItem(name, onRename, onDelete, context) {
  const item = document.createElement('li');

  const text = document.createElement('span');
  text.textContent = name;

  const actions = document.createElement('span');
  actions.className = 'row';

  const rename = document.createElement('button');
  rename.type = 'button';
  rename.className = 'ghost';
  rename.textContent = 'Ganti nama';
  rename.setAttribute('aria-label', `Ganti nama ${context}: ${name}`);
  rename.addEventListener('click', onRename);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'ghost danger';
  remove.textContent = 'Hapus';
  remove.setAttribute('aria-label', `Hapus ${context}: ${name}`);
  remove.addEventListener('click', onDelete);

  actions.append(rename, remove);
  item.append(text, actions);
  return item;
}

function currentSubjectId() {
  return $('filter-subject').value;
}

function currentGrade() {
  return Number($('filter-grade').value) || null;
}

function renderSubjects() {
  const list = $('subject-list');
  list.replaceChildren();

  if (!subjects.length) {
    const empty = document.createElement('li');
    empty.className = 'muted';
    empty.textContent = 'Belum ada mapel. Tambah satu di atas.';
    list.append(empty);
    return;
  }

  for (const subject of subjects) {
    list.append(
      listItem(
        subject.name,
        () => renameSubject(subject),
        () => deleteSubject(subject),
        'mapel'
      )
    );
  }
}

function renderChapters() {
  const list = $('chapter-list');
  list.replaceChildren();
  $('chapter-form').querySelector('button').disabled = !currentSubjectId() || !currentGrade();

  if (!subjects.length) {
    const empty = document.createElement('li');
    empty.className = 'muted';
    empty.textContent = 'Buat mapel dulu.';
    list.append(empty);
    return;
  }

  if (!currentSubjectId() || !currentGrade()) {
    const empty = document.createElement('li');
    empty.className = 'muted';
    empty.textContent = 'Pilih mapel dan kelas dulu.';
    list.append(empty);
    return;
  }

  if (!chapters.length) {
    const empty = document.createElement('li');
    empty.className = 'muted';
    empty.textContent = 'Belum ada bab untuk pilihan ini.';
    list.append(empty);
    return;
  }

  for (const chapter of chapters) {
    list.append(
      listItem(
        chapter.name,
        () => renameChapter(chapter),
        () => deleteChapter(chapter),
        'bab'
      )
    );
  }
}

function renderFilters() {
  fillOptions($('filter-subject'), subjects, '— Pilih mapel —', (subject) => subject.id, (subject) => subject.name);
  fillOptions($('filter-grade'), GRADES, '— Pilih kelas —', (grade) => grade, (grade) => `Kelas ${grade}`);

  if (!currentSubjectId() && subjects.length) $('filter-subject').value = subjects[0].id;
  if (!currentGrade()) $('filter-grade').value = String(GRADES[0]);
}

async function loadAll() {
  subjects = await taxonomy.listSubjects();
  renderFilters();
  await loadChapters();
  renderSubjects();
}

async function loadChapters() {
  const subjectId = currentSubjectId();
  const grade = currentGrade();

  chapters = subjectId && grade ? await taxonomy.listChapters({ subjectId, grade }) : [];
  renderChapters();
}

function showLogin() {
  $('login-view').hidden = false;
  $('app-view').hidden = true;
  $('sign-out').hidden = true;
}

async function showApp() {
  $('login-view').hidden = true;
  $('app-view').hidden = false;
  $('sign-out').hidden = false;
  await loadAll();
}

async function renameSubject(subject) {
  const input = prompt(`Nama mapel "${subject.name}"`, subject.name);
  if (input === null) return;

  const errors = validateName(input, 'Nama mapel');
  if (errors.length) {
    setStatus(errors.join(' '), 'error');
    return;
  }

  try {
    await taxonomy.renameSubject(subject.id, input);
    await loadAll();
    setStatus('Mapel diperbarui. Nama soal ikut berubah.', 'success');
  } catch (error) {
    setStatus(friendly(error), 'error');
  }
}

async function deleteSubject(subject) {
  try {
    const used = await questions.count({ subjectId: subject.id });
    if (used) {
      setStatus(`"${subject.name}" masih dipakai ${used} soal. Pindahkan atau hapus soalnya dulu.`, 'error');
      return;
    }

    if (!confirm(`Hapus mapel "${subject.name}"?`)) return;

    await taxonomy.removeSubject(subject.id);
    await loadAll();
    setStatus('Mapel dihapus.', 'success');
  } catch (error) {
    setStatus(friendly(error), 'error');
  }
}

async function renameChapter(chapter) {
  const input = prompt(`Nama bab "${chapter.name}"`, chapter.name);
  if (input === null) return;

  const errors = validateName(input, 'Nama bab');
  if (errors.length) {
    setStatus(errors.join(' '), 'error');
    return;
  }

  try {
    await taxonomy.renameChapter(chapter.id, input);
    await loadChapters();
    setStatus('Bab diperbarui. Nama soal ikut berubah.', 'success');
  } catch (error) {
    setStatus(friendly(error), 'error');
  }
}

async function deleteChapter(chapter) {
  try {
    const used = await questions.count({ chapterId: chapter.id });
    if (used) {
      setStatus(`Bab "${chapter.name}" masih dipakai ${used} soal. Pindahkan atau hapus soalnya dulu.`, 'error');
      return;
    }

    if (!confirm(`Hapus bab "${chapter.name}"?`)) return;

    await taxonomy.removeChapter(chapter.id);
    await loadChapters();
    setStatus('Bab dihapus.', 'success');
  } catch (error) {
    setStatus(friendly(error), 'error');
  }
}

$('subject-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const errors = validateName($('subject-name').value, 'Nama mapel');
  if (errors.length) {
    setStatus(errors.join(' '), 'error');
    return;
  }

  try {
    await taxonomy.createSubject($('subject-name').value);
    $('subject-name').value = '';
    await loadAll();
    setStatus('Mapel ditambahkan.', 'success');
  } catch (error) {
    setStatus(friendly(error), 'error');
  }
});

$('chapter-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const errors = validateName($('chapter-name').value, 'Nama bab');
  if (errors.length) {
    setStatus(errors.join(' '), 'error');
    return;
  }

  try {
    await taxonomy.createChapter({
      subjectId: currentSubjectId(),
      grade: currentGrade(),
      name: $('chapter-name').value,
    });
    $('chapter-name').value = '';
    await loadChapters();
    setStatus('Bab ditambahkan.', 'success');
  } catch (error) {
    setStatus(friendly(error), 'error');
  }
});

$('filter-subject').addEventListener('change', () => {
  loadChapters().catch((error) => setStatus(error.message, 'error'));
});

$('filter-grade').addEventListener('change', () => {
  loadChapters().catch((error) => setStatus(error.message, 'error'));
});

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('Masuk…');

  try {
    await signIn($('login-email').value.trim(), $('login-password').value);
    setStatus('');
    await showApp();
  } catch (error) {
    setStatus(error.message, 'error');
  }
});

$('sign-out').addEventListener('click', async () => {
  await signOut();
  subjects = [];
  chapters = [];
  showLogin();
});

(async function boot() {
  if (SUPABASE_URL.includes('YOUR-PROJECT')) {
    setStatus('Isi SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY di src/config.js dulu.', 'error');
    return;
  }

  const user = await currentUser().catch(() => null);
  if (user) await showApp();
  else showLogin();
})();
