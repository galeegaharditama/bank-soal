import { createQuestion, validateQuestion, GRADES } from '../domain/Question.js';
import { SupabaseQuestionRepository } from '../data/SupabaseQuestionRepository.js';
import { uploadImage } from '../data/imageStorage.js';
import { rowsToQuestions } from '../data/csv.js';
import { signIn, signOut, currentUser } from '../data/auth.js';
import { fillSelect, unique } from './dom.js';
import { SUPABASE_URL } from '../config.js';

const repository = new SupabaseQuestionRepository();
const $ = (id) => document.getElementById(id);

const TYPE_LABELS = { pg: 'Pilihan ganda', isian: 'Isian' };

let allQuestions = [];
let visibleQuestions = [];
let editingId = null;
let editingImagePath = null;
let pendingImport = [];

function setStatus(message, tone = 'info') {
  const status = $('status');
  status.textContent = message;
  status.dataset.tone = tone;
  status.hidden = !message;
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
  await refresh();
}

function fillDatalist(id, values) {
  const list = $(id);
  list.replaceChildren();

  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    list.append(option);
  }
}

function renderFilters() {
  const subjects = unique(allQuestions.map((question) => question.subject).filter(Boolean));
  fillDatalist('subject-options', subjects);
  fillDatalist('chapter-options', unique(allQuestions.map((question) => question.chapter).filter(Boolean)));

  fillSelect($('subject-filter'), subjects, 'Semua mapel');
  fillSelect($('grade-filter'), GRADES, 'Semua kelas', (grade) => `Kelas ${grade}`);
}

function applyFilters() {
  const subject = $('subject-filter').value;
  const grade = $('grade-filter').value;

  visibleQuestions = allQuestions.filter(
    (question) =>
      (!subject || question.subject === subject) && (!grade || String(question.grade) === grade)
  );
  renderRows();
}

