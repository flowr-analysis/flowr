import { getFilePathMd } from './doc-util/doc-files';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';
import { details } from './doc-util/doc-structure';
import type { LintingResult, LintingRule } from '../linter/linter-format';
import { LintingRuleCertainty } from '../linter/linter-format';
import { Q } from '../search/flowr-search-builder';
import type { MergeableRecord } from '../util/objects';





function defineRule() {
	type MyRuleResult = LintingResult;

	type MyRuleMetadata = MergeableRecord;

	type MyRuleConfig = MergeableRecord;

	const myRule = {
		createSearch:        () => Q.all(),
		processSearchResult: () => ({
			results: [],
			'.meta': {}
		}),
		prettyPrint: {
			query: () => '',
			full:  () => ''
		},
		info: {
			name:          'My Rule',
			description:   'Detects something.',
			tags:          [],
			certainty:     LintingRuleCertainty.BestEffort,
			defaultConfig: {}
		}
	} as const satisfies LintingRule<MyRuleResult, MyRuleMetadata, MyRuleConfig>;

	void myRule;
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

To add a new linting rule, create a dedicated rule file, for example \`my-new-rule.ts\`, next to the existing rule implementations. Existing rules such as ${getFilePathMd('../linter/rules/deprecated-functions.ts')} can be used as references.
Then register the new rule in ${getFilePathMd('../linter/linter-rules.ts')}. This makes it available to ${getFilePathMd('../linter/linter-executor.ts')}, which is responsible for executing linting rules.

## Step 2: Define the types for the rule

For new rules, the central interface is ${ctx.link('LintingRule')}. Its type parameters are documented directly on the interface.

## Step 3: Define the rule itself

A new linting rule must implement the ${ctx.link('LintingRule')} interface. It consists of four main parts:

- ${ctx.link('LintingRule::createSearch')}\
: ${ctx.doc('LintingRule::createSearch')}

- ${ctx.link('LintingRule::processSearchResult')}\
: ${ctx.doc('LintingRule::processSearchResult')}

- ${ctx.link('LintingRule::prettyPrint')}\
: ${ctx.doc('LintingRule::prettyPrint')}

- ${ctx.link('LintingRule::info')}: Static information about the linting rule. The field has type ${ctx.link('LinterRuleInformation')} and contains:

  - ${ctx.link('LinterRuleInformation::name')}: ${ctx.doc('LinterRuleInformation::name')}
  - ${ctx.link('LinterRuleInformation::description')}: ${ctx.doc('LinterRuleInformation::description')}
  - ${ctx.link('LinterRuleInformation::tags')}: ${ctx.doc('LinterRuleInformation::tags')}
  - ${ctx.link('LinterRuleInformation::certainty')}: ${ctx.doc('LinterRuleInformation::certainty')}
  - ${ctx.link('LinterRuleInformation::defaultConfig')}: ${ctx.doc('LinterRuleInformation::defaultConfig')}

The general shape is:

${details('LintingRule interface', ctx.hierarchy('LintingRule'))}

${ctx.code(defineRule, { dropLinesStart: 6, dropLinesEnd: 2 })}


## Step 4: Register the rule

After implementing the rule, register it in ${getFilePathMd('../linter/linter-rules.ts')} by adding it to ${ctx.link('LintingRules')}.


## Step 5: Add the rule to the linter wiki generation

After registering the rule, add a corresponding \`rule\` entry in ${getFilePathMd('./wiki-linter.ts')}. These entries are used to generate the linter overview and the individual wiki pages for linting rules.

## Step 6: Add tests for the rule

New linting rules should be covered by tests following the existing linter test pattern. The test file should be named \`lint-<my-new-rule>.test.ts\`. Existing tests such as ${getFilePathMd('../../test/functionality/linter/lint-deprecated-functions.test.ts')} can be used as references.

The linter wiki automatically extracts additional examples from these tests by reading \`assertLinter\` calls. If a test should not appear as a generated wiki example, add \`/* @ignore-in-wiki */\` to the test.
For general information on creating and regenerating wiki pages, see ${ctx.linkPage('wiki/FAQ')}, especially the FAQ entry on creating new wiki pages. The linter overview and the generated rule documentation can then be inspected through ${ctx.linkPage('wiki/Linter')}. 
`;
	}
}