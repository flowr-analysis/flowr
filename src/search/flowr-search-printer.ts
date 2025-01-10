import type { FlowrSearchLike } from './flowr-search-builder';
import { traverseFlowrSearchBuilderType } from './flowr-search-traverse';
import { escapeMarkdown } from '../util/mermaid/mermaid';
import { binaryTreeToString, isBinaryTree } from './flowr-search-filters';


export interface FlowrSearchMermaidBuilderOptions {
	header?: string;
}

/**
 * Converts a {@link FlowrSearchLike} object to a mermaid flowchart.
 */
export function flowrSearchToMermaid(search: FlowrSearchLike, conf?: FlowrSearchMermaidBuilderOptions): string {
	const out = [conf?.header ?? 'flowchart LR'];
	let count = 0;
	out.push(traverseFlowrSearchBuilderType(
		search,
		({ type, name, args }) =>
			`${count}("<b>${name}</b>(${argsToString(args)})<br/>_${type}_")`,
		(acc, { name, args, type }) =>
			`${acc} --> ${++count}["<b>${name}</b>(${argsToString(args)})<br/>_${type}_"]`
	));
	return out.join('\n');
}

function argsToString(args: Record<string, unknown> | undefined): string {
	if(args === undefined) {
		return '';
	}
	return Object.entries(args).map(([key, value]) =>
		`${key}: ${isBinaryTree(value) ? '_' + escapeMarkdown(binaryTreeToString(value.tree)) + '_' 
			: escapeMarkdown(JSON.stringify(value))}`)
		.join(', ');
}


