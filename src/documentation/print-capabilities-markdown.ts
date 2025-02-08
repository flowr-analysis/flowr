import type { FlowrCapability } from '../r-bridge/data/types';
import { flowrCapabilities } from '../r-bridge/data/data';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { joinWithLast } from '../util/strings';
import { prefixLines } from './doc-util/doc-general';
import { TreeSitterExecutor } from '../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { KnownParser } from '../r-bridge/parser';
import fs from 'fs';
import type { SerializedTestLabel, TestLabel } from '../../test/functionality/_helper/label';
import { block } from './doc-util/doc-structure';

const detailedInfoFile = 'coverage/flowr-test-details.json';

interface CapabilityInformation {
	readonly parser: KnownParser;
	readonly info:   Map<string, TestLabel[]> | undefined
}


function obtainDetailedInfos(): Map<string, TestLabel[]> | undefined {
	if(!fs.existsSync(detailedInfoFile)) {
		return undefined;
	}
	const content = fs.readFileSync(detailedInfoFile).toString();
	const base = JSON.parse(content) as [string, SerializedTestLabel[]][];
	const out = new Map<string, TestLabel[]>();
	for(const [key, values] of base) {
		out.set(key, values.map(v => ({
			id:           v.id,
			name:         v.name,
			capabilities: new Set(v.capabilities),
			context:      new Set(v.context)
		} satisfies TestLabel)));
	}
	return out;
}

const supportedSymbolMap: Map<string, string> = new Map([
	['not',       '🔴' ],
	['partially', '🔶' ],
	['fully',     '🟩' ]
]);

function getTestDetails(info: CapabilityInformation, capability: FlowrCapability) {
	if(!info.info) {
		return '';
	}
	const totalTests = info.info.get(capability.id);
	const uniqueTests = totalTests?.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
	if(!uniqueTests || uniqueTests.length === 0) {
		return '';
	}
	const grouped = new Map<string, number>();
	for(const { context } of uniqueTests) {
		for(const c of context) {
			grouped.set(c, (grouped.get(c) ?? 0) + 1);
		}
	}
	if(grouped.get('desugar-tree-sitter') !== undefined && grouped.get('desugar-tree-sitter') === grouped.get('desugar-shell')) {
		grouped.set('desugar', grouped.get('desugar-tree-sitter') ?? 0);
		grouped.delete('desugar-shell');
		grouped.delete('desugar-tree-sitter');
	}
	grouped.delete('other'); // opinionated view on the categories
	const output = grouped.get('output');
	grouped.delete('output');
	const testString: string[] = [`${uniqueTests.length} test${uniqueTests.length !== 1 ? 's' : ''}`];
	// sort by count
	const sorted = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
	for(const [context, count] of sorted) {
		testString.push(`${context}: ${count}`);
	}
	if(output) {
		testString.push(`and backed with output: ${output}`);
	}
	return ` (${testString.join(', ')})`;
}

function escapeId(id: string): string {
	return id.replace(/[^a-zA-Z0-9]/g, '_');
}

async function printSingleCapability(info: CapabilityInformation, depth: number, index: number, capability: FlowrCapability): Promise<string> {
	const indent = '    '.repeat(depth);
	const indexStr = index.toString().padStart(2, ' ');
	const nextLineIndent = '  '.repeat(depth + indexStr.length);
	const mainLine = `${indent}${indexStr}. <a id='${capability.id}'></a>**${capability.name}** <a href="#${escapeId(capability.id)}">🔗</a>${getTestDetails(info, capability)}`;
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
		nextLine += `\n${prefixLines(
			typeof capability.example === 'string' ? capability.example : await capability.example(info.parser),
			nextLineIndent + '> ')}`;
	}
	return nextLine ? `${mainLine}\\\n${nextLineIndent}${nextLine}` : mainLine;
}

async function printAsMarkdown(info: CapabilityInformation, capabilities: readonly FlowrCapability[], depth = 0, lines: string[] = []): Promise<string> {
	for(let i = 0; i < capabilities.length; i++) {
		const capability = capabilities[i];
		const result = await printSingleCapability(info, depth, i + 1, capability);
		lines.push(result);
		if(capability.capabilities) {
			await printAsMarkdown(info, capability.capabilities, depth + 1, lines);
		}
	}
	return lines.join('\n');
}

function getPreamble(): string {
	return `${autoGenHeader({ filename: module.filename, purpose: 'current capabilities' })}

Each capability has an id that can be used to link to it (use the link symbol to get a direct link to the capability).
The internal id is also mentioned in the capability description. This id can be used to reference the capability in a labeled test within flowR.
Besides, we use colored bullets like this:

| <!-- -->               | <!-- -->                                              |
| ---------------------- | ----------------------------------------------------- |
| ${supportedSymbolMap.get('fully')} | _flowR_ is capable of handling this feature _fully_     |
| ${supportedSymbolMap.get('partially')} | _flowR_ is capable of handling this feature _partially_ |
| ${supportedSymbolMap.get('not')} | _flowR_ is _not_ capable of handling this feature     |

:cloud: This could be a feature diagram... :cloud:

${block({
		type:    'NOTE',
		content: `
The capabilities are a qualitative measure of the features that flowR can handle.
Statements like "flowR can fully handle 50/80 capabilities" are discouraged as the capabilities may have a vastly different granularity.
Please prefer using a statement like "flowR has only partial support for feature 'XY'" (or simply reference this document) within the flowR sources.
	`
	})}
`;
}

async function print(parser: KnownParser) {
	/* check if the detailed test data is available */
	if(!fs.existsSync(detailedInfoFile)) {
		console.warn('\x1b[31mNo detailed test data available. Run the full tests (npm run test-full) to generate it.\x1b[m');
	}
	return getPreamble() + await printAsMarkdown({ parser, info: obtainDetailedInfos() }, flowrCapabilities.capabilities);
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
