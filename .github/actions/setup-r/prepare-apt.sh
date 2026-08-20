#!/usr/bin/env bash
# bound the apt work setup-r does, so a stalled ubuntu mirror fails instead of hanging the job
set -uo pipefail

sudo tee /etc/apt/apt.conf.d/99-flowr-ci > /dev/null <<'EOF'
Acquire::Retries "3";
Acquire::http::Timeout "20";
Acquire::https::Timeout "20";
Acquire::Languages "none";
EOF

# what setup-r installs before it unpacks the R package
packages=(gdebi-core qpdf devscripts ghostscript)

for attempt in 1 2 3; do
	if sudo timeout 120 env DEBIAN_FRONTEND=noninteractive apt-get update -y &&
		sudo timeout 240 env DEBIAN_FRONTEND=noninteractive apt-get install -y "${packages[@]}"; then
		exit 0
	fi
	echo "::warning::apt failed or stalled (attempt ${attempt}/3)"
	sudo pkill -f 'apt-get|dpkg' || true
	sudo rm -f /var/lib/apt/lists/lock /var/cache/apt/archives/lock /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock
	sudo dpkg --configure -a || true
	sleep 15
done

echo "::warning::could not prepare apt, leaving the install to setup-r"
