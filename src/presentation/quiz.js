import { isCorrect, isAnswered, optionText, optionsOf } from '../domain/Question.js';
import { SupabaseQuestionRepository } from '../data/SupabaseQuestionRepository.js';
import { publicImageUrl } from '../data/imageStorage.js';
import { loadHistory, saveSession } from '../data/sessionHistory.js';
import { fillSelect, unique, shortDate, longDate } from './dom.js';
import { SUPABASE_URL } from '../config.js';

const repository = new SupabaseQuestionRepository();
const $ = (id) => document.getElementById(id);

let pool = [];      // active questions loaded once
let session = null; // { questions, answers, index, filter }
let result = null;  // { items, score, filter }
let amount = 10;

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const filterValues = () => ({
  subject: $('filter-subject').value,
  grade: $('filter-grade').value,
  chapter: $('filter-chapter').value,
});

const matches = (question, { subject, grade, chapter }) =>
  (!subject || question.subject === subject) &&
  (!grade || String(question.grade) === grade) &&
  (!chapter || question.chapter === chapter);

const matchingQuestions = () => pool.filter((question) => matches(question, filterValues()));

function setStatus(message, tone = 'info') {
  const status = $('status');
  status.textContent = message;
  status.dataset.tone = tone;
  status.hidden = !message;
}

function showView(name) {
  for (const view of ['start', 'session', 'result']) {
    $(`${view}-view`).hidden = view !== name;
  }
  window.scrollTo(0, 0);
}

/* ---------- start: filters ---------- */

function fillFilters() {
  fillSelect($('filter-subject'), unique(pool.map((question) => question.subject).filter(Boolean)), 'Semua mapel');
  fillSelect(
    $('filter-grade'),
    unique(pool.map((question) => question.grade).filter(Boolean)),
    'Semua kelas',
    (grade) => `Kelas ${grade}`
  );
  fillChapters();
}

function fillChapters() {
  const filter = filterValues();
  const chapters = unique(
    pool
      .filter((question) => matches(question, { subject: filter.subject, grade: filter.grade, chapter: '' }))
      .map((question) => question.chapter)
      .filter(Boolean)
  );
  fillSelect($('filter-chapter'), chapters, 'Semua bab');
}

function updateAvailability() {
  const available = matchingQuestions().length;
  $('availability').textContent = !available
    ? 'Belum ada soal untuk pilihan ini'
    : available < amount
      ? `${available} soal tersedia — kurang dari ${amount}, semua akan dipakai`
      : `${available} soal tersedia`;
  $('start').disabled = available === 0;
}

function setAmount(value) {
  amount = value;
  for (const button of $('amount-buttons').children) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.amount) === value));
  }
  updateAvailability();
}

/* ---------- session ---------- */

function startSession(questions, filter) {
  session = { questions, answers: Array(questions.length).fill(null), index: 0, filter };
  window.addEventListener('beforeunload', confirmLeaving);
  showView('session');
  renderSession();
}

function start() {
  const filter = filterValues();
  const candidates = matchingQuestions();
  if (!candidates.length) {
    setStatus('Belum ada soal untuk pilihan itu. Coba ganti bab atau kelas.', 'error');
    return;
  }

  setStatus('');
  startSession(shuffle(candidates).slice(0, Math.min(amount, candidates.length)), filter);
}

const confirmLeaving = (event) => {
  event.preventDefault();
  event.returnValue = '';
};

function renderSession() {
  $('session-progress').textContent = `Soal ${session.index + 1} dari ${session.questions.length}`;
  renderStrip();
  renderQuestion();
  renderProgress();
  $('prev').disabled = session.index === 0;
  $('next').disabled = session.index === session.questions.length - 1;
}

function renderStrip() {
  const strip = $('number-strip');
  strip.replaceChildren();

  session.questions.forEach((_, index) => {
    const answered = isAnswered(session.answers[index]);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(index + 1);
    button.className = answered ? 'answered' : '';
    button.setAttribute('aria-label', `Soal ${index + 1}, ${answered ? 'sudah' : 'belum'} dijawab`);

    if (index === session.index) {
      button.classList.add('current');
      button.setAttribute('aria-current', 'step');
    }

    button.addEventListener('click', () => goTo(index));
    strip.append(button);
  });
}

function renderProgress() {
  const total = session.questions.length;
  const answered = session.answers.filter(isAnswered).length;
  const remaining = total - answered;

  $('progress-fill').style.width = `${(answered / total) * 100}%`;
  $('finish').textContent = remaining ? `Selesai · ${remaining} belum dijawab` : 'Selesai';
}

