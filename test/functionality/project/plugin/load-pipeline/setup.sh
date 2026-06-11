#!/usr/bin/env bash
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RDA_DIR="${SCRIPT_DIR}/zenodo"
CSV_FILE="${RDA_DIR}/zenodo_files.csv"

if [ ! -f "${CSV_FILE}" ]; then
    echo "CSV file not found at ${CSV_FILE}."
    echo "Please provide the zenodo_files.csv file. See README.md for instructions."
    exit 1
fi

mkdir -p "${RDA_DIR}/files"

MAX_SIZE=$((1 * 1024 * 1024 * 1024))

echo "Normalizing CSV line endings..."
sed -i 's/\r//' "${CSV_FILE}"


echo "Downloading RDA/RData files..."
grep -oP "https://zenodo\.org/record/[0-9]+/files/[^\s'\"]+\.(?i:rda|rdata)[^\s'\"]*" "${CSV_FILE}" | while read -r url; do
    echo "DEBUG: ${url}"
    record_id=$(echo "${url}" | grep -oP "zenodo\.org/record/\K[0-9]+")
    filename=$(basename "${url%%\?*}")
    output="${RDA_DIR}/files/${record_id}_${filename}"

    if [ -f "${output}" ]; then
        echo "  SKIPPING ${filename} (already exists)"
        continue
    fi

    content_length=$(wget --server-response --spider "${url}" 2>&1 | grep -i "Content-Length" | tail -1 | grep -oP "[0-9]+" || echo "0")

#    if [ "${content_length}" -gt "${MAX_SIZE}" ]; then
#        echo "  SKIPPING ${filename} (${content_length} bytes > 1GB)"
#        continue
#    fi

    echo "  Downloading ${record_id}_${filename} (${content_length} bytes)..."
    wget -q --tries=3 --waitretry=5 -O "${output}" "${url}" || { echo "  WARNING: Failed to download ${url}"; rm -f "${output}"; }
    sleep 1
done

echo "Done. RDA files saved to ${RDA_DIR}/files/"