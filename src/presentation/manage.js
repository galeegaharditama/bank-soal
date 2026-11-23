import { createQuestion, validateQuestion } from '../domain/Question.js';
import { SupabaseQuestionRepository } from '../data/SupabaseQuestionRepository.js';
import { uploadImage } from '../data/imageStorage.js';
import { signIn, signOut, currentUser } from '../data/auth.js';
import { SUPABASE_URL } from '../config.js';

const repository = new SupabaseQuestionRepository();
const $ = (id) => document.getElementById(id);

let allQuestions = [];
let questions = [];
let editingId = null;
let editingImagePath = null;

function setStatus(message, tone = 'info') {
  $('status').textContent = message;
  $('status').dataset.tone = tone;
  $('status').hidden = !message;
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

function syncTypeFields() {
  const isChoice = $('type').value === 'multiple_choice';
  $('option-fields').hidden = !isChoice;
  $('answer').placeholder = isChoice ? 'A / B / C / D' : 'Accepted answers, separated by |';
}

function fillEditor(question = null) {
  editingId = question?.id ?? null;
  editingImagePath = question?.imagePath ?? null;

  $('editor-title').textContent = editingId ? 'Edit question' : 'Add question';
  $('save').textContent = editingId ? 'Update question' : 'Add question';
  $('cancel').hidden = !editingId;

  $('subject').value = question?.subject ?? '';
  $('topic').value = question?.topic ?? '';
  $('type').value = question?.type ?? 'multiple_choice';
  $('prompt').value = question?.prompt ?? '';
  $('option-a').value = question?.optionA ?? '';
  $('option-b').value = question?.optionB ?? '';
  $('option-c').value = question?.optionC ?? '';
  $('option-d').value = question?.optionD ?? '';
  $('answer').value = question?.answer ?? '';
  $('explanation').value = question?.explanation ?? '';
  $('image').value = '';

  syncTypeFields();
  renderRows();
}

function renderSubjectOptions(subjects) {
  const filter = $('subject-filter');
  const current = filter.value;
  filter.innerHTML = '<option value="">All subjects</option>';

  for (const subject of subjects) {
    const option = document.createElement('option');
    option.value = subject;
    option.textContent = subject;
    filter.append(option);

    const suggestion = option.cloneNode(true);
    if (!$('subject-options').querySelector(`option[value="${CSS.escape(subject)}"]`)) {
      $('subject-options').append(suggestion);
    }
  }

  filter.value = subjects.includes(current) ? current : '';
}

function renderRows() {
  const rows = $('question-rows');
  rows.replaceChildren();
  $('count').textContent = questions.length ? `(${questions.length})` : '';

  for (const question of questions) {
    const row = document.createElement('tr');
    if (question.id === editingId) row.className = 'selected';

    const cells = [
      question.subject,
      question.topic ?? '',
      question.prompt,
      question.type === 'multiple_choice' ? 'Multiple choice' : 'Short answer',
    ];

    for (const value of cells) {
      const cell = document.createElement('td');
      cell.textContent = value;
      cell.className = 'cell-question';
      row.append(cell);
    }

    const actions = document.createElement('td');
    actions.className = 'row';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'secondary';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => fillEditor(question));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => deleteQuestion(question));

    actions.append(edit, remove);
    row.append(actions);
    rows.append(row);
  }
}

async function refresh() {
  try {
    allQuestions = await repository.list();

    const subjects = [...new Set(allQuestions.map((question) => question.subject))].sort();
    renderSubjectOptions(subjects);

    const subject = $('subject-filter').value;
    questions = subject
      ? allQuestions.filter((question) => question.subject === subject)
      : allQuestions;

    renderRows();
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function deleteQuestion(question) {
  if (!confirm(`Delete this question?\n\n${question.prompt}`)) return;

  try {
    await repository.remove(question.id);
    if (editingId === question.id) fillEditor();
    await refresh();
    setStatus('Question deleted.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('Signing in…');

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
  questions = [];
  showLogin();
});

$('type').addEventListener('change', syncTypeFields);

$('cancel').addEventListener('click', () => {
  $('editor-form').reset();
  fillEditor();
});

$('subject-filter').addEventListener('change', refresh);

$('editor-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const draft = createQuestion({
    subject: $('subject').value,
    topic: $('topic').value,
    type: $('type').value,
    prompt: $('prompt').value,
    optionA: $('option-a').value,
    optionB: $('option-b').value,
    optionC: $('option-c').value,
    optionD: $('option-d').value,
    answer: $('answer').value,
    explanation: $('explanation').value,
    imagePath: editingImagePath,
  });

  const errors = validateQuestion(draft);
  if (errors.length) {
    setStatus(errors.join(' '), 'error');
    return;
  }

  const file = $('image').files[0];
  const isNew = !editingId;

  try {
    setStatus(isNew ? 'Saving…' : 'Updating…');
    if (file) draft.imagePath = await uploadImage(file);

    if (isNew) await repository.create(draft);
    else await repository.update(editingId, draft);

    $('editor-form').reset();
    fillEditor();
    await refresh();
    setStatus(isNew ? 'Question added.' : 'Question updated.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
});

(async function boot() {
  if (SUPABASE_URL.includes('YOUR-PROJECT')) {
    setStatus('Fill SUPABASE_URL and SUPABASE_ANON_KEY in src/config.js first.', 'error');
    return;
  }

  const user = await currentUser().catch(() => null);
  if (user) await showApp();
  else showLogin();
})();
