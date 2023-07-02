#!/usr/bin/env bash

### Collects all files in the given root folder, shuffles them in a random order and calls the benchmark tool on them
### until the given LIMIT is reached or all files have been processed
### (files which offer no slicing points or fail to process are *not* counted towards the limit) .

ROOT_FOLDER="${HOME}/GitHub/phd/R-code-data/R_code_files/Zenodo_R_files/"
LIMIT=2

echo "Collecting files in \"${ROOT_FOLDER}\" (this may take a while)"

# shuffle with shuf
readarray -t CONTAINED < <(find "${ROOT_FOLDER}" -type f | shuf)

echo "Total number of files: ${#CONTAINED[@]} benchmark with limit ${LIMIT}"

counter=0
for file in "${CONTAINED[@]}"; do
  if [[ ${counter} -ge ${LIMIT} ]]; then
    echo "Limit reached, stopping"
    break
  fi

  echo "Processing file ${file}"
  npm run benchmark -- "${file}" --output-dir "./benchmark-out/" |& tee -a "./benchmark-out/full.log"
  counter=$((counter + 1))
done
