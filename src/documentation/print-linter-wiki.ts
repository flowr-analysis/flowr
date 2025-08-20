import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { FlowrWikiBaseRef, linkFlowRSourceFile } from './doc-util/doc-files';
import type { LintingRuleNames } from '../linter/linter-rules';
import { LintingRules } from '../linter/linter-rules';
import { codeBlock } from './doc-util/doc-code';
import { RShell } from '../r-bridge/shell';
import { showQuery } from './doc-util/doc-query';
import type { TypeElementInSource, TypeReport } from './doc-util/doc-types';
import { getDocumentationForType, getTypePathLink, getTypesFromFolder, mermaidHide, shortLink, shortLinkFile } from './doc-util/doc-types';
import path from 'path';
import { documentReplSession } from './doc-util/doc-repl';
import { section } from './doc-util/doc-structure';
import { LintingRuleTag } from '../linter/linter-tags';
import { textWithTooltip } from '../util/html-hover-over';
import { joinWithLast } from '../util/text/strings';
import { guard } from '../util/assert';
import { writeWikiTo } from './doc-util/doc-print';
import { getFunctionsFromFolder } from './doc-util/doc-functions';
import { LintingResultCertainty, LintingRuleCertainty } from '../linter/linter-format';

const SpecialTagColors: Record<string, string> = {
	[LintingRuleTag.Bug]:      'red',
	[LintingRuleTag.Security]: 'orange',
	[LintingRuleTag.Smell]:    'yellow',
	[LintingRuleTag.QuickFix]: 'lightgray'
};

function makeTagBadge(name: LintingRuleTag, info: TypeElementInSource[]): string {
	const doc = getDocumentationForType('LintingRuleTag::' + name, info, '', true).replaceAll('\n', ' ');
	return textWithTooltip(`<a href='#${name}'>![` + name + '](https://img.shields.io/badge/' + name.toLowerCase() + `-${SpecialTagColors[name] ?? 'teal'}) </a>`, doc);
}


function prettyPrintExpectedOutput(expected: string): string {
	if(expected.trim() === '[]') {
		return '* no lints';
	}
	let lines = expected.trim().split('\n');
	if(lines.length <= 1) {
		return expected;
	}

	//
	lines = expected.trim().replace(/^\s*\[+\s*{*/m, '').replace(/\s*}*\s*]+\s*$/, '').split('\n').filter(l => l.trim() !== '');
	/* take the indentation of the last line and remove it from all but the first: */
	const indentation = lines[lines.length - 1].match(/^\s*/)?.[0] ?? '';
	return lines.map((line, i) => {
		if(i === 0) {
			return line;
		}
		return line.replace(new RegExp('^' + indentation, 'g'), '');
	}).join('\n');
}