function renderQuestion() {
  const question = session.questions[session.index];
  const card = $('question-card');
  card.replaceChildren();

  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = [question.subject, `Kelas ${question.grade}`, question.chapter].filter(Boolean).join(' · ');
  card.append(meta);

  const prompt = document.createElement('p');
  prompt.className = 'prompt';
  prompt.textContent = question.prompt;
  card.append(prompt);

  const imageUrl = publicImageUrl(question.imagePath);
  if (imageUrl) {
    const image = document.createElement('img');
    image.className = 'question-image';
    image.alt = '';
    image.src = imageUrl;
    // PRD 5.1: a broken image hides itself, the question text stays.
    image.addEventListener('error', () => image.remove());
    card.append(image);
  }

  card.append(question.type === 'pg' ? renderOptions(question) : renderAnswerField());
}

function renderOptions(question) {
  const wrapper = document.createElement('div');
  wrapper.className = 'options';
  const selected = session.answers[session.index];

  for (const { letter, text } of optionsOf(question)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = selected === letter ? 'option selected' : 'option';
    button.dataset.letter = letter;
    button.setAttribute('aria-pressed', String(selected === letter));

    const badge = document.createElement('span');
    badge.className = 'letter';
    badge.textContent = letter;

    const label = document.createElement('span');
    label.textContent = text;

    button.append(badge, label);
    button.addEventListener('click', () => {
      session.answers[session.index] = letter;
      for (const option of wrapper.children) {
        const active = option.dataset.letter === letter;
        option.classList.toggle('selected', active);
        option.setAttribute('aria-pressed', String(active));
      }
      renderStrip();
      renderProgress();
    });

    wrapper.append(button);
  }

  return wrapper;
}

