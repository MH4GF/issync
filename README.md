# issync

CLI tool to sync text between GitHub Issue comments and local files, enabling AI-driven development workflows.

## Overview

`issync` allows AI agents to maintain living documentation (like `plan.md`) in GitHub Issues as a single source of truth. Multiple local sessions (git worktrees, Devin, Claude Code, etc.) can read and write to the same document concurrently without git conflicts.

**Core Features:**

- **Transparent to AI agents**: AI coding agents use normal file operations, issync handles sync in background
- **Conflict detection**: Hash-based optimistic locking prevents data loss
- **Watch mode**: Automatic bidirectional sync between local files and GitHub Issue comments
- **Safety checks**: 3-way comparison on watch startup prevents accidental overwrites

## Installation

```bash
npm install -g @mh4gf/issync
```

**Requirements:**

- Node.js >= 18.0.0
- GitHub Personal Access Token with `repo` scope

## Quick Start

### 1. Set up GitHub token

```bash
export GITHUB_TOKEN=$(gh auth token)  # Using GitHub CLI
# or
export GITHUB_TOKEN=ghp_your_token_here
```

### 2. Initialize sync

```bash
# Link a GitHub Issue to a local file
issync init https://github.com/owner/repo/issues/123 --file docs/plan.md

# Create from template
issync init https://github.com/owner/repo/issues/123 --file docs/plan.md --template template.md
```

### 3. Start watch mode

**⚠️ IMPORTANT: Always start watch mode BEFORE editing files**

```bash
issync watch

# With custom polling interval (default: 60s)
issync watch --interval 10
```

### 4. Edit files normally

AI agents and editors can now read/edit the file normally. issync automatically syncs changes.

## Commands

### `issync init <issue-url>`

Initialize sync for a GitHub Issue.

```bash
issync init https://github.com/owner/repo/issues/123 --file docs/plan.md
```

**Options:**
- `--file <path>`: Local file path (default: `.issync/docs/plan-{issue-number}.md`)
  - Example: For issue #123, the default will be `.issync/docs/plan-123.md`
  - This allows tracking multiple issues without file name conflicts
- `--template <path>`: Create file from template if it doesn't exist

**Behavior:**
- Detects existing issync-managed comments on the Issue and pulls the content
- Creates a new file from template if no existing comment is found
- Config is stored in your home directory (global configuration)

### `issync pull`

Pull remote changes from GitHub Issue comment to local file.

```bash
issync pull

# Select specific sync target
issync pull --file docs/plan.md
issync pull --issue https://github.com/owner/repo/issues/123
```

**Options:**
- `--file <path>`: Select sync target by local file path
- `--issue <url>`: Select sync target by issue URL

### `issync push`

Push local changes to GitHub Issue comment.

```bash
issync push

# Force push (skip optimistic lock check)
issync push --force

# Select specific sync target
issync push --file docs/plan.md
issync push --issue https://github.com/owner/repo/issues/123
```

**Options:**
- `--file <path>`: Select sync target by local file path
- `--issue <url>`: Select sync target by issue URL
- `--force`: Skip optimistic lock check and force overwrite remote changes
  - ⚠️ **WARNING**: Concurrent remote changes will be permanently lost
  - Displays warning and asks for confirmation before execution
  - Use cases:
    - Resolving conflicts when you're certain local version is correct
    - Recovering from corrupted remote state
  - Similar to `git push --force`
  - **Best practice**: Always verify remote content before using this option

**Example workflow with force:**
```bash
# 1. Check remote content first
issync pull

# 2. Review the changes
cat docs/plan.md

# 3. If local is correct and you want to overwrite remote
issync push --force
```

### `issync open`

Open the GitHub Issue in your browser for a synced file.

```bash
# Open issue (auto-select if only one sync)
issync open

# Select specific sync target
issync open --file docs/plan.md
issync open --issue https://github.com/owner/repo/issues/123
```

**Options:**
- `-f, --file <path>`: Select sync target by local file path
- `--issue <url>`: Select sync target by issue URL

**Behavior:**
- Opens the GitHub Issue URL in your default browser
- Platform-specific browser commands:
  - macOS: `open`
  - Linux: `xdg-open`
  - Windows: `start`
- When only one sync exists: Opens immediately
- When multiple syncs exist: Requires `--file` or `--issue` option

### `issync watch`

Start watch mode (foreground process, press Ctrl+C to stop).

```bash
issync watch

# Custom polling interval (default: 30s)
issync watch --interval 10

# Select specific sync target
issync watch --file docs/plan.md
issync watch --issue https://github.com/owner/repo/issues/123
```

**Options:**
- `--interval <seconds>`: Polling interval in seconds (default: 30, min: 1, max: 3600)
- `--file <path>`: Select sync target by local file path
- `--issue <url>`: Select sync target by issue URL

**Watch mode behavior:**

- Polls GitHub Issue comment every 30 seconds (configurable)
- Watches local file for changes with `chokidar`
- Automatically syncs changes bidirectionally
- Safety check on startup: detects conflicts and auto-syncs if only one side changed
- Supports multiple sync targets: Watches all configured syncs in the selected config

