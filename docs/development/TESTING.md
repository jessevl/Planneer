# Testing

This repository uses three test layers regularly: frontend unit tests, frontend E2E tests, and backend Go tests.

## Commands

### Frontend

```bash
cd frontend

npm run test
npm run test:run
npm run test:coverage
npm run test:e2e
npm run test:e2e:ui
```

### Backend

```bash
cd backend

go test ./... -v
```

### Common validation before merging

```bash
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run test:run
cd backend && go test ./... -v
```

## Suite Map

| Suite | Tool | Location |
| --- | --- | --- |
| Unit and component tests | Vitest | `frontend/src/**/*.{test,spec}.{ts,tsx}` |
| End-to-end tests | Playwright | `frontend/e2e/` |
| Backend tests | Go test | `backend/**/*_test.go` |

## Playwright Notes

- Use `npm run test:e2e:ui` when iterating interactively.
- Use `npx playwright test --debug` for step-through debugging.
- Use the screenshots flow when you intentionally update visual expectations.

## Expectations

- New utility, hook, or store behavior should usually come with automated coverage.
- UI-heavy work should be manually checked in desktop and mobile layouts.
- Theme-sensitive changes should be checked in light and dark themes.

## Known Gaps

- Coverage is not comprehensive.
- Some product behavior still relies on manual verification.
- Flaky or environment-sensitive failures should be documented in the PR, not ignored.