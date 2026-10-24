import { SourceLocation } from '../util/range';
import { LintingResultCertainty, type LintingResult } from './linter-format';
import type { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { Dataflow } from '../dataflow/graph/df-helper';
import { DfgVertex } from '../dataflow/graph/vertex';
import { OriginType } from '../dataflow/origin/dfg-get-origin';
import { Identifier } from '../dataflow/environments/identifier';
import type { BuiltInIndex } from '../dataflow/environments/query-fn-props';
import type { PropSelector } from '../dataflow/environments/built-in-props';
import { FunctionSemantics } from '../dataflow/fn/function-semantics';
import { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';

/** The certainty, involved node, and location of a finding at a node or location. */
export function at(where: RNode<ParentInformation> | SourceLocation | undefined, certain = true): Pick<LintingResult, 'certainty' | 'involvedId' | 'loc'> {
	const node = Array.isArray(where) ? undefined : where;
	return {
		certainty:  certain ? LintingResultCertainty.Certain : LintingResultCertainty.Uncertain,
		involvedId: node?.info.id,
		loc:        (node ? SourceLocation.fromNode(node) : where as SourceLocation | undefined) ?? SourceLocation.invalid()
	};
}

/**
 * The function the call `id` calls, found through the dataflow origins so shadowing, aliasing, and `pkg::fn` are
 * accounted for: the built-in it resolves to, or the name it is called by if no code of the analyzed program
 * defines it. `undefined` if it may reach code of the program.
 */
export function builtInOf(graph: DataflowGraph, id: NodeId): Identifier | undefined {
	const origins = Dataflow.origin(graph, id) ?? [];
	if(origins.length === 0) {
		const vertex = graph.getVertex(id);
		return DfgVertex.isFunctionCall(vertex) ? vertex.name : undefined;
	}
	const names = new Set(origins.map(o => o.type === OriginType.BuiltInFunctionOrigin ? o.fn.name : undefined));
	if(names.size !== 1 || names.has(undefined)) {
		return undefined;
	}
	const [name] = names as Set<string>;
	const pkgFn = NodeId.toPkgFn(NodeId.toBuiltIn(name));
	return pkgFn === undefined ? name : Identifier.make(pkgFn[1], pkgFn[0]);
}

/** Whether the call `id` resolves to a built-in of one of the plain `names`, wherever it was imported from. */
export function callsBuiltIn(graph: DataflowGraph, id: NodeId, names: string | ReadonlySet<string>): boolean {
	const builtIn = builtInOf(graph, id);
	return builtIn !== undefined && (typeof names === 'string' ? names === Identifier.getName(builtIn) : names.has(Identifier.getName(builtIn)));
}

/** Whether the built-in the call `id` resolves to states one of the `props` (a {@link CallProp} or {@link SemanticCallTag}). */
export function callHas(graph: DataflowGraph, id: NodeId, index: BuiltInIndex, props: PropSelector): boolean {
	const builtIn = builtInOf(graph, id);
	const entry = builtIn === undefined ? undefined : index.get(builtIn);
	return entry !== undefined && FunctionSemantics.call.props.hasAny(entry, props);
}

/** The plain names of the built-ins carrying one of the `props`, to filter AST-only code (no dataflow) by what flowR states. */
export function namesWith(index: BuiltInIndex, props: PropSelector): ReadonlySet<string> {
	return new Set(index.with(props).map(n => Identifier.getName(n)));
}
