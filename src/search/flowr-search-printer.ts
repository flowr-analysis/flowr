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
			`${count}("<b>${name}</b>(${argsToMermaidString(args)})<br/>_${type}_")`,
		(acc, { name, args, type }) =>
			`${acc} --> ${++count}["<b>${name}</b>(${argsToMermaidString(args)})<br/>_${type}_"]`
	));
	return out.join('\n');
}

function argsToMermaidString(args: Record<string, unknown> | undefined): string {
	if(args === undefined) {
		return '';
	}
	return Object.entries(args).map(([key, value]) =>
		`${key}: ${isBinaryTree(value) ? '_' + escapeMarkdown(binaryTreeToString(value.tree)) + '_' 
			: escapeMarkdown(JSON.stringify(value))}`)
		.join(', ');
}

function argsToAsciiString(args: Record<string, unknown> | undefined): string {
	if(args === undefined) {
		return '';
	} else if(Object.keys(args).length === 1) {
		const key = Object.keys(args)[0];
		const value = args[key];
		return `${key}: ${isBinaryTree(value) ? '_' + binaryTreeToString(value.tree) + '_' : JSON.stringify(value)}`;
	}
	return Object.entries(args).map(([key, value]) =>
		`${key}: ${isBinaryTree(value) ? '_' + binaryTreeToString(value.tree) + '_' : JSON.stringify(value)}`)
		.join(', ');
}

export function flowrSearchToAscii(search: FlowrSearchLike): string {
	return traverseFlowrSearchBuilderType(
		search,
		({ name, args }) =>
			`${name}(${argsToAsciiString(args)})`,
		(acc, { name, args }) =>
			`${acc} --> ${name}(${argsToAsciiString(args)})`
	);
}


