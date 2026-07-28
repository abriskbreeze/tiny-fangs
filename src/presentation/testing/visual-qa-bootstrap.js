import { listVisualFixtureNames } from './visual-fixture-names.js';
import { createFixtureActivationController } from './fixture-activation.js';
import { createVisualReadinessController } from './visual-readiness.js';

export const VISUAL_QA_GLOBAL = '__TINY_FANGS_VISUAL_QA__';

function browserTarget() {
  return globalThis.window ?? globalThis;
}

export function isVisualQaEnabled(search = '') {
  return new URLSearchParams(search).get('visualQa') === '1';
}

export function installVisualQaContract(options = {}) {
  const target = options.target ?? browserTarget();
  const search = options.search ?? target.location?.search ?? '';

  if (!isVisualQaEnabled(search)) {
    return null;
  }

  if (target[VISUAL_QA_GLOBAL]) {
    return target[VISUAL_QA_GLOBAL];
  }

  const readiness = createVisualReadinessController({
    target,
    fonts: options.fonts,
    nextFrame: options.nextFrame,
  });
  const activation = createFixtureActivationController({
    ...(options.activation ?? {}),
    enabled: true,
    readiness,
  });
  let activationError = null;
  let currentReady;
  const contract = {
    fixtureNames: Object.freeze(listVisualFixtureNames()),
    readiness,
    activateFixture(name) {
      activationError = null;
      const attempt = activation.activateFixture(name);
      currentReady = attempt.then(
        ({ ready }) => ready,
        (error) => {
          activationError = error instanceof Error ? error.message : String(error);
          return false;
        },
      );
      return attempt;
    },
    get currentFixture() {
      return activation.currentFixture();
    },
    get activationError() {
      return activationError;
    },
    get ready() {
      return currentReady;
    },
  };

  target[VISUAL_QA_GLOBAL] = contract;
  const requestedFixture = new URLSearchParams(search).get('fixture');
  if (requestedFixture) {
    contract.activateFixture(requestedFixture);
  } else {
    currentReady = readiness.waitUntilReady();
  }

  return Object.freeze(contract);
}
