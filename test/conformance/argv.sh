#!/bin/sh
# The CLI the command wrappers run in test/conformance: writes each argument it
# receives on its own line, a line to stderr, and exits 3.
for a in "$@"; do printf '<%s>\n' "$a"; done
echo "stderr line" >&2
exit 3
