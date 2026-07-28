import {
  authoritativeFixtureToClientState,
} from './fixture-client-adapter.js';
import { toStableHashInput } from './stable-serialization.js';

const OPPONENT_PRIVATE_PATHS = Object.freeze([
  'G.players.1.deck',
  'G.players.1.hand',
  'G.players.1.setVerse',
]);

const OPPONENT_PRIVATE_MARKERS = Object.freeze({
  'G.players.1.deck': { hidden: true },
  'G.players.1.hand': { hidden: true },
  'G.players.1.setVerse': { faceDown: true },
});

async function loadRegisteredFixture(name) {
  const { createVisualFixture } = await import('./fixture-registry.js');
  return createVisualFixture(name);
}

function privacyOptions(fixture) {
  return {
    hiddenPaths: [
      ...new Set([
        ...OPPONENT_PRIVATE_PATHS,
        ...(fixture.privacy?.hiddenPaths ?? []),
      ]),
    ],
    hiddenMarkers: {
      ...OPPONENT_PRIVATE_MARKERS,
      ...(fixture.privacy?.hiddenMarkers ?? {}),
    },
  };
}

export function createPublicFixtureMetadata(fixture) {
  return Object.freeze({
    name: fixture.name,
    stableHashInput: toStableHashInput(fixture, privacyOptions(fixture)),
  });
}

function assertRuntimeConnected(deps) {
  const connected = [
    deps.clearGame,
    deps.setGame,
    deps.showGameRoute,
    deps.render,
    deps.readiness?.reset,
    deps.readiness?.waitUntilReady,
  ].every((dependency) => typeof dependency === 'function');

  if (!connected) {
    throw new Error('Visual fixture activation is not connected to the client runtime');
  }
}

export function createFixtureActivationController(options = {}) {
  const enabled = options.enabled === true;
  const loadFixture = options.loadFixture ?? loadRegisteredFixture;
  const adaptFixture = options.adaptFixture ?? authoritativeFixtureToClientState;
  let currentFixture = null;

  return Object.freeze({
    async activateFixture(name) {
      if (!enabled) {
        throw new Error('Visual fixture activation requires visualQa=1');
      }

      const fixture = await loadFixture(name);
      const clientState = adaptFixture(fixture);
      const metadata = createPublicFixtureMetadata(fixture);

      assertRuntimeConnected(options);

      options.readiness.reset('fixture');
      options.clearGame();
      options.setGame(clientState);
      options.readiness.reset('route');
      options.showGameRoute(fixture.presentation);
      options.render();
      currentFixture = metadata;

      const ready = await options.readiness.waitUntilReady();
      return Object.freeze({ fixture: metadata, ready });
    },

    currentFixture() {
      return currentFixture;
    },
  });
}
