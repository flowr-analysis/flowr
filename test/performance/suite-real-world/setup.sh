#!/usr/bin/env bash

# clean up existing folder
rm -rf files/

mkdir -p files/

set -eu

SOURCES_URL="https://github.com/flowr-analysis/flowr/releases/download/v1.0.0/socialscience-sources.zip"

for attempt in 1 2 3 4 5; do
  if wget --tries=3 --timeout=60 --waitretry=10 --retry-connrefused \
          --retry-on-http-error=408,429,500,502,503,504 \
          -O files/tmp.zip "${SOURCES_URL}" && unzip -tqq files/tmp.zip; then
    break
  fi
  if [[ "${attempt}" -eq 5 ]]; then
    echo "Failed to download a valid ${SOURCES_URL} after ${attempt} attempts." >&2
    exit 1
  fi
  echo "Download of ${SOURCES_URL} failed (attempt ${attempt}), retrying in $((attempt * 15))s..." >&2
  sleep "$((attempt * 15))"
done

# read all files to extract from static/real-world-pkg-files.txt
readarray -t USE < <(cat static/real-world-pkg-files.txt)

for i in "${!USE[@]}"; do
  USE[$i]="SocialScience/${USE[$i]}"
done

echo "Extracting ${#USE[@]} files from tmp.zip..."
echo "Files to extract: ${USE[*]}"
unzip -u files/tmp.zip "${USE[@]}" -d files/


rm files/tmp.zip
