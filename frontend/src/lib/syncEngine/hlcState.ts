/**
 * @file syncEngine/hlcState.ts
 * @description HLC state persistence
 */

import { getHLC, tick } from '../crdt';
import { saveHLCState, loadHLCState } from '../offlineDb';

/**
 * Restore HLC state from IndexedDB.
 */
export async function restoreHLCState(): Promise<void> {
  const hlcState = await loadHLCState();
  if (hlcState) {
    getHLC().restore({ ts: hlcState.ts, counter: hlcState.counter });
  }
}

/**
 * Persist current HLC state to IndexedDB.
 */
export async function persistHLCState(): Promise<void> {
  const state = getHLC().export();
  await saveHLCState(state);
}

/**
 * Get current HLC tick and persist state.
 */
export async function tickAndPersist(): Promise<void> {
  tick();
  await persistHLCState();
}
