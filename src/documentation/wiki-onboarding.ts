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

If you have any questions, please check out the ${ctx.linkPage('wiki/FAQ')} first, but if the question
is not answered there (or in the wiki in general), feel free to ask a question.
The ${ctx.linkPage('wiki/FAQ')} also includes information about how you can configure your editor.

## ⌛ TL;DR

The most important steps to get the *flowR* development environment set up (after installing **R** and **Node.js**) can be seen below. For convenience, they can be executed all at once using the following command:
${codeBlock('shell', 'npm run setup:dev')}

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
