#!/bin/sh

# Let's check for updates to the package.json and if so suggest an update.
# To my knowledge, there is no "post-pull" hook unifying the semantics.
changedFiles="$(git diff-tree -r --name-only --no-commit-id HEAD@{1} HEAD)"

changed() {
  line="---------------------------------------------------------"
  echo "$line"
  echo "The package.json file has changed, it may be a good idea "
  echo "to run 'npm ci'"
  echo "$line"
}


# no `grep -q`: it stops at the first hit and the write side then dies of a broken pipe
if printf '%s\n' "$changedFiles" | grep -- '^package\.json$' > /dev/null; then
  changed
fi
exit 0
