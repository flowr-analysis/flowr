import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { FunctionSemantics } from '../../dataflow/fn/function-semantics';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RLoopConstructs, RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { FunctionArgument } from '../../dataflow/graph/graph';
import type { EdgeTypeBits } from '../../dataflow/graph/edge';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import { DfgVertex, VertexType } from '../../dataflow/graph/vertex';
import type { DataflowInformation } from '../../dataflow/info';
import { ControlDependency } from '../../dataflow/info';
import { ArgProp, SemanticCallTag, type FnSig } from '../../dataflow/environments/built-in-props';
import { callFnProps } from '../../dataflow/environments/query-fn-props';
import { Identifier } from '../../dataflow/environments/identifier';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { edgeSources } from '../../dataflow/fn/frame-reflection';
import { Q } from '../../search/flowr-search-builder';
import type { MergeableRecord } from '../../util/objects';
import { SourceLocation, SourceRange } from '../../util/range';
import { isNotUndefined } from '../../util/assert';
import type { LintingResult, LintingRule, LintQuickFix } from '../linter-format';
import { LintingPrettyPrintContext, LintingResultCertainty, LintingRuleCertainty } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';
import type { FlowrSearchElement } from '../../search/flowr-search';
import { RExpressionList } from '../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { boundArgumentIndex } from '../../dataflow/eval/resolve/resolve-argument';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';

export type UnclosedConnectionResult = LintingResult;

export interface UnclosedConnectionMetadata extends MergeableRecord {
	/** the number of calls opening a connection */
	totalOpened: number,
	/** the number of calls closing a connection */
	totalClosed: number
}

export interface UnclosedConnectionConfig extends MergeableRecord {
	/** functions opening a connection, besides the ones flowR states {@link SemanticCallTag.Opens} for */
	openFns:  readonly Identifier[],
	/** functions closing the connection they are handed, besides the ones flowR states {@link SemanticCallTag.Closes} for */
	closeFns: readonly Identifier[]
}

/** the edges the connection flows along, from the call opening it to the argument of the call closing it */
const ConnectionFlow: EdgeTypeBits = EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall | EdgeType.Returns | EdgeType.Argument;

/** The arguments holding the handle the call acts on, all of them if it does not state which. */
function handleArguments(vertex: DataflowGraphVertexFunctionCall, sig: FnSig | undefined): readonly FunctionArgument[] {
	const stated = sig && FunctionSemantics.call.signature.posWith(FunctionSemantics.call.signature.layout(sig), vertex.args.length, ArgProp.Handle);
	return stated?.length ? stated.map(i => vertex.args[i]) : vertex.args;
}

/**
 * Adds every opening call whose connection may reach `start`, an argument of a closing call, to `out`.
 * Unlike {@link Dataflow.provenance} this stops at an opening call and follows no control dependency,
 * so a close in a branch does not claim what that branch opens beside it.
 */
function openCallsReaching(graph: DataflowGraph, start: NodeId, opens: ReadonlySet<NodeId>, out: Set<NodeId>): void {
	const visited = new Set<NodeId>([start]);
	const pending = [start];
	while(pending.length > 0) {
		const current = pending.pop() as NodeId;
		if(opens.has(current)) {
			out.add(current);
			continue;
		}
		for(const [target, edge] of graph.edgesFrom(current)) {
			if(DfEdge.includesType(edge, ConnectionFlow) && !visited.has(target)) {
				visited.add(target);
				pending.push(target);
			}
		}
	}
}

/** The variable definition the opened connection is bound to, if it is bound to one. */
function bindingOf(graph: DataflowGraph, open: NodeId): NodeId | undefined {
	return edgeSources(graph, open, EdgeType.DefinedBy).find(source => DfgVertex.isVariableDefinition(graph.getVertex(source)));
}

/** The statement `id` belongs to, i.e. the ancestor that is an element of an expression list. */
function enclosingStatement(idMap: AstIdMap, id: NodeId): RNode<ParentInformation> | undefined {
	const statement = RNode.findEnclosing(id, idMap, n => {
		const parent = RNode.directParent(n, idMap);
		return parent === undefined || RExpressionList.is(parent);
	});
	return statement === undefined ? undefined : idMap.get(statement);
}

