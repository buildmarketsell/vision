#!/bin/bash
# Claude Code "Stop" hook: runs the project's checks before Claude may say it is done.
# Fails → exit 2, and the errors go back to Claude to fix. Skips when nothing changed since the last pass.
# Install: see README.md in this folder.

input=$(cat)
# Second stop in a row (Claude already tried to fix): let it stop and report, no endless loop.
echo "$input" | grep -q '"stop_hook_active": *true' && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

state_file="$(git rev-parse --git-dir)/claude-check-ok"
state=$( { git rev-parse HEAD 2>/dev/null; git status --porcelain; git diff; } | shasum | cut -d' ' -f1)
[ -f "$state_file" ] && [ "$(cat "$state_file")" = "$state" ] && exit 0

if [ -f package.json ] && grep -q '"check":' package.json; then
  cmd="npm run check --silent"
elif [ -f pyproject.toml ]; then
  cmd="uv run ruff check ."
  [ -d tests ] && cmd="$cmd && uv run pytest -q"
else
  exit 0
fi

output=$(env -u ELECTRON_RUN_AS_NODE bash -c "$cmd" 2>&1)
if [ $? -eq 0 ]; then
  echo "$state" > "$state_file"
  exit 0
fi

{
  echo "The project's checks failed ($cmd). Fix the cause (not the symptom, no disabling rules) before saying you are done. If you cannot, tell Dan plainly what fails."
  echo "$output" | tail -60
} >&2
exit 2
