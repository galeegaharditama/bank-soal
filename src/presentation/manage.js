import { createQuestion, validateQuestion, GRADES } from '../domain/Question.js';
import { SupabaseQuestionRepository } from '../data/SupabaseQuestionRepository.js';
import { uploadImage } from '../data/imageStorage.js';
import { rowsToQuestions } from '../data/csv.js';
import { signIn, signOut, currentUser } from '../data/auth.js';
import { fillSelect, unique } from './dom.js';
import { SUPABASE_URL } from '../config.js';

const repository = new SupabaseQuestionRepository();
const $ = (id) => document.getElementById(id);
const dialog = $('editor-dialog');

const TYPE_LABELS = { pg: 'Pilihan ganda', isian: 'Isian' };

let allQuestions = [];
let visibleQuestions = [];
let selectedIds = new Set();
let editingId = null;
let editingImagePath = null;
let editorMode = 'add';
let opener = null;
let snapshot = '';
let toastTimer = 0;
let pendingImport = [];

/* ---------- page status & toast ---------- */

function setStatus(message, tone = 'info') {
  const status = $('status');
  status.textContent = message;
  status.dataset.tone = tone;
  status.hidden = !message;
}

function showToast(message, action = null) {
  const toast = $('toast');
  toast.replaceChildren();

  const text = document.createElement('span');
  text.textContent = message;
  toast.append(text);

  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'link';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      toast.hidden = true;
      action.run();
    });
    toast.append(button);
  }

  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, action ? 6000 : 3500);
}

/* ---------- auth ---------- */

