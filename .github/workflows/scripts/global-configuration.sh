# this script exports global environment variables for other actions to use!

if [[ -z "${GITHUB_ENV:-}" ]]; then
   echo "::error file=$FILENAME,line=$LINENO::The GITHUB_ENV environment variable is required"
   exit 1
fi

function make_var {
   export $1=${2:-}
   echo "$1=${2:-}" >> $GITHUB_ENV
}

make_var ACTION_NODE_VERSION "21.6.x"
make_var ACTION_R_VERSION "4.4.0"
