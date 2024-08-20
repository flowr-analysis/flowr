#! /usr/bin/env bash

# run-flowr-command.sh <ACTION>

# This script replaces the old `run.yaml` (https://github.com/flowr-analysis/flowr/blob/28fe74f5d6bc203f0ac75c4be6887ab958f01556/.github/workflows/run.yaml) action.
# Separate from the action, you have to upload the coverage, upload the benchmark results, 
# or upload the documentation. Additionally, dep installation is now separate!
# Yet, this script will create the commit for you!

FILENAME=$(basename $0)

function error_message {
   echo "::error file=$FILENAME,line=$LINENO::$1"
   exit 1
}

# We expect the following environment variables to be set:
if [[ -z "${GITHUB_ENV:-}" ]]; then
   error_message "The GITHUB_ENV environment variable is required"
fi
if [[ -z "${RUNNER_OS:-}" ]]; then
   error_message "The RUNNER_OS environment variable is required"
fi
if [[ -z "${1:-}" ]]; then
   error_message "The ACTION argument is required"
fi

ACTION=$1

set -eu

# Ensure we run on an Ubuntu runner
if [[ "${RUNNER_OS:-}" != "Linux" ]]; then
  error_message "This script is only supported on Linux runners"
fi

function group {
  echo "::group::$1"
}
function end_group {
  echo "::endgroup::"
}

group "Ensure node dependencies are installed"
npm ci

if [ "$ACTION" -eq "doc" ]; then
   group "Setup graphviz for documentation generation"
   sudo apt-get update
   sudo apt-get install -y graphviz
   end_group
fi

group "Run action $ACTION"
npm run $ACTION
end_group

if [ "$ACTION" -eq "doc" ]; then
   group "Create documentation commit"
   git config --local user.email "action@github.com"
   git config --local user.name "GitHub Action"
   git add -f "doc/"
   if [ -d "wiki/stats/" ]; then git add -f "wiki/stats/"; fi
   git commit -m "Update documentation"
   # make the branch an orphan
   git checkout --orphan gh-pages-orphan-tmp
   git commit -m "Current documentation stage"
   end_group
fi