function liftedOutOfLoops(idMap: AstIdMap, id: NodeId, definition: NodeId): NodeId {
	let lifted = id;
	for(let node = idMap.get(id); node !== undefined; node = RNode.directParent(node, idMap)) {
		if(RLoopConstructs.is(node) && RNode.findEnclosing(definition, idMap, n => n.info.id === node.info.id) === undefined) {
			lifted = node.info.id;
		}
	}
	return lifted;
}

/** A fix closing the connection after the last statement using it, if it is bound to a name to close. */
function closeFix(graph: DataflowGraph, open: NodeId): LintQuickFix[] | undefined {
	const idMap = graph.idMap;
	const definition = bindingOf(graph, open);
	const name = idMap && definition !== undefined ? NodeId.recoverName(definition, idMap) : undefined;
	if(idMap === undefined || definition === undefined || name === undefined) {
		return undefined;
	}
	const reads = edgeSources(graph, definition, EdgeType.Reads);
	const statements = [definition, ...reads]
		.map(id => SourceLocation.fromNode(enclosingStatement(idMap, liftedOutOfLoops(idMap, id, definition))))
		.filter(isNotUndefined);
	const last = statements.reduce<SourceLocation | undefined>(
		(a, b) => a === undefined || SourceRange.compare(a, b) < 0 ? b : a, undefined);
	if(last === undefined) {
		return undefined;
	}
	const [startLine, startColumn, endLine, endColumn] = last;
	return [{
		type:        'replace',
		loc:         SourceLocation.from([endLine, endColumn + 1, endLine, endColumn], SourceLocation.getFile(last)),
		description: `Close the connection with \`close(${name})\``,
		replacement: `\n${' '.repeat(startLine === endLine ? startColumn - 1 : 0)}close(${name})`
	}];
}

/**
 * How certain we are that the connection opened at `open` is left open,
 * or `undefined` if the given closing calls close it in every run that opens it.
 */
function unclosedCertainty(graph: DataflowGraph, open: NodeId, closes: readonly NodeId[] | undefined): LintingResultCertainty | undefined {
	if(closes === undefined) {
		return LintingResultCertainty.Certain;
	}
	const openCds = graph.getVertex(open)?.cds ?? [];
	const uncovered = new Set<ControlDependency>();
	for(const close of closes) {
		const closeCds = graph.getVertex(close)?.cds ?? [];
		/* opening within a loop and closing outside of it closes the connection of the last iteration only */
		if(ControlDependency.minus(openCds, closeCds).some(cd => ControlDependency.isIterated(cd, graph.idMap))) {
			continue;
		}
		const only = ControlDependency.minus(closeCds, openCds);
		if(only.length === 0) {
			return undefined;
		}
		for(const cd of only) {
			uncovered.add(cd);
		}
	}
	/* the closes may still cover every branch between them, as in `if(p) close(c) else close(c)` */
	return uncovered.size > 0 && ControlDependency.happensInEveryBranchSet(uncovered) ? undefined : LintingResultCertainty.Uncertain;
}

/** Whether the call creates its connection unopened and hands it straight to a call reading or writing it, which opens and closes it. */
function consumedInPlace(dataflow: DataflowInformation, open: NodeId, ctx: ReadOnlyFlowrAnalyzerContext): boolean {
	const { graph } = dataflow;
	const vertex = graph.getVertex(open);
	const node = graph.idMap?.get(open);
	const arg = node && graph.idMap ? RNode.directParent(node, graph.idMap) : undefined;
	const consumer = RArgument.is(arg) && graph.idMap ? RNode.directParent(arg, graph.idMap) : undefined;
	if(!DfgVertex.isFunctionCall(vertex) || !RFunctionCall.is(consumer)) {
		return false;
	}
	const mode = boundArgumentIndex(graph, vertex, undefined, 'open', ctx);
	const stated = callFnProps(consumer.info.id, dataflow);
	return (mode === undefined ? vertex.args.length <= 1 : mode >= vertex.args.length)
		&& FunctionSemantics.call.props.hasAny(stated, [SemanticCallTag.Reads, SemanticCallTag.Writes])
		&& !FunctionSemantics.call.props.hasAny(stated, SemanticCallTag.Opens);
}

