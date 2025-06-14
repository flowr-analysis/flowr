import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { FlowrWikiBaseRef } from './doc-util/doc-files';
import type { LintingRuleNames } from '../linter/linter-rules';
import { LintingRules } from '../linter/linter-rules';
import { codeBlock } from './doc-util/doc-code';
import { RShell } from '../r-bridge/shell';
import { showQuery } from './doc-util/doc-query';
import { getDocumentationForType, getTypesFromFolderAsMermaid, mermaidHide, shortLink } from './doc-util/doc-types';
import path from 'path';

async function getText(shell: RShell): Promise<string> {
	const rVersion = (await shell.usedRVersion())?.format() ?? 'unknown';
	return `${autoGenHeader({ filename: module.filename, purpose: 'linter', rVersion })}

This page describes the flowR linter, which is a tool that utilizes flowR's dataflow analysis to find common issues in R scripts. The linter can currently be used through the linter [query](${FlowrWikiBaseRef}/Query%20API).

## Linting Rules

The following linting rules are available:

${await rule(shell,
	'deprecated-functions', 'DeprecatedFunctionsConfig',
	'Deprecated Functions', 
	'This rule detects the usage of deprecated functions in code based on a predefined list of known deprecated functions.', `
first <- data.frame(x = c(1, 2, 3), y = c(1, 2, 3))
second <- data.frame(x = c(1, 3, 2), y = c(1, 3, 2))
dplyr::all_equal(first, second)
`)}

${await rule(shell,
	'file-path-validity', 'FilePathValidityConfig',
	'File Path Validity', 
	'This rule finds places in the code where files are being read from. In such places, it checks whether the file path is valid and whether the file exists on disk.', `
my_data <- read.csv("C:/Users/me/Documents/My R Scripts/Reproducible.csv")
`)}

    `.trim();
}

async function rule(shell: RShell, name: LintingRuleNames, configType: string, friendlyName: string, description: string, example: string){
	const types = getTypesFromFolderAsMermaid({
		rootFolder:  path.resolve('./src/linter/'),
		typeName:    configType,
		inlineTypes: mermaidHide
	});
	return `
### ${friendlyName} (\`${name}\`)
	
${description}

<details>

#### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below. The \`${name}\` rule accepts the following configuration options:

${
	Object.getOwnPropertyNames(LintingRules[name].defaultConfig).sort().map(key => 
		`- ${shortLink(`${configType}:::${key}`, types.info)}\\\n${getDocumentationForType(`${configType}::${key}`, types.info)}`
	).join('\n')
}

#### Example

${codeBlock('r', example)}

The linting query can be used to run this rule on the above example:

${await showQuery(shell, example, [{ type: 'linter', rules: [{ name, config: {} as never }] }], { collapseQuery: true })}

</details>
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
