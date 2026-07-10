# Contributing

This project is written in TypeScript and bundled into a single `.user.js` file with Vite and vite-plugin-monkey. Use Node.js 26 to match CI.

## Local Development

```bash
npm install
npm run dev
```

The first time you run `npm run dev`, follow the browser prompt to install the development userscript. Subsequent code changes are applied through local hot reload.

The script runs against the live costco.com page. After changing DOM interactions, verify them manually in desktop browsers and the supported iOS Userscripts environment.

## Source Layout

- `src/features/<feature>/` contains each feature's logic, UI, and colocated tests.
- `src/common/` contains reusable API, storage, order, and UI helpers.
- `src/main.ts`, `src/feature-picker.ts`, and `src/sync.ts` coordinate the application flow.

## Building

```bash
npm run build
```

The build output is:

```text
dist/costco-userjs.user.js
```

Configure userscript metadata such as `@match` and `@grant` in `vite.config.ts`. Imported npm dependencies are bundled into the final `.user.js` file.

## Testing and Code Quality

```bash
npm run typecheck     # Run TypeScript type checking
npm run lint          # Run oxlint
npm run lint:fix      # Automatically fix lint issues
npm test              # Run all Vitest tests
npm run test:watch    # Run tests in watch mode
npm run format        # Format with oxfmt
npm run format:check  # Check formatting
npm run build         # Verify the production build
```

Add corresponding Vitest tests when adding or changing testable logic:

- Place tests next to the code under test.
- Name test files `*.test.ts`.
- Extract pure parsing, calculation, filtering, and formatting logic from DOM orchestration and test it separately.
- Verify IndexedDB, network requests, and DOM interactions manually in a browser.

The pre-commit hook runs `oxlint --fix` and `oxfmt --write` on staged JavaScript and TypeScript files and performs TypeScript type checking.

## CI

GitHub Actions runs the following checks on pull requests and pushes to `main`:

1. Lint
2. Type checking
3. Tests
4. Userscript build

## Commits and Releases

All commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/), for example:

```text
feat: add price matching
fix: handle missing product prices
docs: update iOS installation guide
```

The project uses [Release Please](https://github.com/googleapis/release-please) for semantic versioning and releases:

1. After Conventional Commits are merged into `main`, Release Please creates or updates a release PR.
2. The release PR updates `package.json`, `package-lock.json`, and `CHANGELOG.md`.
3. Merging the release PR creates a version tag and a draft GitHub Release.
4. CI builds and uploads `dist/costco-userjs.user.js` from that tag, then publishes the immutable GitHub Release.

A `fix:` commit normally creates a patch release, `feat:` creates a minor release, and a commit containing `!` or `BREAKING CHANGE:` creates a major release. Do not run `npm version` manually.
