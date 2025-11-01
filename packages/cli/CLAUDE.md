# issync CLI Development Guide

This file provides guidance specific to developing the issync CLI package.

## CLI Development Commands

When working on the CLI package locally, use these development commands:

```bash
# Run CLI in development mode (without building)
bun run dev --help
bun run dev init <issue-url>
bun run dev pull
bun run dev push
bun run dev watch
bun run dev list
bun run dev remove <issue-url>
bun run dev clean
bun run dev status

# Build the CLI
bun run build

# Testing
bun test                  # Run all tests
bun test --watch          # Watch mode
bun test <file>           # Run specific test file
```

## Development Notes

- The `bun run dev` command executes the CLI directly from source (`src/cli.ts`) using `tsx`
- This is useful for rapid development and testing without building
- For production use, the CLI should be installed globally via `npm install -g @mh4gf/issync`
- See the root `CLAUDE.md` for project-wide development workflow and quality checks
