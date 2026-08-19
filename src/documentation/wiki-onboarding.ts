import { FlowrGithubBaseRef } from './doc-util/doc-files';
import { codeBlock } from './doc-util/doc-code';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';

/**
 * https://github.com/flowr-analysis/flowr/wiki/Onboarding
 */
export class WikiOnboarding extends DocMaker<'wiki/Onboarding.md'> {
	constructor() {
		super('wiki/Onboarding.md', module.filename, 'developer onboarding process');
	}

	public text({ ctx }: DocMakerArgs): string {
		return `To get started developing on *flowR*, we recommend carefully reading the following pages:
- 💻 ${ctx.linkPage('wiki/Setup', 'Setting up the *flowR* development environment', '-building-from-scratch')}.\\
  This page explains how to install **R** and **Node.js**.
- 💖 [Contributing guidelines](${FlowrGithubBaseRef}/flowr/tree/main/.github/CONTRIBUTING.md).\\
  This page also includes information about how to set up **git-lfs** and several **git hooks**.

Once you are set up, these pages explain the parts you are most likely to touch:
- 🔬 ${ctx.linkPage('wiki/Core')} walks through the pipeline from parsing to the dataflow graph.
- 🖥️ ${ctx.linkPage('wiki/Interface')} covers the REPL, the server, and the API.
- 🧪 ${ctx.linkPage('wiki/Linting and Testing')} explains which tests exist and how to run them.

If you have any questions, please check out the ${ctx.linkPage('wiki/FAQ')} first, but if the question
is not answered there (or in the wiki in general), feel free to ask a question.
The ${ctx.linkPage('wiki/FAQ')} also includes information about how you can configure your editor.

## ⌛ TL;DR

After installing **R** and **Node.js**, a single command sets everything up:
${codeBlock('shell', 'npm run setup:dev')}

It installs the dependencies, checks your **node** version, tells you whether **R** and **git-lfs** are available,
configures the git hooks, tests them, and closes with the pages and commands you will need next.
Missing **R** or **git-lfs** are reported as notes instead of aborting the setup, so you can start with the
${ctx.linkPage('wiki/Engines', '`tree-sitter` engine')} right away and add them later.

If you want to execute the steps manually, please follow the instructions below:

${codeBlock('shell', `
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
`)}
    `.trim();
	}
}
