# Contributing to xai-cli

Thank you for your interest in contributing to xai-cli! This document provides guidelines and
instructions for contributing to the project.

## 🙏 Welcome!

xai-cli is a CLI tool for managing Zoom meetings via Server-to-Server OAuth. We welcome
contributions from everyone, whether you're fixing a bug, adding a feature, or improving
documentation.

## 📖 Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Before You Start](#before-you-start)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Submitting Changes](#submitting-changes)
- [Code Review Process](#code-review-process)
- [Community Guidelines](#community-guidelines)
- [Getting Help](#getting-help)

## 🚀 Ways to Contribute

### You can contribute by:

- 🐛 **Reporting bugs** - Found an issue? Let us know!
- 💡 **Suggesting features** - Have an idea? We'd love to hear it
- 📝 **Improving documentation** - Help make our docs clearer
- 🔧 **Submitting bug fixes** - Fix issues and help improve stability
- ✨ **Adding new features** - Expand xai-cli's capabilities (discuss first!)

## 🎯 Before You Start

1. **Check existing issues/PRs** to avoid duplication
2. **For new features**, open an issue first to discuss the proposal
3. **Read our [Testing Guide](docs/TESTING.md)** to understand our testing approach
4. **Ensure you understand our [Code of Conduct](CODE_OF_CONDUCT.md)**

## 💻 Development Setup

### Prerequisites

- Node.js 18+ / npm 9+
- Zoom Server-to-Server OAuth credentials ([How to get credentials](https://developers.zoom.us/docs/internal-apps/))

### Setup Steps

```bash
# 1. Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/xai-cli.git
cd xai-cli

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your Zoom credentials:
# ZOOM_ACCOUNT_ID=your_account_id
# ZOOM_CLIENT_ID=your_client_id
# ZOOM_CLIENT_SECRET=your_client_secret

# 4. Run tests to verify setup
npm test

# 5. Build the project
npm run build

# 6. Test the CLI locally
node dist/index.js --version
```

## 📐 Coding Standards

### TypeScript Style

- Use **strict TypeScript mode** (already configured)
- Prefer `const` over `let`, avoid `var`
- Use descriptive variable names (`meetingId` not `id`)
- Avoid `any` type - use `unknown` if needed
- Add types for function parameters and return values

### Code Organization

- Keep functions small and focused (single responsibility)
- Extract complex logic into separate functions
- Add comments only when logic isn't self-evident
- Follow existing patterns in the codebase

### Commit Message Convention

Format: `<type>: <subject>`

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `test:` Test additions/changes
- `docs:` Documentation changes
- `refactor:` Code refactoring (no functional changes)
- `chore:` Maintenance tasks (dependencies, tooling)

**Examples:**
```
feat: add support for recurring meetings
fix: correct timezone conversion in formatDate function
test: add validation tests for update command
docs: update README with new --json flag
refactor: extract validation logic to separate module
chore: update dependencies to latest versions
```

## 🧪 Testing Requirements

**All code contributions MUST include tests.**

### Test Types

1. **Unit Tests** - Test individual functions in isolation
2. **Validation Tests** - Test CLI input validation logic
3. **Output Tests** - Test CLI output formatting (text and JSON)
4. **Error Handling Tests** - Test error scenarios and exit codes

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (during development)
npm test -- --watch

# Run specific test file
npm test src/__tests__/api.test.ts
```

### Test Writing Guidelines

- Follow **Arrange/Act/Assert** pattern
- One assertion per test when possible
- Use descriptive test names: `it("should reject invalid ISO 8601 datetime", ...)`
- Mock external dependencies (`fetch`, `process.env`)
- See **[docs/TESTING.md](docs/TESTING.md)** for comprehensive testing guide

### Test Coverage Expectations

- **New features**: 100% coverage for new code
- **Bug fixes**: Add regression test reproducing the bug
- **Refactoring**: Maintain or improve existing coverage

## 📝 Submitting Changes

### Pull Request Process

#### 1. Create a branch

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

#### 2. Make your changes

- Write code
- Add tests
- Update documentation if needed

#### 3. Ensure quality

```bash
npm test          # All tests must pass
npm run build     # Build must succeed
```

#### 4. Commit your changes

```bash
git add .
git commit -m "feat: add your feature description"
```

#### 5. Push and create PR

```bash
git push origin feat/your-feature-name
# Then create PR via GitHub UI
```

#### 6. Fill out PR template

- Describe what changed and why
- Link related issues with `Closes #123`
- Provide testing evidence
- Check all applicable boxes in the template

### PR Requirements Checklist

Before submitting, ensure:

- ✅ All tests pass (`npm test`)
- ✅ Build succeeds (`npm run build`)
- ✅ Code follows project style
- ✅ Commit messages follow convention
- ✅ Tests added for new functionality
- ✅ Documentation updated (if applicable)
- ✅ PR template fully completed

### What to Expect

- **Initial review** within 2-3 business days
- **Feedback** and requested changes from maintainers
- **Approval and merge** once all requirements are met

## 👀 Code Review Process

### For Contributors

- **Be responsive** to feedback and questions
- **Ask for clarification** if feedback is unclear
- **Push updates** to the same branch (PR will auto-update)
- **Be patient and respectful** throughout the process

### Review Criteria

Reviewers will check:

- ✅ **Functionality** - Does it work as intended?
- ✅ **Tests** - Are they comprehensive and passing?
- ✅ **Code Quality** - Is it readable and maintainable?
- ✅ **Documentation** - Is it clear and up-to-date?
- ✅ **Performance** - Are there any obvious performance issues?
- ✅ **Security** - Are there any potential vulnerabilities?

## 🤝 Community Guidelines

- Be respectful and welcoming to all contributors
- Follow our [Code of Conduct](CODE_OF_CONDUCT.md)
- Provide constructive feedback
- Assume good intentions
- Help others learn and grow

## 📬 Getting Help

- 💬 **Questions** - Open a [GitHub Discussion](https://github.com/tackeyy/xai-cli/discussions)
- 🐛 **Bug Reports** - Open an [Issue](https://github.com/tackeyy/xai-cli/issues/new?template=bug_report.yml)
- 💡 **Feature Requests** - Open an [Issue](https://github.com/tackeyy/xai-cli/issues/new?template=feature_request.yml)
- ❓ **General Questions** - Open an [Issue](https://github.com/tackeyy/xai-cli/issues/new?template=question.yml)

## 🙌 Recognition

All contributors are recognized in:

- GitHub Contributors page
- Release notes (for significant contributions)
- Our gratitude and thanks! 🎉

---

Thank you for contributing to xai-cli! Your efforts help make this tool better for everyone.
