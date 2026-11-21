# Security Policy

## Supported Versions

With the release of [v2.0.0](https://github.com/flowr-analysis/flowr/releases/tag/v2.0.0) on May 11, 2024, we only support versions `v2.x`.

## Reporting a Vulnerability

Please report any vulnerability you find privately to **Florian Sihler**
([florian.sihler@uni-ulm.de](mailto:florian.sihler@uni-ulm.de), Ulm University), or through
[GitHub's private advisory form](https://github.com/flowr-analysis/flowr/security/advisories/new).
Please do not open a public issue for something exploitable.

Useful things to include, as far as you have them: what you did, what happened, the flowR version
(`flowr --version`), and the smallest R input that shows the problem.

## What to expect

We aim to acknowledge a report within a few working days and to keep you posted while we look into
it. If the report holds, we will agree a disclosure date with you, fix the issue, and credit you in
the release notes unless you would rather we did not. If it turns out not to be a vulnerability, we
will say so and explain why.

Please give us a reasonable chance to ship a fix before making a report public. We will not pursue
anyone who reports in good faith, stays within the scope below, and does not access, change, or keep
data that is not theirs.

## Scope

flowR analyzes R code without running it, so the interesting boundaries are the ones where untrusted
input meets the analyzer:

- analyzing a hostile R file or project (parsing, normalization, the dataflow analysis),
- the [server](https://github.com/flowr-analysis/flowr/wiki/Interface#communicating-with-the-server)
  and the REPL, including anything reachable over a socket,
- the published [npm package](https://www.npmjs.com/package/@eagleoutice/flowr) and
  [Docker image](https://hub.docker.com/r/eagleoutice/flowr),
- the signature database and the files flowR reads while resolving a project.

To analyze code you do not trust, use the [secure mode](#secure-mode).

Note that `--r-session-access` deliberately hands R code to a real R session: that is the documented
purpose of the flag, not a vulnerability. The same goes for flowR reading files that the invoking
user can already read.

Vulnerabilities in R itself, or in a dependency, are best reported to that project; tell us anyway if
flowR's use of it makes the problem worse.

## Trust model

flowR distinguishes what *you* tell it from what the *analyzed project* (or a client of the server) supplies:

- **Trusted:** command line options, `--config-json`, a config file you name with `--config-file`, your
  global config (`flowr/flowr.json` in your config directory or `$FLOWR_CONFIG_HOME`), and environment variables.
- **Untrusted:** everything in the analyzed project, including a `flowr.json` that flowR finds on its own in the
  working directory or one of its parents (a *project config*), serialized R files (`.rda`, `.rds`, `.rdx`),
  and everything a client sends to the server (code, file paths, queries, REPL commands).

Untrusted input may change *what* flowR reports, but not *what flowR executes, loads, or downloads*:

- **Security-sensitive config options** decide what flowR executes, loads, or downloads, e.g., the path of the R
  executable (`engines[r-shell].rPath`), the tree-sitter WASM binaries, signature database paths, and the
  download repository. flowR ignores them (with a warning) in a project config unless you pass
  `--trust-config`, and a config query cannot change them.
  In the code, such options are tagged with `securitySensitive` in the config schema; a test fails for every
  new string option that is not classified either way.
- **Serialized R files** are read without running R.
- **The secure mode** (see below) blocks starting R or other processes, network access, and more for the whole process.
- **Server clients** cannot use REPL commands that act beyond analyzing code (`localOnly` commands, e.g., the
  master scripts like `:slicer` and `:signature`); a test fails for every new command that is not classified either way.
- **Paths from downloaded or project-supplied files** (e.g., signature database tags, file names, and hashes) are
  joined with `joinUntrustedSegment`, which refuses everything that could leave the intended directory.

The `r-shell` engine runs the R installation you configured (by default the `R` on your `PATH`); flowR has to trust it.

### Secure mode

To analyze untrusted code (e.g., on a server that accepts arbitrary projects), run flowR with `--secure`
(or set `FLOWR_SECURE_MODE=1`). Once enabled, the secure mode cannot be disabled for the lifetime of the process. It

- never starts R (only the `tree-sitter` engine is available, `--r-session-access` is refused) or any other process,
- never accesses the network (no signature database downloads or syncs, no URL checks in the linter) or the clipboard,
- does not search for a project config, and ignores security-sensitive options in *every* config,
- ignores regular expressions in every config and in linter rule configs (they could take exponential time to match),
  keeping flowR's own defaults (options tagged with `regexOption` in the config schema),
- bounds how much a compressed file of the project (e.g., an `.rda`) may decompress to.

These restrictions are enforced where the operation happens (process spawn, network request, ...), not where it is
requested, so they also hold for code paths added later. A way around the secure mode is a vulnerability: please report it.

We recommend the secure mode for every deployment that analyzes code you do not control.

### Server

The server does not authenticate its clients and listens on all interfaces, so only expose it to networks you trust
(e.g., bind the Docker container's port to `127.0.0.1`), and prefer the secure mode.
The WebSocket server (`--ws`) refuses connections from web pages of other origins (cross-site WebSocket hijacking):
it accepts clients that send no `Origin` (i.e., no browser) and pages served from `localhost`; allow further origins
with `--ws-allow-origin <origin>`.
