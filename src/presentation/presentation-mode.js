const VALID_PRESENTATION_MODES = new Set(['classic', 'aaa']);

export const PRESENTATION_MODE_STORAGE_KEY = 'tinyFangs.presentation.mode';

function normalizePresentationMode(value) {
  return typeof value === 'string' && VALID_PRESENTATION_MODES.has(value)
    ? value
    : null;
}

function getDefaultSearch() {
  try {
    return globalThis.location?.search ?? '';
  } catch {
    return '';
  }
}

function getDefaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function getQueryMode(search) {
  try {
    return normalizePresentationMode(new URLSearchParams(search).get('presentation'));
  } catch {
    return null;
  }
}

function getStoredMode(storage) {
  try {
    return normalizePresentationMode(storage?.getItem(PRESENTATION_MODE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function resolvePresentationMode({
  search = getDefaultSearch(),
  storage = getDefaultStorage(),
} = {}) {
  return getQueryMode(search) ?? getStoredMode(storage) ?? 'classic';
}

export function applyPresentationMode({
  root = globalThis.document?.documentElement,
  search = getDefaultSearch(),
  storage = getDefaultStorage(),
} = {}) {
  const mode = resolvePresentationMode({ search, storage });

  if (root?.dataset) {
    root.dataset.presentation = mode;
  }

  return mode;
}
