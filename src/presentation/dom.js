export const unique = (values) => [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), 'id'));

/** Rebuild a select from values, keeping the previous choice when it still exists. */
export function fillSelect(select, values, emptyLabel, label = String) {
  fillOptions(select, values, emptyLabel, (value) => value, (value) => label(value));
}

/** Same, for items that are objects (mapel, bab): valueOf/labelOf pick the id and the text. */
export function fillOptions(select, items, emptyLabel, valueOf, labelOf) {
  const previous = select.value;
  select.replaceChildren();

  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = emptyLabel;
  select.append(empty);

  for (const item of items) {
    const option = document.createElement('option');
    option.value = String(valueOf(item));
    option.textContent = labelOf(item);
    select.append(option);
  }

  if ([...select.options].some((option) => option.value === previous)) select.value = previous;
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
