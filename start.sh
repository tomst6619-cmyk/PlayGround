#!/usr/bin/env bash
# Build the static site into dist/ and serve it in the foreground on $PORT.
set -euo pipefail

cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"
DIST="$PROJECT_DIR/dist"
PORT="${PORT:-3000}"
META_DIR="${OPENCODE_WEB_DIR:-${RUNNER_TEMP:-/tmp}/omgithub-web}"
META_FILE="$META_DIR/deployment-output.json"

export PORT

# Per-command timing: every step below runs through this helper.
timed() {
  printf '[%s] + %s\n' "$(date +%H:%M:%S)" "$*" >&2
  /usr/bin/time -p "$@"
}

echo "== start.sh: project=$PROJECT_DIR port=$PORT ==" >&2

# 1. Dependencies: none. The site is plain HTML/CSS/JS and the server uses Node built-ins.
timed node -e 'process.exit(process.versions.node.split(".")[0] >= 18 ? 0 : 1)'
timed test -f index.html
timed test -f styles.css
timed test -f app.js
timed test -f server.mjs

# 2. Build: emit a clean static directory inside the project.
timed rm -rf "$DIST"
timed mkdir -p "$DIST"
timed cp index.html styles.css app.js "$DIST/"
timed test -f "$DIST/index.html"

# 3. Deployment metadata for the worker (outside the project source).
timed mkdir -p "$META_DIR"
timed node -e '
  const fs = require("node:fs");
  const [file, project, directory] = process.argv.slice(1);
  fs.writeFileSync(file, JSON.stringify({ project, directory }, null, 2) + "\n");
' "$META_FILE" "$PROJECT_DIR" "$DIST"
timed cat "$META_FILE" >&2

echo "== serving $DIST on 0.0.0.0:$PORT ==" >&2
exec node "$PROJECT_DIR/server.mjs" "$DIST"
