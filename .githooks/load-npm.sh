#!/bin/sh

find_npm_linux() {
  export NPM_CMD="npm"
  export NPX_CMD="npx"

  if ! type "$NPM_CMD" > /dev/null 2>&1; then
    # hooks run in a non-interactive shell, where nvm is not loaded unless its script is sourced
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
      echo "npm not found, making it available using nvm..."
      . "$NVM_DIR/nvm.sh"
      nvm use --lts > /dev/null 2>&1 || nvm use default > /dev/null 2>&1 || true
    fi
    if ! type "$NPM_CMD" > /dev/null 2>&1; then
      echo "no variant of npm or nvm found, trying to use the npm.cmd"
      export NPM_CMD="npm.cmd"
      export NPX_CMD="npx.cmd"
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
