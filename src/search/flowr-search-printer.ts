import type { FlowrSearchLike } from './flowr-search-builder';
import { traverseFlowrSearchBuilderType } from './flowr-search-traverse';
import { escapeMarkdown } from '../util/mermaid/mermaid';
import { binaryTreeToString, isBinaryTree, ValidFlowrFilters, ValidFlowrFiltersReverse } from './flowr-search-filters';
import type { FlowrSearchGeneratorNode } from './search-executor/search-generators';
import type { FlowrSearchTransformerNode } from './search-executor/search-transformer';
import { ValidVertexTypeReverse, ValidVertexTypes } from '../dataflow/graph/vertex';
import { ValidRTypes, ValidRTypesReverse } from '../r-bridge/lang-4.x/ast/model/type';


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


function argsToCodeString(args: Record<string, unknown> | undefined): string {
	if(args === undefined) {
		return '';
	}
	return Object.entries(args).map(([, value]) =>
		`${JSON.stringify(value)}`)
		.join(', ');
}

export function flowrSearchToCode(search: FlowrSearchLike): string {
	return traverseFlowrSearchBuilderType(
		search,
		(node) =>
			`Q.${flowrGeneratorToCode(node)}`,
		(acc, node) =>
			`${acc}.${flowrTransformerToCode(node)}`
	);
}

function flowrTransformerToCode(node: FlowrSearchTransformerNode): string {
	if(node.name === 'filter') {
		// TODO: improved tree support!
		const a = node.args.filter;
		if(ValidVertexTypes.has(String(a))) {
			return `${node.name}(VertexType.${ValidVertexTypeReverse[String(a)]})`;
		} else if(ValidRTypes.has(String(a))) {
			return `${node.name}(RType.${ValidRTypesReverse[String(a)]})`;
		} else if(ValidFlowrFilters.has(String(a))) {
			return `${node.name}(FlowrFilter.${ValidFlowrFiltersReverse[String(a)]})`;
		}
	}
	return `${node.name}(${argsToCodeString(node.args)})`;
}

function flowrGeneratorToCode(node: FlowrSearchGeneratorNode): string {
	if(node.name !== 'get') {
		return `${node.name}(${argsToCodeString(node.args)})`;
	}
	const a = node.args.filter;

	if(Object.keys(a).length === 1) {
		if(a.name) {
			return `var(${JSON.stringify(a.name)})`;
		}
	} else if(Object.keys(a).length === 2) {
		if(a.name && a.line) {
			return `varInLine(${JSON.stringify(a.name)}, ${JSON.stringify(a.line)})`;
		}
	}

	return `${node.name}(${argsToCodeString(node.args)})`;
}


