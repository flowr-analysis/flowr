#!/usr/bin/env bash

set -eu

### Gets a suite name benchmarks the complete suite using the `benchmark` script and summarizes the results.

SUITE_NAME="$1"
OUT_BASE="$(pwd)/$2"
OUTPUT_FILE="${OUT_BASE}.json"
RAW_OUTPUT="${OUT_BASE}-raw.json"
PARALLEL=1

if [[ -z "${SUITE_NAME}" ||  -z "${OUTPUT_FILE}"  ]]; then
  printf "No suite name or output file given.\nUsage: %s <suite-name> <output-file>\n" "$0"
  exit 1
fi

SUITE="suite-${SUITE_NAME}"
SETUP_SCRIPT="setup.sh"

# check that the input file does exist
if [[ ! -d "${SUITE}" || ! -f "${SUITE}/${SETUP_SCRIPT}" ]]; then
  printf "Suite file \"%s\" does not exist or has no \"%s\".\n" "${SUITE}" "${SETUP_SCRIPT}"
  exit 2
fi

echo "Running Suite \"${SUITE}\"..."
cd "${SUITE}"
printf "  * Setup (%s)... " "${SETUP_SCRIPT}"
bash "${SETUP_SCRIPT}"
echo "done."

FILES_DIR="$(pwd)/files/"

## run the benchmark script for each file
CMD=(npm run benchmark -- --parallel "${PARALLEL}" --output "${RAW_OUTPUT}" "${FILES_DIR}")

echo -e "  * Running: \"${CMD[*]}\"...\033[33m"
"${CMD[@]}"
echo -e "\033[0m  * Done (written to ${RAW_OUTPUT})."
echo "  * Summarizing results to ${OUTPUT_FILE}..."

CMD=(npm run summarizer -- --input "${RAW_OUTPUT}" --output "${OUTPUT_FILE}")
echo -e "  * Running: \"${CMD[*]}\"...\033[33m"
"${CMD[@]}"
echo -e "\033[0m  * Done (written to ${OUTPUT_FILE})."