/** The calls opening and the calls closing a connection, as the props state and the configuration adds. */
function connectionCalls(elements: readonly FlowrSearchElement<ParentInformation>[], dataflow: DataflowInformation, config: UnclosedConnectionConfig) {
	const opensByName = config.openFns.length > 0 ? Identifier.regex(...config.openFns) : undefined;
	const closesByName = config.closeFns.length > 0 ? Identifier.regex(...config.closeFns) : undefined;
	const opens = new Map<NodeId, SourceLocation>();
	const closes: [call: DataflowGraphVertexFunctionCall, sig: FnSig | undefined][] = [];
	for(const { node } of elements) {
		const stated = callFnProps(node.info.id, dataflow);
		if(stated === undefined) {
			continue;
		}
		const name = Identifier.toString(stated.name);
		const loc = SourceLocation.fromNode(node);
		if(loc !== undefined && (FunctionSemantics.call.props.hasAny(stated, SemanticCallTag.Opens) || opensByName?.test(name))) {
			opens.set(node.info.id, loc);
		} else if(FunctionSemantics.call.props.hasAny(stated, SemanticCallTag.Closes) || closesByName?.test(name)) {
			const vertex = dataflow.graph.getVertex(node.info.id);
			if(DfgVertex.isFunctionCall(vertex)) {
				closes.push([vertex, stated.sig]);
			}
		}
	}
	return { opens, closes };
}

export const UNCLOSED_CONNECTION = {
	createSearch:        () => Q.all().filter(VertexType.FunctionCall),
	processSearchResult: async(elements, config, data) => {
		const dataflow = await data.dataflow();
		const graph = dataflow.graph;
		const { opens, closes } = connectionCalls(elements.getElements(), dataflow, config);
		const openIds = new Set(opens.keys());
		const closedBy = new Map<NodeId, NodeId[]>();
		for(const [close, sig] of opens.size > 0 ? closes : []) {
			const reached = new Set<NodeId>();
			for(const arg of handleArguments(close, sig)) {
				const ref = FunctionArgument.getReference(arg);
				if(ref !== undefined) {
					openCallsReaching(graph, ref, openIds, reached);
				}
			}
			for(const open of reached) {
				closedBy.set(open, [...(closedBy.get(open) ?? []), close.id]);
			}
		}
		const results: UnclosedConnectionResult[] = [];
		for(const [open, loc] of opens) {
			if(consumedInPlace(dataflow, open, data.inspectContext())) {
				continue;
			}
			const certainty = unclosedCertainty(graph, open, closedBy.get(open));
			if(certainty === undefined) {
				continue;
			}
			/* closing what another path closes as well errors in R, so only a connection nothing closes gets a fix */
			const quickFix = certainty === LintingResultCertainty.Certain ? closeFix(graph, open) : undefined;
			results.push({ certainty, involvedId: open, loc, ...(quickFix ? { quickFix } : {}) });
		}
		return { results, '.meta': { totalOpened: opens.size, totalClosed: closes.length } };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Unclosed connection at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `The connection opened at ${SourceLocation.format(result.loc)} is not closed on every path that opens it`
	},
	info: {
		name:          'Unclosed Connection',
		tags:          [LintingRuleTag.Robustness, LintingRuleTag.Smell],
		/* a connection handed to code flowR cannot resolve, as in `lapply(cons, close)`, is reported although it is closed */
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Flags connections that are opened but not closed on every path opening them.',
		defaultConfig: () => ({
			openFns:  [],
			closeFns: []
		})
	}
} as const satisfies LintingRule<UnclosedConnectionResult, UnclosedConnectionMetadata, UnclosedConnectionConfig>;
