# AGENTS.md

Costco userscript written in TypeScript and bundled into a single `.user.js` file with Vite and vite-plugin-monkey.

- The build output is a userscript, not a regular website or library. Configure userscript metadata such as `@match` and `@grant` in `vite.config.ts`.
- Imported npm packages are bundled into the final `.user.js` file.
- The script runs against the live costco.com page. Verify DOM interactions manually in a browser.

## Testing

- Add corresponding Vitest tests for code changes.
- Place test files next to the code under test and name them `*.test.ts`.
- Extract testable pure logic, such as parsing, calculations, and formatting, from DOM operations and test it separately.

## Git commits and releases

- All commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/).
- Release Please manages versions and releases; do not run `npm version` manually.
