#!/usr/bin/env bash

FILE="top-r-downloads.txt"
ROOT_FOLDER="${HOME}/Documents/CRAN/"

readarray -t content < <(cut -d ',' -f 1 "${FILE}")

# add path prefix [PATH prefix] content

for i in "${!content[@]}"; do
  arr[i]="${ROOT_FOLDER}${content[i]}"
done

mkdir -p "./stats-output/top-$(date +%Y-%m-%d-%H-%M-%S)/"
npm run stats -- "${arr[@]}" --output-dir "./stats-output/top/" |& tee -a "./stats-output/top/full.log"

