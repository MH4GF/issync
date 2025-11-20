#!/bin/bash
set -euo pipefail

PLUGIN_DIR=".claude-plugins/issync/commands"
CODEX_PROMPTS_DIR="$HOME/.codex/prompts"

# Check if we're in the issync repository root
if [ ! -d "$PLUGIN_DIR" ]; then
  echo "Error: $PLUGIN_DIR not found. Please run this script from the issync repository root."
  exit 1
fi

# Create Codex prompts directory
mkdir -p "$CODEX_PROMPTS_DIR"

echo "Setting up Codex prompts from issync plugin commands..."

# Create symlinks for each command file
for file in "$PLUGIN_DIR"/*.md; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    target="$CODEX_PROMPTS_DIR/issync-${filename}"

    # Remove existing symlink if present
    if [ -L "$target" ]; then
      rm "$target"
    fi

    # Create symlink with absolute path
    ln -sf "$(pwd)/$file" "$target"
    echo "  ✓ Linked: issync-${filename%.md}"
  fi
done

echo ""
echo "✅ Codex prompts setup completed!"
echo ""
echo "Available commands in Codex:"
ls -1 "$CODEX_PROMPTS_DIR"/issync-*.md | while read -r file; do
  basename "$file" | sed 's/^issync-/  \/prompts:issync-/' | sed 's/.md$//'
done

echo ""
echo "Note: Restart Codex CLI to load the new prompts."
