#!/usr/bin/env bash
# install R or pandoc through the package manager of the runner, for when the downloads from github.com fail
set -uo pipefail

tool="$1"
install() {
	case "${RUNNER_OS}" in
		Linux) sudo timeout 600 env DEBIAN_FRONTEND=noninteractive apt-get install -y "$1" ;;
		macOS) brew install "$2" ;;
		Windows) choco install -y --no-progress "$3" ;;
	esac
}

case "${tool}" in
	pandoc)
		install pandoc pandoc pandoc
		;;
	r)
		if ! command -v Rscript > /dev/null; then
			install r-base r r.project || exit 1
		fi
		if [ "${RUNNER_OS}" = Windows ] && ! command -v Rscript > /dev/null; then
			bin="$(ls -d '/c/Program Files/R/'R-*/bin | sort -V | tail -n 1)"
			cygpath -w "${bin}" >> "${GITHUB_PATH}"
			export PATH="${bin}:${PATH}"
		fi
		# the system library of the package manager's R is not writable
		lib="${HOME}/R-library"
		mkdir -p "${lib}"
		[ "${RUNNER_OS}" = Windows ] && lib="$(cygpath -m "${lib}")"
		echo "R_LIBS_USER=${lib}" >> "${GITHUB_ENV}"
		echo "::warning::setup-r failed, the tests run on R $(Rscript -e 'cat(format(getRversion()))') of the package manager"
		;;
esac
