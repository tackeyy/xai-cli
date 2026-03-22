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

```text
src/
  __tests__/
    helpers/
      mock-fetch.ts            # Shared fetch mock helpers
  lib/__tests__/
    client.test.ts             # XaiClient API wrapper tests
    retry.test.ts              # Retry logic and XaiApiError tests
  cli/__tests__/
    commands.test.ts           # CLI command integration tests
```

### Naming Conventions

- Test files: `*.test.ts`
- Test suites: `describe("ModuleName - functionality", () => {})`
- Test cases: `it("should do something specific", () => {})`

## Test Categories

### 1. Unit Tests

Test individual functions in isolation.

**Example** (from `client.test.ts`):

```typescript
describe("XaiClient - search", () => {
  it("should send correct request for keyword search", async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockXaiResponse("results"));
    globalThis.fetch = mockFetch;

    const client = new XaiClient({ apiKey: "test-key" });
    const result = await client.search("AI");

    expect(result.text).toBe("results");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tools[0].type).toBe("x_search");
  });
});
```

### 2. Retry Tests

Test retry logic with exponential backoff.

**Example** (from `retry.test.ts`):

```typescript
describe("withRetry", () => {
  it("should retry on 429 and eventually succeed", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new XaiApiError(429, "Rate limited"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, { baseDelayMs: 1, maxDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
```

### 3. CLI Tests

Test CLI commands with injected mock client.

**Example** (from `commands.test.ts`):

```typescript
describe("CLI commands - search", () => {
  it("should call client.search with query", async () => {
    const client = await run(["search", "AI"]);
    expect(client.search).toHaveBeenCalledWith("AI", expect.any(Object));
  });
});
```

### 4. Error Handling Tests

Test error scenarios and exit codes.

**Example**:

```typescript
describe("error handling", () => {
  it("should print error and exit 1 on failure", async () => {
    const client = createMockClient();
    (client.search as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("API failed"),
    );
    await run(["search", "test"], client);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("API failed"));
    expect(exitSpy).toHaveBeenCalledWith(1);
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

### Use Descriptive Test Names

Bad:

```typescript
it("works", () => {});
it("test 1", () => {});
```

Good:

```typescript
it("should strip @ prefix from handle", () => {});
it("should throw XaiApiError on 401 response", () => {});
```

### Mock External Dependencies

Always mock:

- `fetch` (API calls)
- `process.env` (environment variables)
- `console.log` / `console.error` (output)
- `process.exit` (exit codes)

**Example**:

```typescript
beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});
```

### Testing Environment Variables

```typescript
it("should throw if XAI_API_KEY is not set", () => {
  delete process.env.XAI_API_KEY;
  // ... test that CLI exits with appropriate error
});
```

### Test Edge Cases

Always test:

- Valid input (happy path)
- Invalid input (error cases)
- Boundary values
- Empty values (null, undefined, "")
- Special characters (URLs, @handles)

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run in watch mode (development)
npm run test:watch

# Run specific file
npm test src/lib/__tests__/client.test.ts

# Run tests matching pattern
npm test -- --grep "search"
```

### Debugging Tests

```bash
# Run with verbose output
npm test -- --reporter=verbose
```

## Test Coverage Requirements

| Category | Requirement |
|----------|-------------|
| **New Features** | 100% coverage |
| **Bug Fixes** | Regression test required |
| **Refactoring** | Maintain existing coverage |
| **Overall Project** | Target: 95%+ |

## Best Practices

### DO

- Write tests before or alongside code
- Use `vi.restoreAllMocks()` to ensure test isolation
- Mock external dependencies
- Test both success and failure paths
- Use meaningful test descriptions
- Keep tests simple and focused

### DON'T

- Skip writing tests ("I'll add them later")
- Test implementation details (test behavior, not internals)
- Write tests that depend on other tests
- Use real external APIs in tests
- Leave commented-out test code
- Write flaky tests (tests that sometimes fail)

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vitest API Reference](https://vitest.dev/api/)

## Questions?

If you have questions about testing:

1. Check existing test files for examples
2. Ask in [GitHub Discussions](https://github.com/tackeyy/xai-cli/discussions)
3. Open an issue with the `question` label
