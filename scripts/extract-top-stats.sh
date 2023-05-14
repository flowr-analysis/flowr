#!/usr/bin/env bash

FILE="top-r-downloads.txt"
ROOT_FOLDER="${HOME}/Documents/CRAN/"

readarray -t content < <(cut -d ',' -f 1 "${FILE}")

# add path prefix [PATH prefix] content

for i in "${!content[@]}"; do
  arr[i]="${ROOT_FOLDER}${content[i]}"
done

DIR="./statistics-out/top-$(date +%Y-%m-%d-%H-%M-%S)/"
mkdir -p "${DIR}"
npm run stats -- "${arr[@]}" --output-dir "${DIR}" |& tee -a "${DIR}/full.log"

