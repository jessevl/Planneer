# Development Process

This repository favors straightforward local workflows over heavyweight ceremony.

## Local Development

```bash
./scripts/dev.sh

cd frontend && npm run dev
cd backend && go run . serve --dev
```

## Before Opening a PR

1. Run the frontend type check.
2. Run frontend lint.
3. Run relevant automated tests.
4. Manually check UI work in light mode, dark mode, and a mobile viewport.

## Commit Style

Use concise conventional-commit style messages when possible:

- `feat(tasks): add recurring task validation`
- `fix(pages): preserve icon color on rename`
- `docs(docs): reorganize documentation tree`

## Review Standard

Review should prioritize:

- correctness
- regressions
- type safety
- authorization and data-safety implications
- test coverage for risky changes

## Repository-Specific Expectations

- Keep migrations idempotent.
- Keep data flow store-driven and sync-engine-centric.
- Avoid bypassing store or sync abstractions from UI code.
- Treat offline behavior as a product contract.

## Release Reality

- Production ships as a single image from the monorepo.
- `VERSION` is part of the release flow.
- Container publishing and version tagging are automated in GitHub Actions.