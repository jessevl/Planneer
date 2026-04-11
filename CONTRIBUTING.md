# Contributing to Planneer

Thank you for your interest in contributing to Planneer! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

Before submitting a bug report:
1. Check the [existing issues](https://github.com/jessevl/planneer/issues) to avoid duplicates
2. Use the bug report template when creating a new issue
3. Include as much detail as possible:
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Your environment (OS, browser, etc.)

### Suggesting Features

We welcome feature suggestions! Please:
1. Check if the feature has already been suggested
2. Open a new issue with the "feature request" label
3. Describe the feature and its use case clearly
4. Explain why this would benefit other users

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the coding standards** documented in `.github/copilot-instructions.md`
3. **Write tests** for any new functionality
4. **Update documentation** as needed
5. **Run tests** before submitting: `npm run test:run` (frontend) or `make test` (backend)
6. **Create a pull request** with a clear description

Pull requests to `main` also run the container build workflow, and pushes to `main` publish the unified Docker image to GHCR.

### Development Setup

```bash
# Clone and install
git clone https://github.com/jessevl/planneer.git
cd planneer
cd frontend && npm install && cd ..

# Start development servers
make frontend-dev   # Terminal 1 → http://localhost:3000
make backend-dev    # Terminal 2 → http://localhost:8090
```

See the [README](README.md) for full setup instructions.

## Coding Standards

### General
- Write clear, self-documenting code
- Follow existing patterns in the codebase
- Add comments for complex logic
- Keep functions focused and small

### TypeScript (Frontend)
- Use explicit types for function parameters
- Avoid `any` types
- Use interfaces for component props
- Follow React best practices

### Go (Backend)
- Follow standard Go conventions
- Handle errors explicitly
- Write idempotent migrations
- Add logging for important operations

### Git Commit Messages
- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Keep the first line under 72 characters
- Reference issues when applicable

## License

By contributing, you agree that your contributions will be licensed under the [GNU Affero General Public License v3.0](LICENSE).

## Questions?

Feel free to open an issue for any questions about contributing.