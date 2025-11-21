import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { FlowrGithubBaseRef, FlowrWikiBaseRef } from './doc-util/doc-files';
import { codeBlock } from './doc-util/doc-code';
import { autoGenHeader } from './doc-util/doc-auto-gen';

function print(): string {
	return `${autoGenHeader({ filename: module.filename, purpose: 'developer onboarding process' })}
	
To get started developing on *flowR*, we recommend carefully reading the following pages:
- 💻 [Setting up the *flowR* development environment](${FlowrWikiBaseRef}/Setup#%EF%B8%8F-building-from-scratch).\
  This page explains how to install **R** and **Node.js**.  
- 💖 [Contributing guidelines](${FlowrGithubBaseRef}/flowr/tree/main/.github/CONTRIBUTING.md).\
  This page also includes information about how to set up **git-lfs** and several **git hooks**.

If you have any questions, please check out the [FAQ](${FlowrWikiBaseRef}/FAQ) first, but if the question
is not answered there (or in the wiki in general), feel free to ask a question.  
	

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

if(require.main === module) {
	setMinLevelOfAllLogs(LogLevel.Fatal);
	console.log(print());
}
