# issync

CLI tool to sync text between GitHub Issue comments and local files.

## Development

### Install dependencies

```bash
bun install
```

### Run CLI

```bash
bun run dev --help
```

### Run tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch
```

### Type check

```bash
bun run type-check
```

### Build

```bash
bun run build
```

## Project Structure

```
issync/
├── src/
│   ├── cli.ts           # CLI entry point
│   ├── commands/        # Command implementations
│   ├── lib/
│   │   ├── config.ts    # .issync.yml management
│   │   ├── github.ts    # GitHub API client
│   │   └── hash.ts      # Hash utilities
│   └── types/           # TypeScript types
└── docs/
    └── plan.md          # Development plan
```

## License

MIT
