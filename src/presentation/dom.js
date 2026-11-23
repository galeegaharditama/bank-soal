export const unique = (values) => [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), 'id'));

/** Rebuild a select from values, keeping the previous choice when it still exists. */
export function fillSelect(select, values, emptyLabel, label = String) {
  const previous = select.value;
  select.replaceChildren();

  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = emptyLabel;
  select.append(empty);

  for (const value of values) {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = label(value);
    select.append(option);
  }

  if (values.map(String).includes(previous)) select.value = previous;
}

const parseDate = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const shortDate = (iso) => {
  const date = parseDate(iso);
  return date ? date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '';
};

export const longDate = (iso) => {
  const date = parseDate(iso);
  return date ? date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};
