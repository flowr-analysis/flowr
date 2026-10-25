#!/bin/sh

# runs `git lfs <hook> <args>`; a machine without git-lfs is fine, the repository does not store files with it
lfs() {
  if command -v git-lfs > /dev/null 2>&1; then
    git lfs "$@"
  fi
}
