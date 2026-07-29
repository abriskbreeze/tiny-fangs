// Keyed board reconciliation (plan Phase 4). Replaces destructive
// innerHTML/outerHTML rebuilds with uid-keyed create/patch/move/remove so a
// card keeps one DOM identity while moving hand → active/bench → grave, and
// FLIP motion can measure previous/next rects around a reconcile.
//
// The reconciler is deliberately DOM-minimal: the caller supplies `create`
// (build a node for a view-model) and `patch` (update an existing node in
// place); this module owns ordering, keying, and lifecycle. It never stores
// engine objects — view-models are the caller's already-projected data, and
// only the `uid` string is retained between passes.

export function createKeyedListView(container, options) {
  const { create, patch, onRemove } = options;
  if (typeof create !== 'function' || typeof patch !== 'function') {
    throw new Error('createKeyedListView requires create and patch functions');
  }
  // uid -> element. The container's live children remain the order authority;
  // this map only guarantees identity.
  const nodes = new Map();

  function keyOf(viewModel, index) {
    const uid = viewModel?.uid;
    if (typeof uid !== 'string' && typeof uid !== 'number') {
      throw new Error(`keyed view-model at index ${index} has no uid`);
    }
    return String(uid);
  }

  return Object.freeze({
    // Reconciles the container's children to match `viewModels` order.
    // Returns { created, patched, moved, removed } uid arrays for tests and
    // FLIP planning.
    reconcile(viewModels) {
      const result = { created: [], patched: [], moved: [], removed: [] };
      const nextKeys = viewModels.map(keyOf);
      const nextKeySet = new Set(nextKeys);
      if (nextKeySet.size !== nextKeys.length) {
        throw new Error('duplicate uid in keyed reconcile');
      }

      for (const [uid, node] of [...nodes]) {
        if (!nextKeySet.has(uid)) {
          nodes.delete(uid);
          onRemove?.(uid, node);
          node.remove();
          result.removed.push(uid);
        }
      }

      viewModels.forEach((viewModel, index) => {
        const uid = nextKeys[index];
        let node = nodes.get(uid);
        if (!node) {
          node = create(viewModel);
          node.dataset.uid = uid;
          nodes.set(uid, node);
          result.created.push(uid);
        } else {
          patch(node, viewModel);
          result.patched.push(uid);
        }
        const currentAtIndex = container.children[index];
        if (currentAtIndex !== node) {
          container.insertBefore(node, currentAtIndex ?? null);
          if (!result.created.includes(uid)) result.moved.push(uid);
        }
      });

      return result;
    },

    // FLIP seam: capture rects for every keyed node before a reconcile...
    snapshotRects() {
      const rects = new Map();
      for (const [uid, node] of nodes) {
        if (typeof node.getBoundingClientRect === 'function') {
          rects.set(uid, node.getBoundingClientRect());
        }
      }
      return rects;
    },

    // ...and compute per-uid deltas after it. Nodes present in both frames
    // yield {dx, dy}; enters/exits are the caller's transition planner's job.
    flipDeltas(previousRects) {
      const deltas = new Map();
      for (const [uid, node] of nodes) {
        const prev = previousRects.get(uid);
        if (!prev || typeof node.getBoundingClientRect !== 'function') continue;
        const next = node.getBoundingClientRect();
        const dx = prev.left - next.left;
        const dy = prev.top - next.top;
        if (dx !== 0 || dy !== 0) deltas.set(uid, { dx, dy });
      }
      return deltas;
    },

    nodeFor(uid) {
      return nodes.get(String(uid)) ?? null;
    },

    size() {
      return nodes.size;
    },

    clear() {
      for (const [uid, node] of nodes) {
        onRemove?.(uid, node);
        node.remove();
      }
      nodes.clear();
    },
  });
}
