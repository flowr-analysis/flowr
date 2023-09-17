#!/usr/bin/env bash

set -eu

# default to 1 parallel processes
PARALLEL="${1-1}"


SUITE_PREFIX="suite-"
OUTPUT_DIR="results/"

mkdir -p "${OUTPUT_DIR}"

## collect all suites in this folder, sort for consistency
readarray -t SUITES < <(find . -maxdepth 1 -type d -name "${SUITE_PREFIX}*" | sed "s|^\./${SUITE_PREFIX}||" | sort)

echo "Found ${#SUITES[*]} suite(s)"

for SUITE in "${SUITES[@]}"; do
  CMD=(bash run-suite.sh "${SUITE}" "${OUTPUT_DIR}/${SUITE}" "${PARALLEL}")
  echo -e "Suite-Command: \"${CMD[*]}\"..."
  "${CMD[@]}"
done

