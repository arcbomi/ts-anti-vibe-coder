# Vue + TypeScript + Vite

This frontend now runs on Vue 3 with Vite and Vue Router.

## Scripts

- `npm run dev` starts the local dev server.
- `npm run build` type-checks with `vue-tsc` and builds production assets.
- `npm run test:integration` runs the Vitest integration suite.

## Structure

- `src/app` contains the Vue router and app bootstrap.
- `src/pages` contains route-level Vue pages.
- `src/domains` contains domain-owned Vue sections, composables, stores, and APIs.
- `src/shared` contains reusable UI and state helpers.
