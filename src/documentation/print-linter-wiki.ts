import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { FlowrWikiBaseRef } from './doc-util/doc-files';
import type { LintingRuleNames } from '../linter/linter-rules';
import { LintingRules } from '../linter/linter-rules';
import { codeBlock, codeInline } from './doc-util/doc-code';
import { RShell } from '../r-bridge/shell';
import { showQuery } from './doc-util/doc-query';
import {
	shortLinkFile,
	TypeElementInSource
} from './doc-util/doc-types';
import {
	getDocumentationForType,
	getTypesFromFolder,
	mermaidHide,
	shortLink
} from './doc-util/doc-types';
import path from 'path';
import { documentReplSession } from './doc-util/doc-repl';
import { section } from './doc-util/doc-structure';
import { LintingRuleTag } from '../linter/linter-tags';
import { textWithTooltip } from '../util/html-hover-over';
import { joinWithLast } from '../util/text/strings';
import { guard } from '../util/assert';

const SpecialTagColors: Record<string, string> = {
	[LintingRuleTag.Bug]:      'red',
	[LintingRuleTag.Security]: 'orange',
	[LintingRuleTag.Smell]:    'yellow',
	[LintingRuleTag.QuickFix]: 'lightgray',
};

function makeTagBadge(name: LintingRuleTag, info: TypeElementInSource[]): string {
	const doc = getDocumentationForType('LintingRuleTag::' + name, info, '', true).replaceAll('\n', ' ');
	return textWithTooltip(`<a href='#${name}'>![` + name + '](https://img.shields.io/badge/' + name.toLowerCase() + `-${SpecialTagColors[name] ?? 'teal'}) </a>`, doc);
}

function registerRules(shell: RShell, tagTypes: TypeElementInSource[]) {
	const ruleExplanations = new Map<LintingRuleNames, () => Promise<string>>();

	rule(shell,
		'deprecated-functions', 'DeprecatedFunctionsConfig', 'DEPRECATED_FUNCTIONS',
		`
first <- data.frame(x = c(1, 2, 3), y = c(1, 2, 3))
second <- data.frame(x = c(1, 3, 2), y = c(1, 3, 2))
dplyr::all_equal(first, second)
`, tagTypes);

	rule(shell,
		'file-path-validity', 'FilePathValidityConfig', 'FILE_PATH_VALIDITY',
		`
my_data <- read.csv("C:/Users/me/Documents/My R Scripts/Reproducible.csv")
`, tagTypes);

	rule(shell,
		'absolute-file-paths', 'AbsoluteFilePathConfig', 'ABSOLUTE_PATH',
		`
read.csv("C:/Users/me/Documents/My R Scripts/Reproducible.csv")
`, tagTypes);

	rule(shell,
		'unused-definitions', 'UnusedDefinitionConfig', 'UNUSED_DEFINITION',
		`
x <- 42
y <- 3
print(x)
`, tagTypes);


	function rule(shell: RShell, name: LintingRuleNames, configType: string, ruleType: string, example: string, types: TypeElementInSource[]) {
		const rule = LintingRules[name];
		ruleExplanations.set(name, async() => `
${section(`${rule.info.name} (${codeInline(name)})`, 3, name)}

${rule.info.tags.toSorted((a, b) => {
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
}).map(t => makeTagBadge(t, types)).join(' ')}\\
${rule.info.description}\\
_Implemented in ${shortLinkFile(ruleType, types)}_
 
<details>

#### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below. The \`${name}\` rule accepts the following configuration options:

${
	Object.getOwnPropertyNames(LintingRules[name].info.defaultConfig).sort().map(key =>
		`- ${shortLink(`${configType}:::${key}`, types)}\\\n${getDocumentationForType(`${configType}::${key}`, types)}`
	).join('\n')
}

#### Example

${codeBlock('r', example)}

The linting query can be used to run this rule on the above example:

${await showQuery(shell, example, [{ type: 'linter', rules: [{ name, config: {} as never }] }], { collapseQuery: true })}

</details>
	`.trim());
	}

	return ruleExplanations;
}

function getAllLintingRulesWitTag(tag: LintingRuleTag): LintingRuleNames[] {
	return Object.entries(LintingRules).filter(([_, rule]) => (rule.info.tags as readonly LintingRuleTag[]).includes(tag)).map(([name]) => name as LintingRuleNames);
}

function linkToRule(name: LintingRuleNames): string {
	return `[${name}](#${name})`;
}


async function getText(shell: RShell): Promise<string> {
	const rVersion = (await shell.usedRVersion())?.format() ?? 'unknown';
	const tagTypes = getTypesFromFolder({
		rootFolder:  path.resolve('./src/linter/'),
		inlineTypes: mermaidHide
	});

	const rules = registerRules(shell, tagTypes.info);

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

${section('Tags', 2, 'tags')}

We use tags to categorize linting rules. The following tags are available:

| Tag/Badge&emsp;&emsp; | Description |
| --- | :-- |
${Object.entries(LintingRuleTag).map(([name, tag]) => {
	return `| <a id="${tag}"></a> ${makeTagBadge(tag as LintingRuleTag, tagTypes.info)} | ${getDocumentationForType('LintingRuleTag::' + name, tagTypes.info).replaceAll(/\n/g, ' ')} (rule${getAllLintingRulesWitTag(tag).length === 1 ? '' : 's'}: ${
		joinWithLast(getAllLintingRulesWitTag(tag).map(l => linkToRule(l))) || '_none_'
	}) | `;
}).join('\n')}
	
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
    `.trim();
}

if(require.main === module) {
	setMinLevelOfAllLogs(LogLevel.Fatal);
	const shell = new RShell();
	void getText(shell).then(str => {
		console.log(str);
	}).finally(() => {
		shell.close();
	});
}
