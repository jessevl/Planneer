/**
 * @file syncEngine/events.ts
 * @description Event handling and subscription management for the sync engine
 */

import type { SyncEvent, SyncEventListener } from './types';
import { devLog } from '../config';

/**
 * Event emitter for sync engine events.
 * Manages subscriptions and emission of sync-related events.
 */
export class SyncEventEmitter {
  private listeners = new Set<SyncEventListener>();

  /**
   * Subscribe to sync events.
   * @returns Unsubscribe function
   */
  subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit an event to all listeners.
   */
  emit(event: SyncEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        devLog('[SyncEngine] Event listener error:', e);
      }
    }
  }

  /**
   * Clear all listeners.
   */
  clear(): void {
    this.listeners.clear();
  }
}
