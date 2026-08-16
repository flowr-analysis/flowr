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
OTHER_ARGS=${*:2}

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

DOC_OUT="doc"
DOC_REQUIRED_FILES=(
  "index.html"
  "hierarchy.html"
  "modules.html"
  "assets/style.css"
  "assets/main.js"
  "assets/icons.svg"
  "assets/search.js"
  "assets/navigation.js"
)
DOC_MIN_PAGES=1000

function verify_doc_output {
  local missing=()
  local f
  for f in "${DOC_REQUIRED_FILES[@]}"; do
    if [ ! -s "$DOC_OUT/$f" ]; then
      missing+=("$DOC_OUT/$f")
    fi
  done
  if [ ${#missing[@]} -gt 0 ]; then
    error_message "typedoc produced an incomplete build, missing: ${missing[*]}. Refusing to publish (this would wipe the live documentation)."
  fi

  local pages
  pages=$(find "$DOC_OUT" -name '*.html' -type f | wc -l)
  if [ "$pages" -lt "$DOC_MIN_PAGES" ]; then
    error_message "typedoc produced only $pages pages (expected at least $DOC_MIN_PAGES). Refusing to publish (this would wipe the live documentation)."
  fi
  echo "Documentation looks complete: $pages pages."
}

group "Ensure node dependencies are installed"
if [ -d node_modules ]; then
   echo "node_modules is present, skipping the install"
else
   $NPM_CMD ci
fi
end_group

if [ "$ACTION" == "doc" ]; then
   # Ensure we run on an Ubuntu runner
   if [[ "${RUNNER_OS:-}" != "Linux" ]]; then
     error_message "This script is only supported on Linux runners"
   fi
   group "Setup graphviz for documentation generation"
   sudo apt-get update
   sudo apt-get install -y graphviz
   end_group
   export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=8192"
fi

group "Run action $ACTION"
if ! $NPM_CMD run $ACTION $OTHER_ARGS; then
   end_group
   error_message "npm run $ACTION failed"
fi
end_group

if [ "$ACTION" == "doc" ]; then
   group "Verify the generated documentation"
   verify_doc_output
   end_group

   group "Generate the landing page and the signature browser"
   # the browser is a few MB and deliberately uncommitted, so gh-pages is where it gets published
   $NPM_CMD run gen:landing
   if [ ! -s "wiki/sigdb/index.html" ]; then
     echo "::warning::the signature browser was not generated (no signature database?), so it will 404 on the site"
   fi
   end_group

   group "Create documentation commit"
   git config --local user.email "action@github.com"
   git config --local user.name "GitHub Action"
   touch .nojekyll
   git add -f ".nojekyll" "$DOC_OUT/"
   if [ -d "wiki/stats/" ]; then git add -f "wiki/stats/"; fi
   git add -f "index.html"
   if [ -d "wiki/sigdb/" ]; then git add -f "wiki/sigdb/"; fi
   git commit -m "Update documentation"
   # make the branch an orphan
   git checkout --orphan gh-pages-orphan-tmp
   git commit -m "Current documentation stage"
   end_group
fi
