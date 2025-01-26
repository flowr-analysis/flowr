import type { ReplCommand } from './repl-main';
import type { OutputFormatter } from '../../../util/ansi';
import { FontStyles } from '../../../util/ansi';
import type { JsonEntry } from '../../../r-bridge/lang-4.x/ast/parser/json/format';
import { convertPreparedParsedData , prepareParsedData } from '../../../r-bridge/lang-4.x/ast/parser/json/format';
import {
	extractLocation,
	getTokenType,
} from '../../../r-bridge/lang-4.x/ast/parser/main/normalize-meta';
import { createParsePipeline } from '../../../core/steps/pipeline/default-pipelines';
import { fileProtocol, removeRQuotes, requestFromInput } from '../../../r-bridge/retriever';

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

		visit.push(...children.map(c => ({ depth: nextDepth, node: c })));
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
	} else {
		return ` (${extracted[0]}:${extracted[1]}─${extracted[2]}:${extracted[3]})`;
	}
}

function depthListToTextTree(list: Readonly<DepthList>, f: OutputFormatter): string {
	let result = '';

	const deadDepths = new Set<number>();
	let i = 0;
	for(const { depth, node, leaf } of list) {
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


export const parseCommand: ReplCommand = {
	description:  `Prints ASCII Art of the parsed, unmodified AST, start with '${fileProtocol}' to indicate a file`,
	usageExample: ':parse',
	aliases:      [ 'p' ],
	script:       false,
	fn:           async(output, parser, remainingLine) => {
		const result = await createParsePipeline(parser, {
			request: requestFromInput(removeRQuotes(remainingLine.trim()))
		}).allRemainingSteps();

		if(parser.name === 'r-shell') {
			const object = convertPreparedParsedData(prepareParsedData(result.parse.parsed));

			output.stdout(depthListToTextTree(toDepthMap(object), output.formatter));
		} else {
			// print the tree-sitter ast
			output.stdout(JSON.stringify(result.parse.parsed, null, 2));
		}
	}
};
