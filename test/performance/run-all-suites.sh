#!/usr/bin/env bash

set -eu

# default to 1 parallel processes
PARALLEL="${1-1}"

SUITE_PREFIX="suite-"

## collect all suites in this folder, sort for consistency
readarray -t SUITES < <(find . -maxdepth 1 -type d -name "${SUITE_PREFIX}*" | sed "s|^\./${SUITE_PREFIX}||" | sort)

echo "Found ${#SUITES[*]} suite(s)"

for SUITE in "${SUITES[@]}"; do
  CMD=(bash run-suite.sh "${SUITE}" "${SUITE}-results" "${PARALLEL}")
  echo -e "Suite-Command: \"${CMD[*]}\"..."
  "${CMD[@]}"
done

