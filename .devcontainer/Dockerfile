# syntax=docker/dockerfile:1

# Node.js + TypeScript base (Debian trixie ships R 4.5, matching flowR's target)
FROM mcr.microsoft.com/devcontainers/typescript-node:4-24-trixie

# R lets flowR use the r-shell engine and execute code; git-lfs pulls test fixtures
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
	&& apt-get install -y --no-install-recommends r-base r-base-dev git-lfs \
	&& apt-get clean && rm -rf /var/lib/apt/lists/*
