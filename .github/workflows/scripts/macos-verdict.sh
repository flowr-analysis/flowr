#!/usr/bin/env bash
# Usage: macos-verdict.sh <arm64 result> <arm64 acquired> <intel result> <intel acquired>
# Prints "passed" if a macOS leg passed, "no-runner" if neither leg found a runner, and "failed" otherwise.
# A leg that started and then timed out or was cancelled counts as failed, so hanging tests never pass.
set -euo pipefail

arm64="$1" arm64_acquired="$2" intel="$3" intel_acquired="$4"

if [ "$arm64" = success ] || [ "$intel" = success ]; then
  echo passed
elif [ "$arm64" = cancelled ] && [ "$arm64_acquired" = false ] && [ "$intel" = cancelled ] && [ "$intel_acquired" = false ]; then
  echo "::warning::No macOS runner was acquired for either the arm64 or the intel leg, so this run did not test macOS" >&2
  echo no-runner
else
  echo "::error::The macOS tests failed (arm64: $arm64, acquired: ${arm64_acquired:-n/a}, intel: $intel, acquired: ${intel_acquired:-n/a})" >&2
  echo failed
fi
