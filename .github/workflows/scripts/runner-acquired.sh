#!/usr/bin/env bash
# Usage: runner-acquired.sh <job name>
# Prints "true" if a runner picked up the job of this run attempt whose name is (or ends with, as jobs of reusable
# workflows are prefixed by their caller) the given name, and "false" if GitHub gave up on finding one.
# A job that timed out or was cancelled after it started counts as acquired.
set -euo pipefail

name="$1"
jobs=$(gh api --paginate "repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID/attempts/${GITHUB_RUN_ATTEMPT:-1}/jobs" \
  --jq ".jobs[] | select(.name == \"$name\" or (.name | endswith(\" / $name\"))) | (.runner_name // \"\") + \"|\" + (.steps | length | tostring)")

if [ -z "$jobs" ]; then
  echo "::error::Found no job named '$name' in this run" >&2
  exit 1
fi

while IFS='|' read -r runner steps; do
  if [ -n "$runner" ] || [ "$steps" -gt 0 ]; then
    echo true
    exit 0
  fi
done <<< "$jobs"
echo false
