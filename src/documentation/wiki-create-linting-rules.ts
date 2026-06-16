import { FlowrGithubRef } from './doc-util/doc-files';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';
import type { GeneralDocContext } from './wiki-mk/doc-context';
import type { LintingResult, LintingRule } from '../linter/linter-format';
import { LintingRuleCertainty } from '../linter/linter-format';
import { Q } from '../search/flowr-search-builder';
import type { MergeableRecord } from '../util/objects';
import { DEPRECATED_FUNCTIONS } from '../linter/rules/deprecated-functions';

function lintingRuleFields(ctx: GeneralDocContext): string {
	return Object.keys(DEPRECATED_FUNCTIONS).map(field => {
		return `- ${ctx.link(`LintingRule::${field}`)} ${ctx.doc(`LintingRule::${field}`)}`;
	}).join('\n');
}

function lintingRuleInfoFields(ctx: GeneralDocContext): string {
	return Object.keys(DEPRECATED_FUNCTIONS.info).map(field => {
		return `  - ${ctx.link(`LinterRuleInformation::${field}`)} ${ctx.doc(`LinterRuleInformation::${field}`)}`;
	}).join('\n');
}

function defineRule() {
	type MyRuleResult = LintingResult;

	type MyRuleMetadata = MergeableRecord;

	type MyRuleConfig = MergeableRecord;

	// eslint-disable-next-line @typescript-eslint/naming-convention
	const MY_NEW_RULE = {
		createSearch: (_config) => Q.all(),

		processSearchResult: (_elements, _config, _data) => ({
			results: [],
			'.meta': {}
		}),

		prettyPrint: {
			query: (_result, _metadata) => 'my-rule finding',
			full:  (_result, _metadata) => 'My Rule reported a finding that should be reviewed.'
		},

		info: {
			name:          'My Rule',
			description:   'Detects something.',
			tags:          [],
			certainty:     LintingRuleCertainty.BestEffort,
			defaultConfig: {}
		}
	} as const satisfies LintingRule<MyRuleResult, MyRuleMetadata, MyRuleConfig>;

	void MY_NEW_RULE;
}

export class WikiCreateLintingRules extends DocMaker<'wiki/Create Linting Rules.md'> {
	constructor() {
		super('wiki/Create Linting Rules.md', module.filename, 'creating linting rules');
	}

	protected text({ ctx }: DocMakerArgs): string {
		return `
# Create Linting Rules

This page explains how to add a new linting rule to flowR. For an overview of the linter and the existing linting rules, see ${ctx.linkPage('wiki/Linter')}.

## Step 1: Create the new rule file

To add a new linting rule, create a dedicated rule file next to the existing rule implementations. The file name should correspond to the exported linting rule object, for example \`my-new-rule.ts\` for a rule object named \`MY_NEW_RULE\`.
Existing rules such as ${ctx.link('DEPRECATED_FUNCTIONS')} can be used as references.
Before implementing a new linting rule, open a corresponding [linting rule issue](${FlowrGithubRef}/issues/new?template=linting-rule.yaml) using the accompanying issue template.

## Step 2: Define the types for the rule

For new rules, the central interface is ${ctx.link('LintingRule')}. Its type parameters are documented directly as part of the interface.

## Step 3: Define the rule itself

A new linting rule must implement the ${ctx.link('LintingRule')} interface. It consists of the following main parts:

${lintingRuleFields(ctx)}

The ${ctx.link('LintingRule::info')} field has type ${ctx.link('LinterRuleInformation')} and contains:

${lintingRuleInfoFields(ctx)}

The following example shows the basic structure of a linting rule:

${ctx.code(defineRule, { dropLinesStart: 8, dropLinesEnd: 2 })}


## Step 4: Register the rule

After implementing the rule, register it by adding it to ${ctx.link('LintingRules')}.


## Step 5: Add the rule to the linter wiki generation

After registering the rule, add a corresponding \`rule\` entry to the linter wiki generation in ${ctx.link('WikiLinter')}. These entries are used to generate the linter overview and the individual wiki pages for linting rules, which can then be inspected through ${ctx.linkPage('wiki/Linter')}.

## Step 6: Add tests for the rule

New linting rules should be covered by tests following the existing linter test pattern. The test file should be named \`lint-<my-new-rule>.test.ts\`. Existing linter tests can be used as references for the expected structure.

The linter wiki automatically extracts additional examples from these tests by reading \`assertLinter\` calls. If a test should not appear as a generated wiki example, add \`/* @ignore-in-wiki */\` to the test.
For general information on creating and regenerating wiki pages, see ${ctx.linkPage('wiki/FAQ')}, especially the FAQ entry on creating new wiki pages. The linter overview and the generated rule documentation can then be inspected through ${ctx.linkPage('wiki/Linter')}. 
`;
	}
}