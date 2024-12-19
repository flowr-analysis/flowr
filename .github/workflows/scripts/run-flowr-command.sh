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


find_npm_linux() {
  export NPM_CMD="npm"
  export NPX_CMD="npx"

  if ! (type $NPM_CMD >> /dev/null); then
    echo "npm not found, trying to make it available using nvm..."
    if type nvm >> /dev/null; then
      echo "nvm found, using it to install the latest lts node"
      nvm use --lts
    else
      echo "nvm not found, trying to make it available using the nvm.sh"
      # try to make it available based on https://github.com/typicode/husky/issues/912#issuecomment-817522060
      export NVM_DIR="$HOME/.nvm/nvm.sh"
      . "$(dirname $NVM_DIR)/nvm.sh"

      export NVM_DIR="$HOME/.nvm"
      a=$(nvm ls --no-colors | grep 'node')
      v=$(echo "$a" | sed -E 's/.*\(-> ([^ ]+).*/\1/')

      export PATH="$NVM_DIR/versions/node/$v/bin:$PATH"

      if ! (type $NPM_CMD >> /dev/null); then
        echo "no variant of npm or nvm found, trying to use the npm.cmd"
        export NPM_CMD="npm.cmd"
        export NPX_CMD="npx.cmd"
      fi
    fi
  fi
}

if [ -z "${OSTYPE+x}" ]; then
  find_npm_linux
else
  case "$OSTYPE" in
    msys*) export NPM_CMD="npm.cmd" ;
           export NPX_CMD="npx.cmd" ;;
    *)     find_npm_linux ;;
  esac
fi


function group {
  echo "::group::$1"
}
function end_group {
  echo "::endgroup::"
}

group "Ensure node dependencies are installed"
$NPM_CMD ci

if [ "$ACTION" == "doc" ]; then
   # Ensure we run on an Ubuntu runner
   if [[ "${RUNNER_OS:-}" != "Linux" ]]; then
     error_message "This script is only supported on Linux runners"
   fi
   group "Setup graphviz for documentation generation"
   sudo apt-get update
   sudo apt-get install -y graphviz
   end_group
fi

group "Run action $ACTION"
$NPM_CMD run $ACTION
end_group

if [ "$ACTION" == "doc" ]; then
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
