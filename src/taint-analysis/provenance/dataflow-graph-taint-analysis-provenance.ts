import { DataflowGraph } from '../../dataflow/graph/graph';
import { type DataflowGraphVertexInfo, FunctionCallVertex } from '../../dataflow/graph/vertex';
import type { REnvironmentInformation } from '../../dataflow/environments/environment';
import { type DFControlFlowEdge, DfEdge, EdgeType } from '../../dataflow/graph/edge';
import type { AnyAbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import type { TaintInferenceResult } from '../builder/taint-analysis';
import type { AbsintProvenanceEvent } from '../../abstract-interpretation/absint-visitor';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { GraphHelper } from '../../dataflow/graph/graph-helper';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { describeTaintEvent, explainTaint, formatTaintValue } from './taint-provenance-explanation';
import { Identifier } from '../../dataflow/environments/identifier';
import { SourceLocation } from '../../util/range';
import { DataflowMermaid } from '../../util/mermaid/dfg';
import { Mermaid } from '../../util/mermaid/mermaid';

export enum TaintProvenanceMode {
	None = 'none',
	Explain = 'explain',
	Graph = 'graph'
}

export type TaintProvenanceVertex = DataflowGraphVertexInfo & {
	taint?:    Record<string, AnyAbstractDomain>
	findings?: Record<string, string>
	events?:   Record<string, AbsintProvenanceEvent>
};

export type DataflowGraphTaintAnalysisProvenance = DataflowGraph<TaintProvenanceVertex>;

function collectEvents(taint: Map<string, TaintInferenceResult>, id: NodeId): Record<string, AbsintProvenanceEvent> | undefined {
	const result: Record<string, AbsintProvenanceEvent> = {};
	for(const [name, { provenance }] of taint) {
		const event = provenance?.get(id);
		if(event !== undefined) {
			result[name] = event;
		}
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

function collectFindings(taint: Map<string, TaintInferenceResult>): Map<NodeId, Record<string, string>> {
	const findings = new Map<NodeId, Record<string, string>>();
	for(const [name, { findings: found, msg }] of taint) {
		for(const finding of found) {
			const entry = findings.get(finding.nodeId) ?? {};
			entry[name] = finding.msg ?? msg ?? name;
			findings.set(finding.nodeId, entry);
		}
	}
	return findings;
}

function collectTaint(taint: Map<string, TaintInferenceResult>, id: NodeId): Record<string, AnyAbstractDomain> | undefined {
	const values: Record<string, AnyAbstractDomain> = {};
	for(const [name, { domains }] of taint) {
		const value = domains.get(id);
		if(value !== undefined) {
			values[name] = value;
		}
	}
	return Object.keys(values).length > 0 ? values : undefined;
}

function boxId(id: NodeId, kind: 'taint' | 'decision' | 'finding'): string {
	return `${kind}_${Mermaid.escapeId(id)}`;
}

function ruleEvent(vertex: TaintProvenanceVertex | undefined): AbsintProvenanceEvent | undefined {
	return Object.values(vertex?.events ?? {}).find(event => event.kind === 'call' && formatTaintValue(event.value) !== undefined);
}

function taintValueLabels(graph: DataflowGraphTaintAnalysisProvenance): Map<NodeId, string[]> {
	const labels = new Map<NodeId, string[]>();
	for(const [id, vertex] of graph.vertices(true)) {
		const analyses = new Set([...Object.keys(vertex.taint ?? {}), ...Object.keys(vertex.events ?? {})]);
		const values = [...analyses].flatMap(analysis => {
			const value = formatTaintValue(vertex.events?.[analysis]?.value ?? vertex.taint?.[analysis]);
			return value === undefined ? [] : [`${analysis}: ${Mermaid.escape(value)}`];
		});
		if(values.length > 0) {
			labels.set(id, values);
		}
	}
	return labels;
}

function valueBoxes(graph: DataflowGraphTaintAnalysisProvenance, values: ReadonlyMap<NodeId, string[]>): string[] {
	return [...values].flatMap(([id, lines]) => {
		const vertex = graph.getVertex(id);
		const name = FunctionCallVertex.is(vertex) ? `${Identifier.toString(vertex.name)}()` : String(graph.idMap?.get(id)?.lexeme ?? id);
		const location = SourceLocation.fromNode(graph.idMap?.get(id));
		const header = `**${Mermaid.escape(name)}** @${location === undefined ? '?' : `${location[0]}.${location[1]}`}`;
		return [
			`    ${boxId(id, 'taint')}["\`${[header, ...lines].join('\n')}\`"]`,
			`    style ${boxId(id, 'taint')} color:blue,stroke:blue,stroke-width:2px;`
		];
	});
}

function ruleBoxes(graph: DataflowGraphTaintAnalysisProvenance, values: ReadonlyMap<NodeId, string[]>): string[] {
	return [...values.keys()].flatMap(id => {
		const rule = ruleEvent(graph.getVertex(id));
		if(rule === undefined) {
			return [`    ${Mermaid.escapeId(id)} -.-|taint| ${boxId(id, 'taint')}`];
		}
		return [
			`    ${boxId(id, 'decision')}["\`${Mermaid.escape(describeTaintEvent(graph, rule))}\`"]`,
			`    style ${boxId(id, 'decision')} color:darkorange,stroke:darkorange,stroke-width:2px;`,
			`    ${Mermaid.escapeId(id)} -.-|taint| ${boxId(id, 'decision')}`,
			`    ${boxId(id, 'decision')} ==> ${boxId(id, 'taint')}`
		];
	});
}

function provenanceEdges(graph: DataflowGraphTaintAnalysisProvenance, values: ReadonlyMap<NodeId, string[]>): string[] {
	return [...values.keys()].flatMap(id => {
		const edges = new Map<NodeId, string>();
		for(const event of Object.values(graph.getVertex(id)?.events ?? {})) {
			if(formatTaintValue(event.value) === undefined) {
				continue;
			}
			for(const input of event.inputs) {
				if(values.has(input.node) && input.node !== id) {
					edges.set(input.node, event.kind === 'call' ? 'input' : event.kind);
				}
			}
		}
		return [...edges].map(([from, kind]) => `    ${boxId(from, 'taint')} ==>|"${kind}"| ${boxId(id, kind === 'input' ? 'decision' : 'taint')}`);
	});
}

function findingBoxes(graph: DataflowGraphTaintAnalysisProvenance, values: ReadonlyMap<NodeId, string[]>): string[] {
	return [...graph.vertices(true)].flatMap(([id, vertex]) => {
		if(vertex.findings === undefined) {
			return [];
		}
		const label = Object.entries(vertex.findings).map(([name, msg]) => `**${name}: ${Mermaid.escape(msg)}**`).join('\n');
		return [
			`    ${boxId(id, 'finding')}["\`${label}\`"]`,
			`    ${values.has(id) ? boxId(id, 'taint') : Mermaid.escapeId(id)} -.-|finding| ${boxId(id, 'finding')}`,
			`    style ${boxId(id, 'finding')} color:red,stroke:red,stroke-width:3px;`
		];
	});
}

function taintProvenanceToMermaid(graph: DataflowGraphTaintAnalysisProvenance): string {
	const values = taintValueLabels(graph);
	return [
		DataflowMermaid.convert({ graph }).string,
		...valueBoxes(graph, values),
		...ruleBoxes(graph, values),
		...provenanceEdges(graph, values),
		...findingBoxes(graph, values)
	].join('\n');
}

function taintProvenanceToMermaidUrl(graph: DataflowGraphTaintAnalysisProvenance): string {
	return Mermaid.codeToUrl(taintProvenanceToMermaid(graph));
}

export const DataflowGraphTaintAnalysisProvenance = {
	...GraphHelper,
	name:      'DataflowGraphTaintAnalysisProvenance',
	visualize: {
		...Dataflow.visualize,
		mermaid: {
			raw: taintProvenanceToMermaid,
			url: taintProvenanceToMermaidUrl
		}
	},
	explain: explainTaint,
	compute(this: void, dfg: DataflowGraph, taint: Map<string, TaintInferenceResult>, cleanEnv: REnvironmentInformation): DataflowGraphTaintAnalysisProvenance {
		const result: DataflowGraphTaintAnalysisProvenance = new DataflowGraph(dfg.idMap);
		const findings = collectFindings(taint);
		for(const [id, vtx] of dfg.vertices(true)) {
			const vertex: TaintProvenanceVertex = { ...vtx };
			const values = collectTaint(taint, id);
			if(values !== undefined) {
				vertex.taint = values;
			}
			const recorded = collectEvents(taint, id);
			if(recorded !== undefined) {
				vertex.events = recorded;
			}
			const found = findings.get(id);
			if(found !== undefined) {
				vertex.findings = found;
			}
			result.addVertex(vertex, cleanEnv, dfg.isRoot(id));
		}
		for(const [from, targets] of dfg.edges()) {
			for(const [to, edge] of targets) {
				if(DfEdge.includesType(edge, EdgeType.ControlEdge)) {
					result.addEdge(from, to, EdgeType.ControlEdge, { cd: (edge as DFControlFlowEdge).cd });
				}
				result.addEdge(from, to, edge.types);
			}
		}
		return result;
	}
} as const;
