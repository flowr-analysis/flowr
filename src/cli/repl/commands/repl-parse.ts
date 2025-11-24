import type { ReplCodeCommand } from './repl-main';
import { type OutputFormatter , FontStyles } from '../../../util/text/ansi';
import { type JsonEntry , convertPreparedParsedData, prepareParsedData } from '../../../r-bridge/lang-4.x/ast/parser/json/format';
import { extractLocation, getTokenType, } from '../../../r-bridge/lang-4.x/ast/parser/main/normalize-meta';
import { fileProtocol, removeRQuotes } from '../../../r-bridge/retriever';
import type Parser from 'web-tree-sitter';
import type { ParseStepOutputSingleFile } from '../../../r-bridge/parser';
import { FlowrFile } from '../../../project/context/flowr-file';

type DepthList =  { depth: number, node: JsonEntry, leaf: boolean }[]

function toDepthMap(entry: JsonEntry): DepthList {
	const visit: { depth: number, node: JsonEntry }[] = [ { depth: 0, node: entry } ];
	const result: DepthList = [];

	while(visit.length > 0) {
		const current = visit.pop();
		if(current === undefined) {
			continue;
		}

		const children = current.node.children;

		result.push({ ...current, leaf: children.length === 0 });
		children.reverse();

		const nextDepth = current.depth + 1;

		for(const c of children) {
			visit.push({ depth: nextDepth, node: c });
		}
	}
	return result;
}

function treeSitterToJsonEntry(node: Parser.SyntaxNode): JsonEntry {
	return {
		token:    node.type,
		children: [],
		text:     node.text,
		id:       node.id,
		parent:   node.parent?.id ?? -1,
		terminal: node.isNamed,
		line1:    node.startPosition.row + 1,
		col1:     node.startPosition.column + 1,
		line2:    node.endPosition.row + 1,
		col2:     node.endPosition.column + 1
	};
}

function treeSitterToDepthList(node: Parser.SyntaxNode): DepthList {
	const visit: { depth: number, node: Parser.SyntaxNode }[] = [ { depth: 0, node } ];
	const result: DepthList = [];

	while(visit.length > 0) {
		const current = visit.pop();
		if(current === undefined) {
			continue;
		}

		const children = current.node.children;

		result.push({ depth: current.depth, node: treeSitterToJsonEntry(current.node), leaf: children.length === 0 });

		children.reverse();

		const nextDepth = current.depth + 1;

		for(const c of children) {
			visit.push({ depth: nextDepth, node: c });
		}
	}
	return result;
}

function lastElementInNesting(i: number, list: Readonly<DepthList>, depth: number): boolean {
	for(let j = i + 1; j < list.length; j++) {
		if(list[j].depth < depth) {
			return true;
		}
		if(list[j].depth === depth) {
			return false;
		}
	}
	// only more deeply nested come after
	return true;
}


function initialIndentation(i: number, depth: number, deadDepths: Set<number>, nextDepth: number, list: Readonly<DepthList>, f: OutputFormatter): string {
	let result = `${i === 0 ? '' : '\n'}${f.getFormatString({ style: FontStyles.Faint })}`;
	// we know there never is something on the same level as the expression list
	for(let d = 1; d < depth; d++) {
		result += deadDepths.has(d) ? '  ' : '│ ';
	}

	if(nextDepth < depth) {
		result += '╰ ';
	} else if(i > 0) {
		// check if we are maybe the last one with this depth until someone with a lower depth comes around
		const isLast = lastElementInNesting(i, list, depth);
		result += isLast ? '╰ ' : '├ ';
		if(isLast) {
			deadDepths.add(depth);
		}
	}
	return result;
}

function retrieveLocationString(locationRaw: JsonEntry) {
	const extracted = extractLocation(locationRaw);
	if(extracted[0] === extracted[2] && extracted[1] === extracted[3]) {
		return ` (${extracted[0]}:${extracted[1]})`;
	} else if(extracted[0] === extracted[2]) {
		return ` (${extracted[0]}:${extracted[1]}─${extracted[3]})`;
	} else {
		return ` (${extracted[0]}:${extracted[1]}─${extracted[2]}:${extracted[3]})`;
	}
}

function depthListToTextTree(list: Readonly<DepthList>, f: OutputFormatter): string {
	let result = '';

	const deadDepths = new Set<number>();
	let i = 0;
	for(const { depth, node, leaf } of list) {
		if(depth > 10) {
			result += '...';
			break;
		}
		const nextDepth = i + 1 < list.length ? list[i + 1].depth : 0;

		deadDepths.delete(depth);
		result += initialIndentation(i, depth, deadDepths, nextDepth, list, f);

		result += f.reset();

		const content = node.text;
		const location = retrieveLocationString(node);

		const type = getTokenType(node);

		if(leaf) {
			const suffix = `${f.format(content ? JSON.stringify(content) : '', { style: FontStyles.Bold })}${f.format(location, { style: FontStyles.Italic })}`;
			result += `${type} ${suffix}`;
		} else {
			result += f.format(type, { style: FontStyles.Bold });
		}

		i++;
	}
	return result;
}

export const parseCommand: ReplCodeCommand = {
	description:   `Prints ASCII Art of the parsed, unmodified AST, start with '${fileProtocol}' to indicate a file`,
	isCodeCommand: true,
	usageExample:  ':parse',
	aliases:       [ 'p' ],
	script:        false,
	argsParser:    (line: string) => {
		return {
			// Threat the whole input line as R code
			rCode:     removeRQuotes(line.trim()),
			remaining: []
		};
	},
	fn: async({ output, analyzer }) => {
		const result = (await analyzer.parse()).files;
		const parserInfo = analyzer.parserInformation();

		if(parserInfo.name === 'r-shell') {
			for(const { parsed, filePath } of result as ParseStepOutputSingleFile<string>[]) {
				if(filePath && filePath !== FlowrFile.INLINE_PATH) {
					output.stdout(output.formatter.format(`File: ${filePath}\n`, { style: FontStyles.Underline }) );
				}
				const object = toDepthMap(convertPreparedParsedData(prepareParsedData(parsed)));
				output.stdout(depthListToTextTree(object, output.formatter));
			}
		} else {
			// print the tree-sitter ast
			for(const { parsed, filePath } of result as ParseStepOutputSingleFile<Parser.Tree>[]) {
				if(filePath && filePath !== FlowrFile.INLINE_PATH) {
					output.stdout(output.formatter.format(`File: ${filePath}\n`, { style: FontStyles.Underline }));
				}
				const object = treeSitterToDepthList(parsed.rootNode);
				output.stdout(depthListToTextTree(object, output.formatter));
			}
		}
	}
};