function cell(text, className = null) {
  const node = document.createElement('td');
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function badgeCell(text, tone) {
  const node = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = `badge ${tone}`;
  badge.textContent = text;
  node.append(badge);
  return node;
}

function actionsCell(question) {
  const node = document.createElement('td');
  node.className = 'row';

  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'secondary';
  edit.textContent = 'Edit';
  edit.addEventListener('click', () => fillEditor(question));

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'secondary';
  remove.textContent = 'Hapus';
  remove.addEventListener('click', () => deleteQuestion(question));

  node.append(edit, remove);
  return node;
}

function renderRows() {
  const rows = $('question-rows');
  rows.replaceChildren();
  $('count').textContent = visibleQuestions.length ? `(${visibleQuestions.length})` : '';

  for (const question of visibleQuestions) {
    const row = document.createElement('tr');
    if (question.id === editingId) row.className = 'selected';

    row.append(
      cell(question.subject || '—'),
      cell(question.grade ? `Kelas ${question.grade}` : '—'),
      cell(question.chapter || '—'),
      cell(TYPE_LABELS[question.type] ?? question.type),
      cell(question.prompt || '—', 'cell-prompt'),
      badgeCell(question.active ? 'Aktif' : 'Draf', question.active ? 'active' : 'draft'),
      actionsCell(question)
    );
    rows.append(row);
  }
}

function syncTypeFields() {
  const isChoice = $('type').value === 'pg';
  $('option-fields').hidden = !isChoice;
  $('answer').placeholder = isChoice ? 'A / B / C / D' : 'mencair|melebur';
}

function fillEditor(question = null) {
  editingId = question?.id ?? null;
  editingImagePath = question?.imagePath ?? null;

  $('editor-title').textContent = editingId ? 'Edit soal' : 'Tambah soal';
  $('save').textContent = editingId ? 'Simpan perubahan' : 'Tambah soal';
  $('cancel').hidden = !editingId;

  $('subject').value = question?.subject ?? '';
  $('grade').value = question?.grade ? String(question.grade) : '';
  $('chapter').value = question?.chapter ?? '';
  $('type').value = question?.type ?? 'pg';
  $('prompt').value = question?.prompt ?? '';
  $('option-a').value = question?.optionA ?? '';
  $('option-b').value = question?.optionB ?? '';
  $('option-c').value = question?.optionC ?? '';
  $('option-d').value = question?.optionD ?? '';
  $('answer').value = question?.answer ?? '';
  $('explanation').value = question?.explanation ?? '';
  $('active').checked = Boolean(question?.active);
  $('image').value = '';

  syncTypeFields();
  renderRows();
}

async function refresh() {
  try {
    allQuestions = await repository.list();
    renderFilters();
    applyFilters();
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function deleteQuestion(question) {
  if (!confirm(`Hapus soal ini?\n\n${question.prompt ?? ''}`)) return;

  try {
    await repository.remove(question.id);
    if (editingId === question.id) fillEditor();
    await refresh();
    setStatus('Soal dihapus.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function renderImportReport(questions, rejected) {
  const report = $('import-report');
  report.replaceChildren();

  const summary = document.createElement('p');
  summary.textContent = rejected.length
    ? `${questions.length} soal siap diimpor, ${rejected.length} baris ditolak.`
    : `${questions.length} soal siap diimpor.`;
  report.append(summary);

  if (!rejected.length) return;

  const list = document.createElement('ul');
  list.className = 'reject-list';

  for (const entry of rejected.slice(0, 50)) {
    const item = document.createElement('li');
    item.textContent = `Baris ${entry.line}: ${entry.errors.join(' ')}`;
    list.append(item);
  }

  report.append(list);

  if (rejected.length > 50) {
    const rest = document.createElement('p');
    rest.className = 'muted';
    rest.textContent = `…dan ${rejected.length - 50} baris lain.`;
    report.append(rest);
  }
}

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
  allQuestions = [];
  visibleQuestions = [];
  showLogin();
});

$('type').addEventListener('change', syncTypeFields);
$('subject-filter').addEventListener('change', applyFilters);
$('grade-filter').addEventListener('change', applyFilters);

$('import-preview').addEventListener('click', async () => {
  const file = $('import-file').files[0];
  if (!file) {
    setStatus('Pilih file CSV dulu.', 'error');
    return;
  }

  try {
    const { questions, rejected } = rowsToQuestions(await file.text());
    pendingImport = questions;
    renderImportReport(questions, rejected);

    $('import-save').hidden = questions.length === 0;
    $('import-save').textContent = `Impor ${questions.length} soal`;
    setStatus('');
  } catch (error) {
    pendingImport = [];
    $('import-save').hidden = true;
    $('import-report').replaceChildren();
    setStatus(error.message, 'error');
  }
});

$('import-save').addEventListener('click', async () => {
  if (!pendingImport.length) return;

  const count = pendingImport.length;

  try {
    setStatus('Mengimpor…');
    await repository.createMany(pendingImport);

    pendingImport = [];
    $('import-file').value = '';
    $('import-report').replaceChildren();
    $('import-save').hidden = true;
    await refresh();
    setStatus(`${count} soal diimpor.`, 'success');
  } catch (error) {
    setStatus(`Impor gagal: ${error.message}`, 'error');
  }
});

$('cancel').addEventListener('click', () => {
  $('editor-form').reset();
  fillEditor();
});

$('editor-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const draft = createQuestion({
    subject: $('subject').value,
    grade: $('grade').value,
    chapter: $('chapter').value,
    type: $('type').value,
    prompt: $('prompt').value,
    optionA: $('option-a').value,
    optionB: $('option-b').value,
    optionC: $('option-c').value,
    optionD: $('option-d').value,
    answer: $('answer').value,
    explanation: $('explanation').value,
    imagePath: editingImagePath,
    active: $('active').checked,
  });

  const errors = validateQuestion(draft);
  if (errors.length) {
    setStatus(errors.join(' '), 'error');
    return;
  }

  const file = $('image').files[0];
  const isNew = !editingId;

  try {
    setStatus(isNew ? 'Menyimpan…' : 'Memperbarui…');
    if (file) draft.imagePath = await uploadImage(file);

    if (isNew) await repository.create(draft);
    else await repository.update(editingId, draft);

    $('editor-form').reset();
    fillEditor();
    await refresh();
    setStatus(isNew ? 'Soal ditambahkan.' : 'Soal diperbarui.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
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
