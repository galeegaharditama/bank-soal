import { SupabaseQuestionRepository } from '../data/SupabaseQuestionRepository.js';
import { publicImageUrl } from '../data/imageStorage.js';
import { isCorrect } from '../domain/Question.js';
import { SUPABASE_URL } from '../config.js';

const repository = new SupabaseQuestionRepository();
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const limit = Number(params.get('limit')) || 10;

let queue = [];
let index = 0;
let score = 0;
let answered = false;

function setStatus(message, tone = 'info') {
  $('status').textContent = message;
  $('status').dataset.tone = tone;
  $('status').hidden = !message;
}

const shuffle = (items) => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

async function showStart() {
  $('start-view').hidden = false;
  $('quiz-view').hidden = true;
  $('result-view').hidden = true;

  const all = await repository.list();
  const subjects = [...new Set(all.map((question) => question.subject))].sort();
  if (!subjects.length) {
    setStatus('No questions yet.', 'error');
    return;
  }

  const container = $('subject-buttons');
  container.replaceChildren();

  for (const subject of [...subjects, 'All subjects']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = subject;
    button.addEventListener('click', () =>
      start(subject === 'All subjects' ? undefined : subject)
    );
    container.append(button);
  }
}

async function start(subject) {
  try {
    const all = await repository.list({ subject });
    queue = shuffle([...all]).slice(0, limit);
    index = 0;
    score = 0;

    $('start-view').hidden = true;
    $('result-view').hidden = true;
    $('quiz-view').hidden = false;
    showQuestion();
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function showQuestion() {
  if (index >= queue.length) {
    showResult();
    return;
  }

  const question = queue[index];
  answered = false;

  $('progress').textContent = `Question ${index + 1} / ${queue.length}`;
  $('score').textContent = `Score ${score}`;
  $('prompt').textContent = question.prompt;
  $('feedback').hidden = true;
  $('next').hidden = true;

  const image = $('image');
  const url = publicImageUrl(question.imagePath);
  image.hidden = !url;
  if (url) image.src = url;

  const answers = $('answers');
  answers.replaceChildren();
  $('short-answer').hidden = question.type !== 'short_answer';

  if (question.type === 'multiple_choice') {
    for (const [letter, option] of Object.entries({
      A: question.optionA,
      B: question.optionB,
      C: question.optionC,
      D: question.optionD,
    })) {
      if (!option) continue;

      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.letter = letter;
      button.textContent = `${letter}. ${option}`;
      button.addEventListener('click', () => check(letter));
      answers.append(button);
    }
  }

  $('short-answer-input').value = '';
  $('short-answer-input').disabled = false;
  $('check').disabled = false;
  $('short-answer-input').focus({ preventScroll: true });
}

function check(response) {
  if (answered) return;
  answered = true;

  const question = queue[index];
  const correct = isCorrect(question, response);
  if (correct) score++;

  if (question.type === 'multiple_choice') {
    for (const button of $('answers').children) {
      if (button.dataset.letter === question.answer.toUpperCase()) button.classList.add('correct');
      else if (button.dataset.letter === String(response)) button.classList.add('wrong');
    }
  } else {
    $('short-answer-input').disabled = true;
    $('check').disabled = true;
  }

  $('verdict').textContent = correct
    ? 'Correct.'
    : `Not quite. Answer: ${question.answer}`;
  $('verdict').dataset.tone = correct ? 'success' : 'error';

  const explanation = $('explanation');
  explanation.textContent = question.explanation ?? '';
  explanation.hidden = !question.explanation;

  $('feedback').hidden = false;
  $('score').textContent = `Score ${score}`;
  $('next').hidden = false;
  $('next').textContent = index + 1 >= queue.length ? 'See result' : 'Next';
  $('next').focus({ preventScroll: true });
}

function showResult() {
  $('quiz-view').hidden = true;
  $('result-view').hidden = false;
  $('result-title').textContent = `Score ${score} / ${queue.length}`;
}

$('next').addEventListener('click', () => {
  index++;
  showQuestion();
});

$('check').addEventListener('click', () => check($('short-answer-input').value));
$('short-answer-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') check(event.target.value);
});
$('restart').addEventListener('click', showStart);

(async function boot() {
  if (SUPABASE_URL.includes('YOUR-PROJECT')) {
    setStatus('Fill SUPABASE_URL and SUPABASE_ANON_KEY in src/config.js first.', 'error');
    return;
  }

  try {
    await showStart();
  } catch (error) {
    setStatus(error.message, 'error');
  }
})();
