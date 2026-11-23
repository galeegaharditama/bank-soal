const KEY = 'question-bank.history';
const MAX_ENTRIES = 20;

/** Last sessions on this device: at, subject, grade, chapter, score, total, wrongIds (PRD 9). */
export function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function saveSession(entry) {
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...loadHistory()].slice(0, MAX_ENTRIES)));
  } catch {
    // storage full or private mode: the score is lost, practice still works
  }
}
