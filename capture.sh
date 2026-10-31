#!/usr/bin/env bash
# Capture desktop + mobile screenshots of CAPTURE_URL into CAPTURE_DIR.
set -euo pipefail

cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"

: "${CAPTURE_URL:?Set CAPTURE_URL to the preview URL}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to an output directory outside the project}"

timed() {
  printf '[%s] + %s\n' "$(date +%H:%M:%S)" "$*" >&2
  /usr/bin/time -p "$@"
}

# Capture evidence must not land inside the source tree.
mkdir -p "$CAPTURE_DIR"
capture_real="$(cd "$CAPTURE_DIR" && pwd -P)"
project_real="$(pwd -P)"
case "$capture_real" in
  "$project_real"|"$project_real"/*)
    echo "CAPTURE_DIR must be outside $project_real (got $capture_real)." >&2
    exit 1
    ;;
esac

echo "== capture.sh: url=$CAPTURE_URL dir=$capture_real ==" >&2

# A failed run must not leave stale evidence from an earlier attempt.
timed rm -f "$capture_real/final-desktop.png" "$capture_real/final-mobile.png"

timed test -f capture.mjs
timed node -e 'process.exit(process.versions.node.split(".")[0] >= 18 ? 0 : 1)'

status=0
timed node "$PROJECT_DIR/capture.mjs" || status=$?

for view in desktop mobile; do
  file="$capture_real/final-$view.png"
  if [[ -f "$file" ]]; then
    timed ls -l "$file" >&2
  else
    echo "missing $file" >&2
  fi
done

exit "$status"
