import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { getDocumentationForType, getTypesFromFolder } from './doc-util/doc-types';
import path from 'path';
import { LintingRuleTag } from '../linter/linter-tags';
import { prefixLines } from './doc-util/doc-general';
import { FlowrWikiBaseRef } from './doc-util/doc-files';
import type { LintingRuleNames } from '../linter/linter-rules';
import { LintingRules } from '../linter/linter-rules';

/* this prints the yaml configuration for the GitHub issue template to request a new linter rule / an update */

function summarizeIfTooLong(text: string, maxLength = 52): string {
	if(text.length <= maxLength) {
		return text;
	}
	return text.slice(0, maxLength - 1) + '…';
}


function getText() {
	const types = getTypesFromFolder({
		rootFolder: path.resolve('./src/linter/')
	});

	return `
name: Linting Rule
description: Suggest either a new linting rule or an improvement to an existing one. 
title: "[Linter]: "
labels: ["flowr linter"]
body:
  - type: markdown
    attributes:
      value: |
        Thank you for suggesting a new linting rule or an improvement to an existing one. Please provide as much detail as possible to help us understand your request. See the [Linter Wiki Page](${FlowrWikiBaseRef}/Linter) for more information.
  - type: textarea
    id: description
    attributes:
      label: Description
      description: |
        Please provide a detailed description of the linting rule you are suggesting or the improvement you would like to see. Include examples if possible.
    validations:
      required: true
  - type: dropdown
    id: linting-rule
    attributes:
      label: Linting Rule
      description: |
        Select the linting rule that you are suggesting or improving. If it is a new rule, select "New Rule".
      options:
        - New Rule
${prefixLines(Object.keys(LintingRules).sort().map(name => {
	const rule = LintingRules[name as LintingRuleNames];
	return `- ${rule.info.name}`;
}).join('\n'), '        ')}
      default: 0
  - type: checkboxes
    id: tags
    attributes:
      label: Meta Information
      description: Select any tags that you think apply to the linting rule you are suggesting. If you try to suggest a new linting rule, please only select those that you think apply after your suggestions.
      options:
${prefixLines(Object.entries(LintingRuleTag).map(([name]) => {
	return `- label: '**${name}**: ${summarizeIfTooLong(getDocumentationForType('LintingRuleTag::' + name, types.info).replaceAll(/\n/g, ' ').replaceAll('\'', '\\\'').trim())}'\n  required: false`;
}).join('\n'), '        ')}
`.trim();
}

/** if we run this script, we want a Markdown representation of the capabilities */
if(require.main === module) {
	setMinLevelOfAllLogs(LogLevel.Fatal);
	console.log(getText());
}
