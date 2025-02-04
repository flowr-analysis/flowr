import type { FlowrCapability } from '../r-bridge/data/types';
import { flowrCapabilities } from '../r-bridge/data/data';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { joinWithLast } from '../util/strings';
import { block } from './doc-util/doc-structure';
import { prefixLines } from './doc-util/doc-general';
import { TreeSitterExecutor } from '../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { KnownParser } from '../r-bridge/parser';

const supportedSymbolMap: Map<string, string> = new Map([
	['not',       '🔴' ],
	['partially', '🔶' ],
	['fully',     '🟩' ]
]);

async function printSingleCapability(parser: KnownParser, depth: number, index: number, capability: FlowrCapability): Promise<string> {
	const indent = '    '.repeat(depth);
	const indexStr = index.toString().padStart(2, ' ');
	const nextLineIndent = '  '.repeat(depth + indexStr.length);
	const mainLine = `${indent}${indexStr}. <a id='${capability.id}'></a>**${capability.name}** <a href="#${capability.id}">🔗</a>`;
	let nextLine = '';

	if(capability.supported) {
		nextLine += `${supportedSymbolMap.get(capability.supported)} `;
	}
	if(capability.description) {
		nextLine += capability.description;
	}
	if(capability.url) {
		nextLine += '\\\nSee ' + joinWithLast(capability.url.map(({ name, href }) => `[${name}](${href})`)) + ' for more info.';
	}
	nextLine += ' Internal ID: `' + capability.id + '`';
	if(capability.example) {
		nextLine += `\n${nextLineIndent}${prefixLines(block({ type: 'INFO', content: typeof capability.example === 'string' ? capability.example : await capability.example(parser) }), nextLineIndent)}`;
	}
	return nextLine ? `${mainLine}\\\n${nextLineIndent}${nextLine}` : mainLine;
}

async function printAsMarkdown(parser: KnownParser, capabilities: readonly FlowrCapability[], depth = 0, lines: string[] = []): Promise<string> {
	for(let i = 0; i < capabilities.length; i++) {
		const capability = capabilities[i];
		const result = await printSingleCapability(parser, depth, i + 1, capability);
		lines.push(result);
		if(capability.capabilities) {
			await printAsMarkdown(parser, capability.capabilities, depth + 1, lines);
		}
	}
	return lines.join('\n');
}

function getPreamble(): string {
	return `${autoGenHeader({ filename: module.filename, purpose: 'current capabilities' })}

The code-font behind each capability name is a link to the capability's id. This id can be used to reference the capability in a labeled test within flowR.
Besides, we use colored bullets like this:

| <!-- -->               | <!-- -->                                              |
| ---------------------- | ----------------------------------------------------- |
| ${supportedSymbolMap.get('fully')} | _flowR_ is capable of handling this feature _fully_     |
| ${supportedSymbolMap.get('partially')} | _flowR_ is capable of handling this feature _partially_ |
| ${supportedSymbolMap.get('not')} | _flowR_ is _not_ capable of handling this feature     |

:cloud: This could be a feature diagram... :cloud:

`;
}

async function print(parser: KnownParser) {
	return getPreamble() + await printAsMarkdown(parser, flowrCapabilities.capabilities);
}

/** if we run this script, we want a Markdown representation of the capabilities */
if(require.main === module) {
	setMinLevelOfAllLogs(LogLevel.Fatal);
	void TreeSitterExecutor.initTreeSitter().then(() => {
		const parser = new TreeSitterExecutor();
		void print(parser).then(str => {
			console.log(str);
		});
	});
}