### `issync remove`

Remove a sync configuration from state.yml.

```bash
# Remove sync by issue URL
issync remove --issue https://github.com/owner/repo/issues/123

# Remove sync by local file path
issync remove --file docs/plan.md

# Remove sync and delete the local file
issync remove --file docs/plan.md --delete-file
```

**Options:**
- `-f, --file <path>`: Select sync target by local file path
- `--issue <url>`: Select sync target by issue URL
- `--delete-file`: Also delete the local file

**Important notes:**
- Removal is immediate with no confirmation prompt (recoverable with `issync init`)
- When watch daemon is running, a warning is displayed but removal proceeds
- Uses atomic updates to preserve other sync configurations

## Configuration

### Config File Location

issync stores its configuration in your home directory (global configuration). This allows tracking issues across multiple repositories from a single location.

### Config File Format

```yaml
syncs:
  - issue_url: https://github.com/owner/repo/issues/123
    comment_id: 123456789
    local_file: docs/plan.md
    last_synced_hash: abc123def
    last_synced_at: '2025-10-14T12:00:00.000Z'
  - issue_url: https://github.com/owner/repo/issues/456
    comment_id: 987654321
    local_file: docs/design.md
    last_synced_hash: def456abc
    last_synced_at: '2025-10-14T13:00:00.000Z'
```

### .gitignore

Add `.issync/` to your project's `.gitignore` to exclude progress documents:

```gitignore
# issync progress documents (synced via GitHub Issues)
.issync/
```

**Note**:
- Progress documents (`.issync/docs/`) are synced via GitHub Issues and should not be tracked by git
- The configuration file is in your home directory and doesn't need to be git-ignored

## Workflow for AI Agents

**Recommended workflow in CLAUDE.md or project documentation:**

```bash
# 1. Set GitHub token
export GITHUB_TOKEN=$(gh auth token)

# 2. Start watch mode FIRST (before any edits)
issync watch

# 3. Then edit files
# AI agents can now safely read/edit the synced file
```

**Why this order matters:** The MVP's pull operation overwrites local files. If you edit before starting watch, and the remote is outdated, your changes may be lost.

## How It Works

### issync Comment Identification

issync uses invisible HTML comment markers to identify its managed comments in GitHub Issues:

```markdown
<!-- issync:v1:start -->
# Your document content here
...
<!-- issync:v1:end -->
```

**Benefits:**
- Multiple sessions can discover the same remote comment automatically
- Markers are invisible in GitHub's rendered UI
- Version-aware design (`v1`) enables future format upgrades
- Auto-repair: If markers are accidentally deleted, `push` command restores them

### Conflict Detection (Pull side)

When issync pulls remote changes, it updates the local file. If an AI agent's `Edit()` tool tries to modify the file, it will fail because `old_string` no longer matches (the file was updated). The agent naturally re-reads and retries.

### Optimistic Locking (Push side)

1. Local file change detected
2. Read local file and calculate hash
3. Fetch remote comment
4. Compare `last_synced_hash` from state with remote hash
5. If mismatch → conflict (abort)
6. If match → update comment, save new hash

### Watch Mode Safety Check

On watch startup, issync performs a 3-way comparison:

- **Both changed**: Block startup, user must resolve manually
- **Only local changed**: Auto-push to remote
- **Only remote changed**: Auto-pull from remote
- **Neither changed**: Start watching normally

## Limitations (MVP)

- **No merge logic**: Pull overwrites local file completely
- **Foreground watch**: Daemon mode planned for Phase 2
- **No section-based merging**: Smart merge strategy planned for Phase 2

## Glossary

### 進捗ドキュメント (Progress Document)

Documents managed by issync that synchronize bidirectionally between GitHub Issue comments and local files, recording project progress and decisions.

**Characteristics:**
- Filename pattern: `plan-{number}-{slug}.md` (e.g., `plan-123-watch-daemon.md`)
- Template: Generated from `docs/progress-document-template.md`
- Purpose: Recording development progress, architecture decisions, task management, retrospectives
- Sync destination: GitHub Issue comments (identified by HTML comment markers)

**Aliases/Former names:**
- Previously called "plan.md" but unified to "progress document" to avoid confusion with specific filenames (2025-10-21)

**Related terms:**
- Living documentation: Continuously updated documents
- Single Source of Truth (SSOT): GitHub Issues as the sole authoritative source

## Development

This project uses a **bun workspaces** monorepo structure:
- `packages/cli/` - The issync CLI tool (published to npm as `@mh4gf/issync`)
- `apps/` - Future: Deployable applications (e.g., orchestrator web app)
- `internal-packages/` - Future: Shared internal packages

Most development happens in `packages/cli/`. See [CLAUDE.md](./CLAUDE.md) for detailed development setup and architecture.

```bash
# Install dependencies
bun install

# Run CLI in development
bun run dev init <issue-url>

# Run tests
bun test

# Build for distribution
bun run build
```

## License

MIT

## Author

MH4GF

## Links

- [GitHub Repository](https://github.com/MH4GF/issync)
- [Issue Tracker](https://github.com/MH4GF/issync/issues)
