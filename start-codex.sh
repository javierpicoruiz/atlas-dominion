#!/usr/bin/env bash
set -euo pipefail

echo "Atlas Dominion bootstrap files are present."
echo "Starting Codex with the first task..."
codex "Read AGENTS.md and TASK.md and execute TASK.md completely. Run tests and the production build before finishing."
