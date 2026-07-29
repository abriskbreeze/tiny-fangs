const OMIT = Symbol('omit');

const NONDETERMINISTIC_KEYS = new Set([
  'capturedAt',
  'createdAt',
  'endedAt',
  'generatedAt',
  'now',
  'startTime',
  'startedAt',
  'timestamp',
  'timerInt',
  'updatedAt',
]);

function isNondeterministicKey(key) {
  return NONDETERMINISTIC_KEYS.has(key)
    || /(?:timestamp|timestampMs)$/i.test(key);
}

function hiddenPathsFor(value, options) {
  if (options.hiddenPaths) {
    return options.hiddenPaths;
  }
  return value?.privacy?.hiddenPaths ?? [];
}

function hiddenMarkersFor(value, options) {
  if (options.hiddenMarkers) {
    return options.hiddenMarkers;
  }
  return value?.privacy?.hiddenMarkers ?? {};
}

function canonicalize(value, context, path) {
  const pathKey = path.join('.');
  if (context.hiddenPaths.has(pathKey)) {
    return context.hiddenMarkers.get(pathKey) ?? { faceDown: true };
  }

  if (
    value === undefined
    || typeof value === 'function'
    || typeof value === 'symbol'
  ) {
    return OMIT;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return OMIT;
  }

  if (context.stack.has(value)) {
    throw new TypeError('Cannot serialize circular visual state');
  }

  if (value.faceDown === true) {
    return { faceDown: true };
  }

  if (value.hidden === true) {
    return { hidden: true };
  }

  context.stack.add(value);

  let result;
  if (Array.isArray(value)) {
    result = value.map((item, index) => {
      const serialized = canonicalize(item, context, [...path, String(index)]);
      return serialized === OMIT ? null : serialized;
    });
  } else {
    result = {};
    for (const key of Object.keys(value).sort()) {
      if (isNondeterministicKey(key)) {
        continue;
      }

      const serialized = canonicalize(value[key], context, [...path, key]);
      if (serialized !== OMIT) {
        result[key] = serialized;
      }
    }
  }

  context.stack.delete(value);
  return result;
}

export function toStableHashInput(value, options = {}) {
  const hiddenPaths = hiddenPathsFor(value, options);
  const hiddenMarkers = hiddenMarkersFor(value, options);
  const canonical = canonicalize(value, {
    hiddenPaths: new Set(hiddenPaths),
    hiddenMarkers: new Map(Object.entries(hiddenMarkers)),
    stack: new WeakSet(),
  }, []);

  return JSON.stringify(canonical === OMIT ? null : canonical);
}