function showLogin() {
  if (dialog.open) dialog.close();
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

/* ---------- filters & list ---------- */

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
  const query = $('search').value.trim().toLowerCase();

  visibleQuestions = allQuestions.filter((question) => {
    if (subject && question.subject !== subject) return false;
    if (grade && String(question.grade) !== grade) return false;
    if (!query) return true;

    return [question.prompt, question.chapter, question.subject]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  const visibleIds = new Set(visibleQuestions.map((question) => question.id));
  selectedIds = new Set([...selectedIds].filter((id) => visibleIds.has(id)));

  renderRows();
}

function cell(text, className) {
  const node = document.createElement('div');
  node.className = className;
  node.textContent = text;
  node.title = text;
  return node;
}

function ghostButton(label, onClick, variant = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `ghost ${variant}`.trim();
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function statusCell(question) {
  const node = document.createElement('div');
  node.className = 'cell-status';

  const label = document.createElement('label');
  label.className = 'switch';

  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.checked = question.active;
  toggle.setAttribute('aria-label', `Tayangkan soal: ${question.prompt ?? ''}`);
  toggle.addEventListener('change', () => setQuestionActive(question, toggle));

  const text = document.createElement('span');
  text.textContent = question.active ? 'Aktif' : 'Draf';

  label.append(toggle, text);
  node.append(label);
  return node;
}

function buildRow(question) {
  const row = document.createElement('div');
  row.className = selectedIds.has(question.id) ? 'question-row picked' : 'question-row';

  const check = document.createElement('div');
  check.className = 'cell-check';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = selectedIds.has(question.id);
  box.setAttribute('aria-label', `Pilih soal: ${question.prompt ?? ''}`);
  box.addEventListener('change', () => {
    if (box.checked) selectedIds.add(question.id);
    else selectedIds.delete(question.id);
    row.classList.toggle('picked', box.checked);
    syncSelectionUi();
  });
  check.append(box);

  const actions = document.createElement('div');
  actions.className = 'cell-actions';

  const editButton = ghostButton('Edit', () => openEditor(question, 'edit'));
  editButton.setAttribute('aria-label', `Edit soal: ${question.prompt ?? ''}`);

  const duplicateButton = ghostButton('Duplikat', () => openEditor(question, 'duplicate'));
  duplicateButton.setAttribute('aria-label', `Duplikat soal: ${question.prompt ?? ''}`);

  const deleteButton = ghostButton('Hapus', () => deleteQuestions([question]), 'danger');
  deleteButton.setAttribute('aria-label', `Hapus soal: ${question.prompt ?? ''}`);

  actions.append(editButton, duplicateButton, deleteButton);

  row.append(
    check,
    cell(question.subject || '—', 'cell-mapel'),
    cell(question.grade ? `Kelas ${question.grade}` : '—', 'cell-kelas'),
    cell(question.chapter || '—', 'cell-bab'),
    cell(TYPE_LABELS[question.type] ?? '—', 'cell-tipe'),
    cell(question.prompt || '—', 'cell-soal'),
    statusCell(question),
    actions
  );

  row.addEventListener('click', (event) => {
    if (event.target.closest('button, input, label, a')) return;
    openEditor(question, 'edit');
  });

  return row;
}

function syncSelectionUi() {
  $('select-all').checked =
    visibleQuestions.length > 0 && visibleQuestions.every((question) => selectedIds.has(question.id));
  $('select-all').indeterminate = !$('select-all').checked && selectedIds.size > 0;

  $('bulk-bar').hidden = selectedIds.size === 0;
  $('bulk-count').textContent = `${selectedIds.size} dipilih`;
}

function renderRows() {
  const list = $('question-list');
  list.replaceChildren();

  for (const question of visibleQuestions) list.append(buildRow(question));

  $('count').textContent =
    visibleQuestions.length === allQuestions.length
      ? `${allQuestions.length} soal`
      : `${visibleQuestions.length} dari ${allQuestions.length} soal`;

  syncSelectionUi();

  const empty = $('empty-state');
  empty.hidden = visibleQuestions.length > 0;
  empty.textContent = allQuestions.length
    ? 'Tidak ada soal yang cocok. Hapus filter atau kata kunci.'
    : 'Belum ada soal. Tambah soal atau impor CSV.';
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

/* ---------- row actions ---------- */

async function setQuestionActive(question, toggle) {
  const label = toggle.parentElement.querySelector('span');

  try {
    await repository.setActive([question.id], toggle.checked);
    question.active = toggle.checked;
  } catch (error) {
    toggle.checked = question.active;
    setStatus(error.message, 'error');
  }

  label.textContent = question.active ? 'Aktif' : 'Draf';
}

async function setManyActive(active) {
  const ids = [...selectedIds];

  try {
    await repository.setActive(ids, active);
    for (const question of allQuestions) {
      if (ids.includes(question.id)) question.active = active;
    }
    selectedIds = new Set();
    renderRows();
    showToast(`${ids.length} soal ${active ? 'diaktifkan' : 'dijadikan draf'}.`);
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function deleteQuestions(questions) {
  const ids = questions.map((question) => question.id);

  try {
    await repository.removeMany(ids);

    allQuestions = allQuestions.filter((question) => !ids.includes(question.id));
    selectedIds = new Set([...selectedIds].filter((id) => !ids.includes(id)));
    applyFilters();

    showToast(ids.length === 1 ? 'Soal dihapus.' : `${ids.length} soal dihapus.`, {
      label: 'Urungkan',
      run: async () => {
        try {
          await repository.createMany(questions);
          await refresh();
          showToast('Penghapusan dibatalkan.');
        } catch (error) {
          setStatus(error.message, 'error');
        }
      },
    });
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

/* ---------- editor dialog ---------- */

function syncTypeFields() {
  const isChoice = $('type').value === 'pg';
  $('option-fields').hidden = !isChoice;
  $('answer').placeholder = isChoice ? 'A / B / C / D' : 'mencair|melebur';
}

const formSnapshot = () =>
  JSON.stringify([
    $('subject').value,
    $('grade').value,
    $('chapter').value,
    $('type').value,
    $('prompt').value,
    $('option-a').value,
    $('option-b').value,
    $('option-c').value,
    $('option-d').value,
    $('answer').value,
    $('explanation').value,
    $('active').checked,
    $('image').value,
    editingImagePath,
  ]);

function setErrors(errors) {
  const box = $('editor-errors');
  box.replaceChildren();
  box.hidden = !errors.length;
  if (!errors.length) return;

  const list = document.createElement('ul');
  for (const error of errors) {
    const item = document.createElement('li');
    item.textContent = error;
    list.append(item);
  }

  box.append(list);
  box.focus();
}

function openEditor(question = null, mode = 'add') {
  editorMode = mode;
  const source = mode === 'duplicate' ? { ...question, id: null, active: false } : question;

  editingId = mode === 'edit' ? question.id : null;
  editingImagePath = source?.imagePath ?? null;

  $('editor-title').textContent = { add: 'Tambah soal', edit: 'Edit soal', duplicate: 'Duplikat soal' }[mode];
  $('save').textContent = mode === 'edit' ? 'Simpan perubahan' : 'Simpan';
  $('save-more').hidden = mode !== 'add';

  $('subject').value = source?.subject ?? '';
  $('grade').value = source?.grade ? String(source.grade) : '';
  $('chapter').value = source?.chapter ?? '';
  $('type').value = source?.type ?? 'pg';
  $('prompt').value = source?.prompt ?? '';
  $('option-a').value = source?.optionA ?? '';
  $('option-b').value = source?.optionB ?? '';
  $('option-c').value = source?.optionC ?? '';
  $('option-d').value = source?.optionD ?? '';
  $('answer').value = source?.answer ?? '';
  $('explanation').value = source?.explanation ?? '';
  $('active').checked = Boolean(source?.active);
  $('image').value = '';

  syncTypeFields();
  setErrors([]);
  snapshot = formSnapshot();

  opener = document.activeElement;
  dialog.showModal();
  $('subject').focus();
}

function requestClose() {
  if (formSnapshot() !== snapshot && !confirm('Perubahan belum disimpan. Tutup saja?')) return;
  dialog.close();
}

dialog.addEventListener('close', () => {
  if (opener?.isConnected) opener.focus();
  opener = null;
});

dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  requestClose();
});

dialog.addEventListener('click', (event) => {
  if (event.target === dialog) requestClose();
});

$('editor-close').addEventListener('click', requestClose);
$('cancel').addEventListener('click', requestClose);
$('type').addEventListener('change', syncTypeFields);
$('new-question').addEventListener('click', () => openEditor());

$('editor-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const alsoNew = event.submitter?.id === 'save-more';
  const isEdit = editorMode === 'edit';

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
    setErrors(errors);
    return;
  }

  const file = $('image').files[0];
  $('save').disabled = true;

  try {
    if (file) draft.imagePath = await uploadImage(file);

    if (isEdit) await repository.update(editingId, draft);
    else await repository.create(draft);

    dialog.close();
    await refresh();
    showToast(isEdit ? 'Soal diperbarui.' : 'Soal ditambahkan.');
    if (alsoNew) openEditor();
  } catch (error) {
    setErrors([error.message]);
  } finally {
    $('save').disabled = false;
  }
});

/* ---------- toolbar & bulk ---------- */

$('search').addEventListener('input', applyFilters);
$('subject-filter').addEventListener('change', applyFilters);
$('grade-filter').addEventListener('change', applyFilters);

$('select-all').addEventListener('change', (event) => {
  selectedIds = event.target.checked ? new Set(visibleQuestions.map((question) => question.id)) : new Set();
  renderRows();
});

$('bulk-activate').addEventListener('click', () => setManyActive(true));
$('bulk-deactivate').addEventListener('click', () => setManyActive(false));
$('bulk-clear').addEventListener('click', () => {
  selectedIds = new Set();
  renderRows();
});
$('bulk-delete').addEventListener('click', () => {
  deleteQuestions(allQuestions.filter((question) => selectedIds.has(question.id)));
});

/* ---------- auth wiring ---------- */

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
  selectedIds = new Set();
  showLogin();
});

/* ---------- CSV import ---------- */

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

(async function boot() {
  if (SUPABASE_URL.includes('YOUR-PROJECT')) {
    setStatus('Isi SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY di src/config.js dulu.', 'error');
    return;
  }

  const user = await currentUser().catch(() => null);
  if (user) await showApp();
  else showLogin();
})();