function buildSamplesFromLinterTestCases(shell: RShell, testFile: string): string {
	const reports = getFunctionsFromFolder({ files: [path.resolve('test/functionality/linter/' + testFile)], fname: /assertLinter/ });
	if(reports.info.length === 0) {
		return '';
	}
	let result = `#### Additional Examples
	
These examples are synthesized from the test cases in: ${linkFlowRSourceFile('test/functionality/linter/' + testFile)}\n\n`;

	for(const report of reports.info) {
		const args = report.arguments;
		if(args.length < 5) {
			console.error('Test case for linter rule ' + report.name + ' does not have enough arguments! Expected at least 5, got ' + args.length);
			continue;
		}
		const testName = args[0].getText(report.source);
		if(report.comments?.some(c => c.includes('@ignore-in-wiki'))) {
			console.warn(`Skipping test case for linter rule ${testName} (${testFile}) as it is marked with @ignore-in-wiki`);
			continue;
		}
		// drop any quotes around the test name
		const testNameClean = testName.replace(/^['"]|['"]$/g, '');
		result += `\n${section('Test Case: ' + testNameClean, 4)}

${report.comments ? report.comments.map(c => `> ${c}`).join('\n') + '\n' : ''}
Given the following input:
${codeBlock('r', args[2].getText(report.source).replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n'))}
${args.length >= 7 ? `\nAnd using the following [configuration](#configuration): ${codeBlock('ts', prettyPrintExpectedOutput(args[6].getText(report.source)))}` : ''}

We expect the linter to report the following:
${codeBlock('ts', prettyPrintExpectedOutput(args[4].getText(report.source)))}

See [here](${getTypePathLink({ filePath: report.source.fileName, lineNumber: report.lineNumber })}) for the test-case implementation.
		`;
	}

	return result;
}

function registerRules(rVersion: string, shell: RShell, tagTypes: TypeElementInSource[], format: 'short' | 'long' = 'short') {
	const ruleExplanations = new Map<LintingRuleNames, () => Promise<string>>();

	rule(shell,
		'deprecated-functions', 'DeprecatedFunctionsConfig', 'DEPRECATED_FUNCTIONS', 'lint-deprecated-functions',
		`
first <- data.frame(x = c(1, 2, 3), y = c(1, 2, 3))
second <- data.frame(x = c(1, 3, 2), y = c(1, 3, 2))
dplyr::all_equal(first, second)
`, tagTypes);

	rule(shell,
		'file-path-validity', 'FilePathValidityConfig', 'FILE_PATH_VALIDITY', 'lint-file-path-validity',
		`
my_data <- read.csv("C:/Users/me/Documents/My R Scripts/Reproducible.csv")
`, tagTypes);

	rule(shell,
		'absolute-file-paths', 'AbsoluteFilePathConfig', 'ABSOLUTE_PATH', 'lint-absolute-path',
		`
read.csv("C:/Users/me/Documents/My R Scripts/Reproducible.csv")
`, tagTypes);

	rule(shell,
		'unused-definitions', 'UnusedDefinitionConfig', 'UNUSED_DEFINITION', 'lint-unused-definition',
		`
x <- 42
y <- 3
print(x)
`, tagTypes);
	rule(shell,
		'seeded-randomness', 'SeededRandomnessConfig', 'SEEDED_RANDOMNESS', 'lint-seeded-randomness',
		'runif(1)',
		tagTypes);

	rule(shell, 
		'naming-convention', 'NamingConventionConfig', 'NAMING_CONVENTION', 'lint-naming-convention',
		`
myVar <- 42
print(myVar)
`, tagTypes);

	rule(shell,
		'dataframe-access-validation', 'DataFrameAccessValidationConfig', 'DATA_FRAME_ACCESS_VALIDATION', 'lint-dataframe-access-validation',
		`
df <- data.frame(id = 1:5, name = 6:10)
df[6, "value"]
`, tagTypes);

	rule(shell,
		'dead-code', 'DeadCodeConfig', 'DEAD_CODE', 'lint-dead-code',
		'if(TRUE) 1 else 2', tagTypes);

	rule(shell,
		'useless-loop', 'UselessLoopConfig', 'USELESS_LOOP', 'lint-useless-loop',
		'for(i in c(1)) { print(i) }', tagTypes);

	function rule(shell: RShell, name: LintingRuleNames, configType: string, ruleType: string, testfile: string, example: string, types: TypeElementInSource[]) {
		const rule = LintingRules[name];

		const tags = rule.info.tags.toSorted((a, b) => {
			// sort but specials first
			if(a === b) {
				return 0;
			}
			if(SpecialTagColors[a] && SpecialTagColors[b]) {
				return SpecialTagColors[b].localeCompare(SpecialTagColors[a]);
			} else if(SpecialTagColors[a]) {
				return -1;
			} else if(SpecialTagColors[b]) {
				return 1;
			}
			return a.localeCompare(b);
		}).map(t => makeTagBadge(t, types)).join(' ');

		const certaintyDoc = getDocumentationForType(`LintingRuleCertainty::${rule.info.certainty}`, types, '', true).replaceAll('\n', ' ');
		const certaintyText = `\`${textWithTooltip(rule.info.certainty, certaintyDoc)}\``;
		if(format === 'short') {
			ruleExplanations.set(name, () => Promise.resolve(`
	**[${rule.info.name}](${FlowrWikiBaseRef}/lint-${name}):** ${rule.info.description} [see ${shortLinkFile(ruleType, types)}]\\
	${tags}

		`.trim()));
		} else {
			ruleExplanations.set(name, async() => `

${autoGenHeader({ filename: module.filename, purpose: 'linter', rVersion })}
${section(rule.info.name + `&emsp;<sup>[<a href="${FlowrWikiBaseRef}/Linter">overview</a>]</sup>`, 2, name)}

${tags}


This rule is a ${certaintyText} rule.
 
${rule.info.description}\\
_This linting rule is implemented in ${shortLinkFile(ruleType, types)}._


### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The \`${name}\` rule accepts the following configuration options:

${
	Object.getOwnPropertyNames(LintingRules[name].info.defaultConfig).sort().map(key =>
		`- ${shortLink(`${configType}:::${key}`, types)}\\\n${getDocumentationForType(`${configType}::${key}`, types)}`
	).join('\n')
}

### Examples

${codeBlock('r', example)}

The linting query can be used to run this rule on the above example:

${await showQuery(shell, example, [{ type: 'linter', rules: [{ name, config: {} as never }] }], { collapseQuery: true })}

${buildSamplesFromLinterTestCases(shell, `${testfile}.test.ts`)}

		`.trim());
		}
	}

	return ruleExplanations;
}

function getAllLintingRulesWithTag(tag: LintingRuleTag): LintingRuleNames[] {
	return Object.entries(LintingRules).filter(([_, rule]) => (rule.info.tags as readonly LintingRuleTag[]).includes(tag)).map(([name]) => name as LintingRuleNames);
}

function getAllLintingRulesWitCertainty(certainty: LintingRuleCertainty): LintingRuleNames[] {
	return Object.entries(LintingRules).filter(([_, rule]) => rule.info.certainty === certainty).map(([name]) => name as LintingRuleNames);
}

function linkToRule(name: LintingRuleNames): string {
	return `[${name}](${FlowrWikiBaseRef}/lint-${name})`;
}


async function getTextMainPage(shell: RShell, tagTypes: TypeReport, rVersion: string): Promise<string> {
	const rules = registerRules(rVersion, shell, tagTypes.info);

	return `${autoGenHeader({ filename: module.filename, purpose: 'linter', rVersion })}

This page describes the flowR linter, which is a tool that utilizes flowR's dataflow analysis to find common issues in R scripts. The linter can currently be used through the linter [query](${FlowrWikiBaseRef}/Query%20API).
For example:

${await(async() => {
	const code = 'read.csv("/root/x.txt")';
	const res = await showQuery(shell, code, [{ type: 'linter' }], { showCode: false, collapseQuery: true, collapseResult: false });
	return await documentReplSession(shell, [{
		command:     `:query @linter ${JSON.stringify(code)}`,
		description: `
The linter will analyze the code and return any issues found.
Formatted more nicely, this returns:

${res}
		`
	}]
	);
})()}

${section('Linting Rules', 2, 'linting-rules')}

The following linting rules are available:

${await(async() => {
		let result = '';
		for(const k of Object.keys(LintingRules).sort()) {
			const rule = rules.get(k as LintingRuleNames);
			guard(rule !== undefined, `Linting rule ${k} is not documented!`);
			result += '\n\n' + await rule();
		}
		return result;
	})()
}
	
${section('Tags', 2, 'tags')}

We use tags to categorize linting rules for users. The following tags are available:

| Tag/Badge&emsp;&emsp; | Description |
| --- | :-- |
${Object.entries(LintingRuleTag).map(([name, tag]) => {
	return `| <a id="${tag}"></a> ${(makeTagBadge(tag as LintingRuleTag, tagTypes.info))} | ${getDocumentationForType('LintingRuleTag::' + name, tagTypes.info).replaceAll(/\n/g, ' ')} (rule${getAllLintingRulesWithTag(tag).length === 1 ? '' : 's'}: ${
		joinWithLast(getAllLintingRulesWithTag(tag).map(l => linkToRule(l))) || '_none_'
	}) | `;
}).join('\n')}

${section('Certainty', 2, 'certainty')}

Both linting rules and their individual results are additionally categorized by how certain the linter is that the results it is returning are valid.

${section('Rule Certainty', 3, 'rule-certainty')}

| Rule Certainty | Description |
| -------------- | :---------- |
${Object.entries(LintingRuleCertainty).map(([name, certainty]) => {
	return `| <a id="${certainty}"></a> \`${certainty}\` | ${getDocumentationForType('LintingRuleCertainty::' + name, tagTypes.info).replaceAll(/\n/g, ' ')} (rule${getAllLintingRulesWitCertainty(certainty).length === 1 ? '' : 's'}: ${
		joinWithLast(getAllLintingRulesWitCertainty(certainty).map(l => linkToRule(l))) || '_none_'
	}) |`;
}).join('\n')}
	
${section('Result Certainty', 3, 'result-certainty')}

| Result Certainty | Description |
| ---------------- | :---------- |
${Object.entries(LintingResultCertainty).map(([name, certainty]) =>
	`| <a id="${certainty}"></a> \`${certainty}\` | ${getDocumentationForType('LintingResultCertainty::' + name, tagTypes.info).replaceAll(/\n/g, ' ')} |`).join('\n')}

`.trim();
}

async function getRulesPages(shell: RShell, tagTypes: TypeReport, rVersion: string): Promise<Record<string, string>> {
	const rules = registerRules(rVersion, shell, tagTypes.info, 'long');
	const result: Record<string, string> = {} as Record<string, string>;

	for(const [name, rule] of rules) {
		const filepath = path.resolve('./wiki', `lint-${name}.md`);
		result[filepath] = await rule();
	}

	return result;
}

/** Maps file-names to their content, the 'main' file is named 'main' */
async function getTexts(shell: RShell): Promise<Record<string, string> & { main: string }> {
	const rVersion = (await shell.usedRVersion())?.format() ?? 'unknown';
	const tagTypes = getTypesFromFolder({
		rootFolder:  path.resolve('./src/linter/'),
		inlineTypes: mermaidHide
	});

	return {
		'main': await getTextMainPage(shell, tagTypes, rVersion),
		...await getRulesPages(shell, tagTypes, rVersion)
	};
}

/* As an intermediary solution to changing the wiki system, we make this script generate separate files for each linter rule using fixed paths */
if(require.main === module) {
	setMinLevelOfAllLogs(LogLevel.Fatal);
	const shell = new RShell();
	void (getTexts(shell).then(data => {
		console.log(data['main']);
		for(const [file, content] of Object.entries(data)) {
			if(file === 'main') {
				continue; // main is printed above
			}
			const filepath = path.resolve('./wiki', file);
			writeWikiTo(content, filepath);
		}
	}).finally(() => {
		shell.close();
	}));
}
