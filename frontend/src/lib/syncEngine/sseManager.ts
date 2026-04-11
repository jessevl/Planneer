/**
 * @file syncEngine/sseManager.ts
 * @description SSE subscription management for real-time sync
 * 
 * NOTE: Uses Unified Pages architecture - 'pages' collection replaces 'pages' and 'projects'
 */

import * as tasksApi from '@/api/tasksApi';
import * as pagesApi from '@/api/pagesApi';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';
import type { DataChangeEvent } from './types';
import { SyncEventEmitter } from './events';
import {
  handleRemoteTaskChange,
  handleRemotePageChange,
} from './remoteHandlers';
import { stripPageMetadata } from './utils';
import { devLog, devWarn } from '@/lib/config';

/**
 * Manages SSE subscriptions for real-time sync.
 */
export class SSEManager {
  private unsubscribeFns: (() => void)[] = [];
  private syncingRecords: Set<string>;
  private eventEmitter: SyncEventEmitter;

  constructor(syncingRecords: Set<string>, eventEmitter: SyncEventEmitter) {
    this.syncingRecords = syncingRecords;
    this.eventEmitter = eventEmitter;
  }

  /**
   * Start SSE subscriptions for all collections.
   */
  start(workspaceId: string): void {
    if (!workspaceId) {
      devWarn('[SyncEngine] Cannot start realtime sync without workspace');
      return;
    }

    // Clean up any existing subscriptions
    this.stop();

    devLog('[SyncEngine] Starting realtime sync for workspace:', workspaceId);

    // Subscribe to tasks
    const unsubTasks = tasksApi.subscribeToTasks((action, task) => {
      // Skip if we're syncing this record (prevents echo)
      if (this.syncingRecords.has(task.id)) {
        devLog(`[SyncEngine] Ignoring SSE ${action} for task ${task.id} (syncing)`);
        return;
      }
      
      // Update last sync time on SSE receive
      this.eventEmitter.emit({ type: 'sync-complete', data: { pendingCount: -1 } }); // -1 = don't update pending count
      
      handleRemoteTaskChange(action, task).then((merged) => {
        if (merged) {
          const { _syncStatus, _hlc, _fieldHLCs, _serverVersion, ...clean } = merged;
          this.eventEmitter.emit({
            type: 'tasks-changed',
            data: { action, record: clean } as DataChangeEvent<Task>,
          });
        } else if (action === 'delete') {
          this.eventEmitter.emit({
            type: 'tasks-changed',
            data: { action: 'delete', recordId: task.id } as DataChangeEvent<Task>,
          });
        }
      }).catch(console.error);
    });
    this.unsubscribeFns.push(unsubTasks);

    // Subscribe to pages
    const unsubNotes = pagesApi.subscribeToPages((action, page, changedBlocks, deletedBlocks, blockOrders) => {
      // Skip if we're currently syncing this page (echo suppression)
      if (this.syncingRecords.has(page.id)) {
        devLog(`[SyncEngine] Ignoring SSE ${action} for page ${page.id} (syncing)`);
        return;
      }
      
      const hasBlocks = changedBlocks && Object.keys(changedBlocks).length > 0;
      const hasOrders = blockOrders && Object.keys(blockOrders).length > 0;
      devLog(`[SyncEngine] SSE page ${action}:`, page.id, 
        hasBlocks ? `with ${Object.keys(changedBlocks).length} blocks` : '(metadata only)',
        'deletedBlocks:', deletedBlocks?.length || 0,
        hasOrders ? `orderChanges: ${Object.keys(blockOrders).length}` : '');
      
      // Update last sync time on SSE receive
      this.eventEmitter.emit({ type: 'sync-complete', data: { pendingCount: -1 } }); // -1 = don't update pending count
      
      // handleRemotePageChange handles echo detection inline by comparing against _lastSyncedContent
      handleRemotePageChange(action, page, changedBlocks, deletedBlocks, blockOrders).then((merged) => {
        if (merged) {
          devLog(`[SyncEngine] Page ${page.id} merged, emitting to store. Content length:`, merged.content?.length || 0);
          const strippedPage = stripPageMetadata(merged);
          
          // All pages (pages and task collections) go to pages-changed event
          this.eventEmitter.emit({
            type: 'pages-changed',
            data: { action, record: strippedPage } as DataChangeEvent<Page>,
          });
        } else if (action === 'delete') {
          devLog(`[SyncEngine] Page ${page.id} deleted, emitting to store`);
          this.eventEmitter.emit({
            type: 'pages-changed',
            data: { action: 'delete', recordId: page.id } as DataChangeEvent<Page>,
          });
        }
      }).catch(console.error);
    });
    this.unsubscribeFns.push(unsubNotes);
  }

  /**
   * Stop all SSE subscriptions.
   */
  stop(): void {
    for (const unsub of this.unsubscribeFns) {
      try {
        unsub();
      } catch (e) {
        devLog('[SyncEngine] Error unsubscribing:', e);
      }
    }
    this.unsubscribeFns = [];
  }
}
