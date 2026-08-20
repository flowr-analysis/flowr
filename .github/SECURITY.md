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

Note that `--r-session-access` deliberately hands R code to a real R session: that is the documented
purpose of the flag, not a vulnerability. The same goes for flowR reading files that the invoking
user can already read.

Vulnerabilities in R itself, or in a dependency, are best reported to that project; tell us anyway if
flowR's use of it makes the problem worse.