function renderAnswerField() {
  const label = document.createElement('label');
  label.className = 'answer-field';
  label.textContent = 'Jawabanmu';

  const input = document.createElement('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.placeholder = 'Tulis jawaban...';
  input.value = session.answers[session.index] ?? '';
  input.addEventListener('input', (event) => {
    session.answers[session.index] = event.target.value;
    renderStrip();
    renderProgress();
  });

  label.append(input);
  return label;
}

function goTo(index) {
  if (!session || index < 0 || index >= session.questions.length) return;
  session.index = index;
  renderSession();
}

function exitSession() {
  if (!confirm('Keluar dari sesi ini? Jawaban yang sudah dipilih akan hilang.')) return;

  window.removeEventListener('beforeunload', confirmLeaving);
  session = null;
  showView('start');
  renderHistory();
}

function finish() {
  const unanswered = session.answers.filter((answer) => !isAnswered(answer)).length;
  if (unanswered && !confirm(`Masih ada ${unanswered} soal yang belum dijawab. Selesaikan sekarang?`)) return;

  const items = session.questions.map((question, index) => ({
    question,
    response: session.answers[index] ?? '',
    correct: isCorrect(question, session.answers[index]),
  }));
  const score = items.filter((item) => item.correct).length;

  result = { items, score, filter: session.filter };

  saveSession({
    at: new Date().toISOString(),
    subject: session.filter.subject,
    grade: session.filter.grade,
    chapter: session.filter.chapter,
    score,
    total: items.length,
    wrongIds: items.filter((item) => !item.correct).map((item) => item.question.id),
  });

  window.removeEventListener('beforeunload', confirmLeaving);
  session = null;
  renderResult();
  showView('result');
}

/* ---------- result ---------- */

function renderResult() {
  const card = $('result-card');
  card.replaceChildren();

  const eyebrow = document.createElement('p');
  eyebrow.className = 'muted';
  eyebrow.textContent = 'Selesai';

  const score = document.createElement('p');
  score.className = 'score';
  score.append(String(result.score));

  const total = document.createElement('span');
  total.textContent = `/${result.items.length}`;
  score.append(total);

  const note = document.createElement('p');
  note.className = 'muted';
  note.textContent = scoreNote(result.score, result.items.length);

  card.append(eyebrow, score, note, renderResultActions(), renderReview());
}

function renderResultActions() {
  const actions = document.createElement('div');
  actions.className = 'row';

  const repeat = document.createElement('button');
  repeat.type = 'button';
  repeat.className = 'primary';
  repeat.textContent = 'Ulangi semua';
  repeat.addEventListener('click', () =>
    startSession(shuffle(result.items.map((item) => item.question)), result.filter)
  );
  actions.append(repeat);

  const wrong = result.items.filter((item) => !item.correct);
  if (wrong.length) {
    const repeatWrong = document.createElement('button');
    repeatWrong.type = 'button';
    repeatWrong.className = 'secondary';
    repeatWrong.textContent = 'Ulangi yang salah';
    repeatWrong.addEventListener('click', () =>
      startSession(shuffle(wrong.map((item) => item.question)), result.filter)
    );
    actions.append(repeatWrong);
  }

  const change = document.createElement('button');
  change.type = 'button';
  change.className = 'link';
  change.textContent = 'Ganti pilihan';
  change.addEventListener('click', () => {
    session = null;
    result = null;
    showView('start');
    renderHistory();
  });
  actions.append(change);

  return actions;
}

function renderReview() {
  const wrapper = document.createElement('div');
  const heading = document.createElement('h2');
  heading.textContent = 'Pembahasan';

  const list = document.createElement('ol');
  list.className = 'review';

  result.items.forEach((item, index) => list.append(renderReviewItem(item, index)));
  wrapper.append(heading, list);
  return wrapper;
}

function renderReviewItem({ question, response, correct }, index) {
  const item = document.createElement('li');
  item.className = 'review-item';

  const head = document.createElement('p');
  head.className = 'review-head';

  const answered = isAnswered(response);
  const badge = document.createElement('span');
  badge.className = `badge ${!answered ? 'empty' : correct ? 'correct' : 'wrong'}`;
  badge.textContent = !answered ? 'Tidak dijawab' : correct ? 'Benar' : 'Salah';

  const number = document.createElement('span');
  number.className = 'muted';
  number.textContent = `Soal ${index + 1}`;

  head.append(badge, number);
  item.append(head);

  const prompt = document.createElement('p');
  prompt.className = 'review-prompt';
  prompt.textContent = question.prompt;
  item.append(prompt);

  const imageUrl = publicImageUrl(question.imagePath);
  if (imageUrl) {
    const image = document.createElement('img');
    image.className = 'review-image';
    image.alt = '';
    image.src = imageUrl;
    image.addEventListener('error', () => image.remove());
    item.append(image);
  }

  item.append(reviewLine('Jawabanmu', answerText(question, response)));
  item.append(reviewLine('Kunci', keyText(question)));

  if (question.explanation) {
    const explanation = document.createElement('p');
    explanation.className = 'review-explanation';
    explanation.textContent = question.explanation;
    item.append(explanation);
  }

  return item;
}

function reviewLine(label, value) {
  const line = document.createElement('p');
  line.className = 'review-line';
  line.append(`${label}: `);

  const strong = document.createElement('strong');
  strong.textContent = value;
  line.append(strong);

  return line;
}

const answerText = (question, response) => {
  if (!isAnswered(response)) return '—';
  if (question.type === 'pg') {
    const letter = String(response).toUpperCase();
    const option = optionText(question, letter);
    return option ? `${letter}. ${option}` : letter;
  }
  return String(response);
};

const keyText = (question) => {
  if (question.type === 'pg') {
    const letter = question.answer.toUpperCase();
    const option = optionText(question, letter);
    return option ? `${letter}. ${option}` : letter;
  }
  return question.answer.split('|')[0];
};

const scoreNote = (score, total) => {
  if (score === total) return 'Semua benar. Mantap!';
  if (score >= total * 0.7) return 'Bagus. Pelajari pembahasan yang salah, lalu ulangi.';
  return 'Belum apa-apa. Baca pembahasannya, lalu ulangi yang salah.';
};

/* ---------- history ---------- */

function renderHistory() {
  const saved = loadHistory().slice(0, 5);
  $('history-section').hidden = !saved.length;

  const list = $('history-list');
  list.replaceChildren();

  for (const entry of saved) {
    const item = document.createElement('li');
    const label = [entry.subject || 'Semua mapel', entry.grade ? `Kelas ${entry.grade}` : null, entry.chapter]
      .filter(Boolean)
      .join(' · ');
    item.textContent = `${label} — ${entry.score}/${entry.total} · ${shortDate(entry.at)}`;
    list.append(item);
  }
}

/* ---------- wiring ---------- */

$('filter-subject').addEventListener('change', () => {
  fillChapters();
  updateAvailability();
});
$('filter-grade').addEventListener('change', () => {
  fillChapters();
  updateAvailability();
});
$('filter-chapter').addEventListener('change', updateAvailability);

$('amount-buttons').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-amount]');
  if (button) setAmount(Number(button.dataset.amount));
});

$('start').addEventListener('click', start);
$('prev').addEventListener('click', () => goTo(session.index - 1));
$('next').addEventListener('click', () => goTo(session.index + 1));
$('finish').addEventListener('click', finish);
$('exit').addEventListener('click', exitSession);

(async function boot() {
  if (SUPABASE_URL.includes('YOUR-PROJECT')) {
    setStatus('Isi SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY di src/config.js dulu.', 'error');
    return;
  }

  try {
    pool = await repository.list({ activeOnly: true });
    const updatedAt = await repository.latestUpdate().catch(() => null);
    $('data-version').textContent = updatedAt ? `Data per ${longDate(updatedAt)}` : '';

    fillFilters();
    setAmount(amount);
    renderHistory();
    showView('start');
  } catch (error) {
    setStatus(error.message, 'error');
  }
})();
