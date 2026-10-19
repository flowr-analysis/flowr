import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AnyAbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import { PartialProductDomain } from '../../abstract-interpretation/domains/partial-product-domain';
import type { AbsintProvenanceEvent } from '../../abstract-interpretation/absint-visitor';
import type { DataflowGraphTaintAnalysisProvenance } from './dataflow-graph-taint-analysis-provenance';
import { FunctionCallVertex } from '../../dataflow/graph/vertex';
import { Identifier } from '../../dataflow/environments/identifier';
import type { TaintRole } from '../taint-mapping';
import type { TaintRuleInput } from '../taint-resolve';
import { SourceLocation } from '../../util/range';

export interface TaintExplanation {
	node:     NodeId
	value:    AnyAbstractDomain | undefined
	step:     string
	children: TaintExplanation[]
}

/** */
export function formatTaintValue(value: AnyAbstractDomain | undefined): string | undefined {
	if(value instanceof PartialProductDomain) {
		const components = Object.entries(value.value as Record<string, AnyAbstractDomain | undefined>)
			// filter top (for now) for readability
			.filter(([, component]) => component !== undefined && !component.isTop())
			.map(([name, component]) => `${name}: ${component?.toString()}`);
		return components.length > 0 ? `(${components.join(', ')})` : undefined;
	}
	const text = value?.toString();
	return value === undefined || value.isTop() ? undefined : text;
}

function formatInput({ name, pos, value, defaulted }: TaintRuleInput): string {
	const text = typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : JSON.stringify(value) ?? '?';
	return `${name ?? `#${pos}`} = ${text}${defaulted ? ' (default)' : ''}`;
}

function nameOf(graph: DataflowGraphTaintAnalysisProvenance, node: NodeId): string {
	const vertex = graph.getVertex(node);
	return FunctionCallVertex.is(vertex) ? Identifier.toString(vertex.name) : String(graph.idMap?.get(node)?.lexeme ?? node);
}

/** */
export function describeTaintEvent(graph: DataflowGraphTaintAnalysisProvenance, event: AbsintProvenanceEvent): string {
	switch(event.kind) {
		case 'assign':    return 'assign';
		case 'read':      return event.inputs.length > 1 ? `join of ${event.inputs.length} definitions` : 'read';
		case 'parameter': return `parameter of ${nameOf(graph, event.detail?.call as NodeId)}`;
		case 'return':    return `return from ${nameOf(graph, event.node)}`;
		case 'call': {
			const { role, category, wasMapped, inputs } = event.detail as { role?: TaintRole, category?: string, wasMapped: boolean, inputs?: readonly TaintRuleInput[] };
			if(!wasMapped) {
				return `no rule for ${nameOf(graph, event.node)}`;
			}
			const inputText = inputs?.length ? ` (${inputs.map(formatInput).join(', ')})` : '';
			return `${role?.toLowerCase() ?? ''} rule ${nameOf(graph, event.node)}${inputText}${category ? ` (${category})` : ''}`.trim();
		}
	}
}

function explain(graph: DataflowGraphTaintAnalysisProvenance, node: NodeId, analysis: string, ancestors: ReadonlySet<NodeId>): TaintExplanation {
	const vertex = graph.getVertex(node);
	const event = vertex?.events?.[analysis];
	const value = event?.value ?? vertex?.taint?.[analysis];
	if(event === undefined || ancestors.has(node)) {
		return { node, value, step: event === undefined ? 'value' : '(cycle)', children: [] };
	}
	const next = new Set(ancestors).add(node);
	const children = event.inputs
		.filter(input => formatTaintValue(input.value) !== undefined)
		.map(input => explain(graph, input.node, analysis, next));
	return { node, value, step: describeTaintEvent(graph, event), children };
}

/** */
export function explainTaint(graph: DataflowGraphTaintAnalysisProvenance, node: NodeId, analysis: string): TaintExplanation {
	return explain(graph, node, analysis, new Set());
}

/** */
export function taintExplanationToLines(graph: DataflowGraphTaintAnalysisProvenance, explanation: TaintExplanation, prefix = '', childPrefix = ''): string[] {
	const node = graph.idMap?.get(explanation.node);
	const location = SourceLocation.format(SourceLocation.fromNode(node));
	const lines = [`${prefix}${formatTaintValue(explanation.value) ?? '⊤'} at ${node?.lexeme ?? explanation.node} [${location}] — ${explanation.step}`];
	explanation.children.forEach((child, index) => {
		const last = index === explanation.children.length - 1;
		lines.push(...taintExplanationToLines(graph, child, `${childPrefix}${last ? '└─ ' : '├─ '}`, `${childPrefix}${last ? '   ' : '│  '}`));
	});
	return lines;
}
