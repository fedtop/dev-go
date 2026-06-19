# Agent Instructions

## Code Quality

- Follow the current project lint rules in `eslint.config.mjs` for all code changes.
- Before finishing any code change, run the same checks that can block `lint-staged`:
  - `pnpm compile`
  - `pnpm exec eslint <changed ts/js/mjs/cjs/tsx/jsx files>`
  - `pnpm exec prettier --check <changed files covered by lint-staged>`
- Do not rely on the commit hook to discover avoidable issues. Fix ESLint and TypeScript errors before handing work back.
- Keep TypeScript imports explicit with `import type` when an import is only used as a type.
- Use `_`-prefixed unused parameters when an API callback requires an argument that the implementation does not use.

## Local Development

- `web-ext.config.ts` is a gitignored local preference file. Keep browser-launch preferences there instead of adding `webExt.disabled` back to `wxt.config.ts`.
- `devgo-backup.json` is a gitignored local backup seed used by development builds. Do not commit personal backup data.
