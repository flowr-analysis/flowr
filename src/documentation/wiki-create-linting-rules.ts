import { codeBlock } from './doc-util/doc-code';
import { RemoteFlowrFilePathBaseRef, getFilePathMd } from './doc-util/doc-files';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';
import {details} from "./doc-util/doc-structure";

export class WikiCreateLintingRules extends DocMaker<'wiki/Create Linting Rules.md'> {
	constructor() {
		super('wiki/Create Linting Rules.md', module.filename, 'creating linting rules');
	}

	protected text({ ctx }: DocMakerArgs): string {
		return `
# Create Linting Rules

This page explains how to add a new linting rule to flowR. 

## Step 1: Create the new rule file

To add a new linting rule, create a separate file for it under [\`src/linter/rules/\`](${RemoteFlowrFilePathBaseRef}/src/linter/rules/)
Then register the new rule in ${getFilePathMd('../linter/linter-rules.ts')}. This makes it available to ${getFilePathMd('../linter/linter-executor.ts')}, which is responsible for executing linting rules.

## Step 2: Define the types for the rule

For new rules, the central interface is ${ctx.link('LintingRule')}. The relevant type parameters are:

${codeBlock('typescript', 'LintingRule<Result, Metadata, Config>')}

| Type | Meaning |
|---|---|
| \`Result\` | The type of one individual linting finding. Based on ${ctx.link('LintingResult')}. |
| \`Metadata\` | Additional information about the complete execution of the rule. |
| \`Config\` | Allows configurable options of the rule. |

## Step 3: Define the rule itself

A new linting rule must implement the ${ctx.link('LintingRule')} interface. It consists of four main parts:

| Part | Purpose |
|---|---|
| ${ctx.link('LintingRule::createSearch')} | Creates a flowR search query that selects potentially relevant program elements. |
| ${ctx.link('LintingRule::processSearchResult')}  | Turns the search results into linting results. This is where the actual linting rule logic is implemented. |
| ${ctx.link('LintingRule::prettyPrint')} | Defines how linting results are rendered in different output contexts. |
| ${ctx.link('LintingRule::info')} | Provides metadata such as the rule name, description, tags, certainty, and default configuration. |

The general shape is:

${details('LintingRule interface', ctx.hierarchy('LintingRule'))}

${codeBlock('typescript', `export const MY_RULE = {
	createSearch: (config) => {
		// returns a flowR search query
	},
	processSearchResult: (elements, config, data) => {
		// returns linting results and execution metadata:
		// { results: [...], '.meta': {...} }
	},
	prettyPrint: {
		// output formatting
	},
	info: {
		// rule metadata and default config
	}
} as const satisfies LintingRule<MyRuleResult, MyRuleMetadata, MyRuleConfig>;`)}


## Step 4: Register the rule

After implementing the rule, register it in ${getFilePathMd('../linter/linter-rules.ts')} by adding it to ${ctx.link('LintingRules')}.

## Step 5: Add tests for the rule

New rules should be covered by tests in [\`src/test/functionality/linter/\`](${RemoteFlowrFilePathBaseRef}/test/functionality/linter/).
`;
	}
}