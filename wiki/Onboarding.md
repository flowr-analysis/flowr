_<span title="an overview of flowR's developer onboarding process">Generated</span> from '[src/documentation/wiki-onboarding.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-onboarding.ts)' on 2026-08-16, 06:15:25 UTC (v2.13.16, R v4.6.1), so please do not edit it directly._

To get started developing on *flowR*, we recommend carefully reading the following pages:
- 💻 [Setting up the *flowR* development environment](https://github.com/flowr-analysis/flowr/wiki/Setup#-building-from-scratch).\
  This page explains how to install **R** and **Node.js**.
- 💖 [Contributing guidelines](https://github.com/flowr-analysis/flowr/tree/main/.github/CONTRIBUTING.md).\
  This page also includes information about how to set up **git-lfs** and several **git hooks**.

Once you are set up, these pages explain the parts you are most likely to touch:
- 🔬 [Core](https://github.com/flowr-analysis/flowr/wiki/Core) walks through the pipeline from parsing to the dataflow graph.
- 🖥️ [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) covers the REPL, the server, and the API.
- 🧪 [Linting and Testing](https://github.com/flowr-analysis/flowr/wiki/Linting-and-Testing) explains which tests exist and how to run them.

If you have any questions, please check out the [FAQ](https://github.com/flowr-analysis/flowr/wiki/FAQ) first, but if the question
is not answered there (or in the wiki in general), feel free to ask a question.
The [FAQ](https://github.com/flowr-analysis/flowr/wiki/FAQ) also includes information about how you can configure your editor.

## ⌛ TL;DR

After installing **R** and **Node.js**, a single command sets everything up:

```shell
npm run setup:dev
```


It installs the dependencies, checks your **node** version, tells you whether **R** and **git-lfs** are available,
configures the git hooks, tests them, and closes with the pages and commands you will need next.
Missing **R** or **git-lfs** are reported as notes instead of aborting the setup, so you can start with the
[`tree-sitter` engine](https://github.com/flowr-analysis/flowr/wiki/Engines) right away and add them later.

If you want to execute the steps manually, please follow the instructions below:


```shell

# Installing git-lfs for your current user (if you haven't already)
git lfs install
# Cloning the repository
git clone https://github.com/flowr-analysis/flowr.git
# Installing dependencies
npm ci
# Configuring git hooks
git config --local core.hooksPath .githooks/
# Test if the git hooks are working correctly
# Running this command should lint the code
git push --dry-run
```