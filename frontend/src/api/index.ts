/**
 * @file index.ts
 * @description Barrel export for API layer
 * @app SHARED - Data access layer
 * 
 * The API layer abstracts data operations using PocketBase as the backend.
 * 
 * Available APIs:
 * - tasksApi: Task CRUD operations
 * - pagesApi: Pages CRUD (pages, collections, task collections)
 * - searchApi: Full-text and semantic search
 */

export * as tasksApi from './tasksApi';
export * as pagesApi from './pagesApi';
export * as searchApi from './searchApi';
