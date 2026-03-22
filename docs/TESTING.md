# Testing Guide

## Overview

xai-cli uses [Vitest](https://vitest.dev/) as its testing framework. All code contributions must include comprehensive tests.

## Test Philosophy

- **Write tests first** when fixing bugs (TDD approach)
- **100% coverage** for new features
- **No breaking changes** without tests proving backward compatibility
- **Fast execution** - unit tests should run in milliseconds

## Test Structure

### Directory Layout

```
src/
  __tests__/
    api.test.ts              # Zoom API integration tests
    auth.test.ts             # OAuth token management tests
    cli-output.test.ts       # CLI output formatting tests
    cli-validation.test.ts   # CLI input validation tests
    config.test.ts           # Configuration loading tests
    error-handling.test.ts   # Error handling flow tests
    errors.test.ts           # Error class tests
    index.test.ts            # Core logic tests (formatDate, buildTopic)
```

### Naming Conventions

- Test files: `*.test.ts`
- Test suites: `describe("ModuleName - functionality", () => {})`
- Test cases: `it("should do something specific", () => {})`

## Test Categories

### 1. Unit Tests

Test individual functions in isolation.

**Example** (from `index.test.ts`):
```typescript
describe("formatDate", () => {
  it("should format date with yyyy/MM/dd HH:mm pattern in Asia/Tokyo timezone", async () => {
    const date = new Date("2026-02-10T10:00:00Z");
    const format = "yyyy/MM/dd HH:mm";
    const timezone = "Asia/Tokyo";

    const { formatDate } = await import("../index.js");
    const result = formatDate(date, format, timezone);

    expect(result).toBe("2026/02/10 19:00");
  });
});
```

### 2. Validation Tests

Test input validation logic for CLI commands.

**Example** (from `cli-validation.test.ts`):
```typescript
describe("CLI Validation - create command", () => {
  it("should reject duration exceeding 1440 minutes", () => {
    const duration = 1441;

    expect(duration > 1440).toBe(true);
  });
});
```

### 3. Output Tests

Test CLI output formatting (text and JSON).

**Example** (from `cli-output.test.ts`):
```typescript
describe("CLI Output - create command", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it("should output text format for successful meeting creation", () => {
    // ... test implementation
    expect(stdoutSpy).toHaveBeenCalledWith("Meeting created!\n");
  });
});
```

### 4. Error Handling Tests

Test error scenarios and exit codes.

**Example** (from `error-handling.test.ts`):
```typescript
describe("Error Handling", () => {
  it("should handle ValidationError with exit code 2", () => {
    const error = new ValidationError("--start must be valid");

    // Verify error type and exit code
    expect(error instanceof ValidationError).toBe(true);
  });
});
```

## Writing Good Tests

### Follow AAA Pattern

```typescript
it("should do something", () => {
  // Arrange: Set up test data
  const input = "test";

  // Act: Execute the function
  const result = myFunction(input);

  // Assert: Verify the result
  expect(result).toBe("expected");
});
```

### One Assertion Per Test (When Possible)

❌ Bad:
```typescript
it("should validate multiple things", () => {
  expect(result.id).toBe(123);
  expect(result.name).toBe("test");
  expect(result.valid).toBe(true);
});
```

✅ Good:
```typescript
it("should return correct ID", () => {
  expect(result.id).toBe(123);
});

it("should return correct name", () => {
  expect(result.name).toBe("test");
});

it("should mark result as valid", () => {
  expect(result.valid).toBe(true);
});
```

### Use Descriptive Test Names

❌ Bad:
```typescript
it("works", () => {});
it("test 1", () => {});
```

✅ Good:
```typescript
it("should reject invalid ISO 8601 datetime format", () => {});
it("should cache token and reuse on second call", () => {});
```

### Mock External Dependencies

Always mock:
- `fetch` (API calls)
- `process.env` (environment variables)
- `process.stdout.write` (output)
- `process.stderr.write` (errors)
- `process.exit` (exit codes)

**Example**:
```typescript
beforeEach(() => {
  vi.resetModules();
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});
```

### Test Edge Cases

Always test:
- ✅ Valid input (happy path)
- ✅ Invalid input (error cases)
- ✅ Boundary values (0, max, min)
- ✅ Empty values (null, undefined, "")
- ✅ Special characters
- ✅ Extreme inputs (very long strings, large numbers)

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run in watch mode (development)
npm test -- --watch

# Run specific file
npm test src/__tests__/api.test.ts

# Run tests matching pattern
npm test -- --grep "validation"
```

### Debugging Tests

```bash
# Run with verbose output
npm test -- --reporter=verbose

# Run single test file with Node debugger
node --inspect-brk node_modules/.bin/vitest run src/__tests__/api.test.ts
```

## Test Coverage Requirements

| Category | Requirement |
|----------|-------------|
| **New Features** | 100% coverage |
| **Bug Fixes** | Regression test required |
| **Refactoring** | Maintain existing coverage |
| **Overall Project** | Target: 95%+ |

## Common Testing Patterns

### Testing API Functions

```typescript
import { vi, beforeEach, afterEach } from "vitest";

const mockResponse = {
  ok: true,
  status: 200,
  json: () => Promise.resolve({ id: 123 }),
} as Response;

beforeEach(() => {
  vi.resetModules();
  globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});
```

### Testing Environment Variables

```typescript
beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
  process.env["ZOOM_ACCOUNT_ID"] = "test-account";
});

afterEach(() => {
  process.env = originalEnv;
});
```

### Testing Error Messages

```typescript
it("should throw ValidationError with specific message", async () => {
  await expect(someFunction()).rejects.toThrow(
    "--duration must not exceed 1440 minutes"
  );
});
```

## Best Practices

### DO ✅

- Write tests before or alongside code
- Use `vi.resetModules()` to ensure test isolation
- Mock external dependencies
- Test both success and failure paths
- Use meaningful test descriptions
- Keep tests simple and focused

### DON'T ❌

- Skip writing tests ("I'll add them later")
- Test implementation details (test behavior, not internals)
- Write tests that depend on other tests
- Use real external APIs in tests
- Leave commented-out test code
- Write flaky tests (tests that sometimes fail)

## Troubleshooting

### "Module not found" errors

```bash
# Ensure you're using dynamic imports with .js extension
const { myFunction } = await import("../myModule.js");
```

### "Tests pass locally but fail in CI"

- Check for timezone differences
- Ensure all mocks are properly restored
- Use `vi.resetModules()` between tests

### "Tests are slow"

- Avoid unnecessary async operations
- Mock heavy dependencies
- Use `vi.useFakeTimers()` for time-dependent tests

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vitest API Reference](https://vitest.dev/api/)
- [Testing Best Practices](https://opensource.guide/best-practices/)

## Questions?

If you have questions about testing:
1. Check existing test files for examples
2. Ask in [GitHub Discussions](https://github.com/tackeyy/xai-cli/discussions)
3. Open an issue with the `question` label
