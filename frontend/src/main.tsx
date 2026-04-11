/**
 * @file main.tsx
 * @description Application entry point for Vite + TanStack Router
 * @app ROOT - Initializes React, router, and global providers
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './app/globals.css';
import ThemeInitializer from './app/ThemeInitializer';
import ConfigInitializer from './app/ConfigInitializer';

// Create the router instance
const router = createRouter({ 
  routeTree,
  defaultPreload: 'intent',
});

// Register router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Mount the app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigInitializer />
    <ThemeInitializer />
    <RouterProvider router={router} />
  </React.StrictMode>
);
