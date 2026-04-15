# Developer Guide

This guide covers how to set up, build, test, and contribute to Fabricate.

## Getting Started

### Prerequisites

- Node.js 18+ (recommend using [nvm](https://github.com/nvm-sh/nvm))
- npm 9+

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-org/fabricate.git
cd fabricate
```

2. Install dependencies:

```bash
npm install
```

3. Verify your setup by running tests:

```bash
npm test
```

## Project Structure

```
fabricate/
├── src/
│   ├── index.ts                 # Main entry point
│   ├── types.ts                 # TypeScript types and interfaces
│   ├── constants.ts             # Constants
│   ├── adapters/                # Storage & request handling
│   │   ├── storage/             # StorageLike implementations
│   │   └── stub/                # Stub mode logic (collections, routes, handlers)
│   ├── application/             # Core business logic
│   │   ├── create-stub-manager.ts
│   │   ├── execute-request.ts
│   │   ├── resolve-post-generated-fields.ts
│   │   └── ports.ts             # Interface contracts
│   ├── client/                  # Public API
│   │   └── create-fetch-client.ts
│   ├── errors/                  # Custom error classes
│   ├── http/                    # HTTP utilities (request, response, URL)
│   ├── ui/                      # Stub Studio UI components
│   │   └── mount-stub-studio.ts # Interactive panel for stub mode
│   ├── ports/                   # Port definitions
│   └── utils/                   # Utilities (object, value helpers)
├── test/
│   └── index.test.ts            # Test suite
├── example/                     # Example application
│   └── src/main.js
├── docs/
│   ├── usage.md                 # User documentation
│   └── developer-guide.md       # This file
├── tsconfig.json                # TypeScript configuration
└── package.json
```

## Common Tasks

### Build the Project

Compile TypeScript to JavaScript:

```bash
npm run build
```

Output is generated in the `dist/` directory.

Clean build artifacts:

```bash
npm run clean
```

### Run Tests

Execute the full test suite using Vitest:

```bash
npm test
```

Watch mode for development:

```bash
npm test -- --watch
```

Coverage report:

```bash
npm test -- --coverage
```

### Lint and Format

Run the linter:

```bash
npm run lint
```

Check formatting:

```bash
npm run prettier
```

Apply formatting fixes:

```bash
npm run prettier:fix
```

### Run the Example

From the `example/` directory:

```bash
cd example
npm install
npm run dev
```

This starts a local development server with hot reload.

## Key Concepts

### Stub Mode

The stub mode engine allows frontend development without a real backend by storing/retrieving data from `localStorage`.

**Key files:**

- `src/adapters/stub/` - Core stub logic
- `src/application/create-stub-manager.ts` - StubManager implementation
- `src/ui/mount-stub-studio.ts` - Interactive UI for managing stubs

**Features:**

- **Collection mode**: REST-like routes (`/users`, `/users/123`)
- **Resource mode**: Single-document routes (`/profile`)
- **Post-generated fields**: Auto-generate fields using Faker.js
- **Scenarios**: Save/load preset stub data configurations

### Stub Studio

The Stub Studio is an interactive drawer panel UI built into web apps for managing stub data in development.

- Located in `src/ui/mount-stub-studio.ts`
- Can be mounted via `mountStubStudio()` or `mountStubStudioDrawer()`
- Provides panels for:
  - Storage inspection and editing
  - Field mapping (Extra Mapping Generated Field)
  - Scenario management

### Storage Abstraction

The `StorageLike` interface allows pluggable storage backends:

- `localStorage` (default in browsers)
- `MemoryStorage` (for tests, SSR)
- Custom implementations in `src/adapters/storage/`

## Making Changes

### Code Style

- Use TypeScript strict mode
- Prefer immutability and functional patterns
- Keep functions small and single-purpose
- Comment complex logic

### Commits

Follow [conventional commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `test:` test improvements
- `refactor:` code refactoring
- `chore:` maintenance

Example:

```bash
git commit -m "feat: add scenario import/export feature"
```

Semantic release uses these commit messages to calculate the next version automatically:

- `fix:` produces a patch release
- `feat:` produces a minor release
- `BREAKING CHANGE:` or `!` produces a major release

### Pull Requests

1. Create a feature branch from `main`:

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make your changes and commit them

3. Run tests locally to ensure nothing breaks:

   ```bash
   npm test
   ```

4. Build the project:

   ```bash
   npm run build
   ```

5. Push and open a pull request with a clear description

## CI/CD and Releases

The GitHub Actions workflow in `.github/workflows/ci.yml` runs:

- on pull requests: `prettier`, `lint`, `test`, `build`, and the example site build
- on pushes to `main`: the same checks, then semantic-release, then GitHub Pages deployment

Release automation is handled by semantic-release with conventional commits. On each merge to `main`, the workflow:

- calculates the next semver version
- creates a Git tag and GitHub release
- publishes the package to npm

### Required Repository Settings

1. Add an `NPM_TOKEN` repository secret with an npm automation token that can publish `fabricate`.
2. In GitHub repository settings, set Pages to use **GitHub Actions** as the source.
3. Keep merges to `main` using conventional commit messages if you want predictable version bumps.

## Architecture Overview

### Request Flow

```
createFetchClient()
├── Stub mode OFF
│   └── fetch() → real API
│
└── Stub mode ON
    └── StubManager
        ├── Parse route (collection vs resource)
        ├── Build storage key
        ├── Execute operation (GET, POST, PATCH, etc.)
        ├── Apply post-generated fields (Faker)
        └── Return synthetic response
```

### Type Safety

The entire codebase is written in TypeScript with strict mode enabled:

- Request and response bodies are fully typed
- Configuration options use discriminated unions
- Generic types for flexible API usage

### Storage Keys

Keys follow this pattern:

```
fabricate:[strategy]:[path]
fabricate:collection:/users
fabricate:resource:/profile
```

## Troubleshooting

### Tests fail after changes

- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Run with verbose output: `npm test -- --reporter=verbose`

### TypeScript errors

- Rebuild: `npm run clean && npm run build`
- Check tsconfig.json for compiler options

### Example app not working

- Ensure dependencies are installed: `cd example && npm install`
- Check that Fabricate is built: `npm run build` from root

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)
- [Faker.js Documentation](https://fakerjs.dev/)
- [LocalStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
