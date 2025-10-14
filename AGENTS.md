# Repository Guidelines

## Project Structure & Module Organization
- Core CLI lives in `src/`; entry `src/cli.ts`, commands in `src/commands/`, shared logic in `src/lib/`, and reusable types in `src/types/`.
- Tests are colocated as `*.test.ts` beside the module under test for quick discovery.
- Build artifacts land in `dist/`; treat them as generated output only.
- Runtime sync state is written to `.issync/state.yml` and must stay untracked (`.issync/` is ignored).
- Consult `docs/plan.md` before altering flows to stay aligned.

## Build, Test, and Development Commands
- `bun install` bootstraps dependencies (needs Bun >=1.1 and Node >=18).
- After the first install, run `npx lefthook install` to set up Git hooks in the local clone.
- `bun run dev --help` or `bun run dev init <issue-url>` exercise the CLI without compiling.
- `bun test`, `bun test --watch`, `bun test path/to/file.test.ts` run Bun’s Jest-compatible runner.
- `bun run type-check` invokes `tsc`; `bun run lint:check`, `bun run format:check`, and `bun run check:ci` match CI's static analysis.
- `bun run check` runs Biome linter and formatter; `bun run knip` detects unused dependencies and exports.
- `bun run lint:fix`, `bun run format`, and `bun run knip:fix` clean lint/format issues and unused exports before review.
- `bun run build` emits the distributable CLI to `dist/`.

## Coding Style & Naming Conventions
- Biome handles formatting: 2-space indent, 100-character lines, single quotes, trailing commas, and minimal semicolons (`bun run format`).
- ESLint adds async safety rules (`require-await`, `no-floating-promises`, `await-thenable`, `return-await`); resolve violations rather than suppressing them.
- Use `camelCase` for values/functions, `PascalCase` for types or classes, and UPPER_SNAKE_CASE for constants. Name command files with imperative verbs (`watch.ts`, `pull.ts`).
- Run format + lint before committing.

## Testing Guidelines
- Mirror implementation names (`watch.test.ts` maps to `watch.ts`) and assert both success and failure output for CLI workflows.
- Keep `bun test --watch` running for fast feedback; mock GitHub API calls as shown in `src/lib/github.test.ts`.
- Ensure `bun run check:ci` passes locally before submitting a PR.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`) as established in git history; scopes help clarify impact.
- Keep commits focused and squash noisy WIP history before pushing.
- PRs should describe behavior changes, list validation commands, link related issues, and include CLI output when user messaging changes.
- Update `docs/plan.md` whenever workflows or architecture shift so concurrent sessions stay aligned.

## Security & Configuration Tips
- Store GitHub tokens in `.issync/state.yml`; prefer least-privilege fine-grained PATs (`gho_...`) and rotate after sharing.
- Never commit `.issync/` or other secrets; confirm `.gitignore` covers local scratch files or logs created during tests.
