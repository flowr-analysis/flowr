import { DfgVertex, type DataflowGraphVertexFunctionCall } from '../../../dataflow/graph/vertex';
import { FunctionArgument } from '../../../dataflow/graph/graph';
import { DfEdge, EdgeType } from '../../../dataflow/graph/edge';
import { Identifier } from '../../../dataflow/environments/identifier';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import type { DataflowInformation } from '../../../dataflow/info';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { queryFnProps } from '../../../dataflow/environments/query-fn-props';
import { ArgProp, FnSig } from '../../../dataflow/environments/built-in-props';
import { isPlot } from './plot-objects';

/** The variable an assignment stores a result in. */
export interface AssignmentTarget {
	readonly id:   NodeId
	readonly name: string
}

/** the roles of an argument that carries no data into the result, whatever else the call does with it */
const CarriesNoData = ArgProp.Resource | ArgProp.Flag | ArgProp.Nse | ArgProp.Callee | ArgProp.Presence | ArgProp.Handle | ArgProp.Written | ArgProp.Lazy;

function carriesData(roles: number): boolean {
	return (roles & CarriesNoData) === 0;
}

function nameOf(ast: NormalizedAst, id: NodeId): string | undefined {
	const node = ast.idMap.get(id);
	return RSymbol.is(node) ? Identifier.getName(node.content) : RString.is(node) ? node.content.str : undefined;
}

/** the calls the value `id` is an argument of */
function consumersOf(dataflow: DataflowInformation, id: NodeId): DataflowGraphVertexFunctionCall[] {
	return dataflow.graph.edgesTo(id).entries()
		.filter(([, edge]) => DfEdge.includesType(edge, EdgeType.Argument))
		.map(([from]) => dataflow.graph.getVertex(from))
		.filter(v => DfgVertex.isFunctionCall(v))
		.toArray();
}

/**
 * The arguments of the call, each with the roles its signature states for the parameter it fills (see
 * {@link FnSig.slots}). A call flowR states nothing about uses every argument in an unknown way.
 */
export function argumentRoles(dataflow: DataflowInformation, call: DataflowGraphVertexFunctionCall): [NodeId, number][] {
	const sig = queryFnProps(Dataflow.qualify(call.id, dataflow.graph, false) ?? call.name, { environment: dataflow.environment })?.sig;
	const layout = sig === undefined ? undefined : FnSig.layout(sig);
	const slots = layout === undefined ? undefined : FnSig.slots(layout, call.args.map(a => FunctionArgument.isNamed(a) ? a.name : undefined));
	return call.args.flatMap((arg, at) => {
		const ref = FunctionArgument.getReference(arg);
		const slot = slots?.[at] ?? -1;
		return ref === undefined ? [] : [[ref, layout === undefined || slot < 0 ? 0 : layout.props[slot]] as [NodeId, number]];
	});
}

/** whether the use only names a function, as `sum` in `aggregate(x, by, FUN = sum)` does */
function namesFunction(dataflow: DataflowInformation, id: NodeId): boolean {
	const targets = Dataflow.targetsOf(dataflow.graph, id, EdgeType.Reads);
	return targets.length > 0 && targets.every(t => NodeId.isBuiltIn(t) || DfgVertex.isFunctionDefinition(dataflow.graph.getVertex(t)));
}

/** whether a call evaluates the node other than in the caller, quoting it or looking it up in a data mask */
function escapesEvaluation(dataflow: DataflowInformation, id: NodeId): boolean {
	return dataflow.graph.edgesTo(id).values().some(e => DfEdge.includesType(e, EdgeType.NonStandardEvaluation));
}

function collectVariables(dataflow: DataflowInformation, ast: NormalizedAst, id: NodeId, into: Set<string>, seen: Set<NodeId>): void {
	if(seen.has(id) || escapesEvaluation(dataflow, id)) {
		return;
	}
	seen.add(id);
	const vertex = dataflow.graph.getVertex(id);
	if(DfgVertex.isUse(vertex)) {
		const name = nameOf(ast, id);
		if(name !== undefined && !namesFunction(dataflow, id)) {
			into.add(name);
		}
	} else if(DfgVertex.isFunctionCall(vertex)) {
		for(const [arg, roles] of argumentRoles(dataflow, vertex)) {
			if(carriesData(roles)) {
				collectVariables(dataflow, ast, arg, into, seen);
			}
		}
	}
}

/**
 * The variables the result of a call is computed from, resolved through the dataflow graph: the variables read
 * by its arguments, through every call in between. An argument whose role in the signature carries no data is no
 * input (the file of `write.csv`, a flag, a callee), nor is what a call quotes or looks up in a data mask (`x` in
 * `filter(df, x > 1)`), or a use that only names a function.
 */
export function inputVariablesOf(dataflow: DataflowInformation, ast: NormalizedAst, call: DataflowGraphVertexFunctionCall): string[] {
	const into = new Set<string>();
	const seen = new Set<NodeId>([call.id]);
	for(const [arg, roles] of argumentRoles(dataflow, call)) {
		if(carriesData(roles)) {
			collectVariables(dataflow, ast, arg, into, seen);
		}
	}
	return [...into];
}

function targetOf(dataflow: DataflowInformation, assignment: DataflowGraphVertexFunctionCall, value: NodeId): NodeId | undefined {
	return dataflow.graph.edgesFrom(assignment.id).entries()
		.find(([to, edge]) => to !== value && DfEdge.includesType(edge, EdgeType.Returns) && DfgVertex.isVariableDefinition(dataflow.graph.getVertex(to)))?.[0];
}

/**
 * The arguments the call hands on as its own result: the {@link ArgProp.Alias} one of its signature (`(x)`, a pipe
 * into a call), or both operands of a `+` that adds to a plot, as ggplot's method for it returns the plot.
 */
export function handedOn(dataflow: DataflowInformation, ast: NormalizedAst, call: DataflowGraphVertexFunctionCall): NodeId[] {
	const node = ast.idMap.get(call.id);
	return argumentRoles(dataflow, call).filter(([, roles]) => (roles & ArgProp.Alias) !== 0 || (RBinaryOp.is(node) && isPlot(node, dataflow)))
		.map(([arg]) => arg);
}

/**
 * The variable the value of the call `id` is assigned to, following every call that hands the value on (see
 * {@link handedOn}) up to the assignment. A value used by anything else, as in `f(mutate(df))`, is assigned to nothing.
 */
export function assignmentOf(dataflow: DataflowInformation, ast: NormalizedAst, id: NodeId): AssignmentTarget | undefined {
	const seen = new Set<NodeId>();
	for(let current = id; !seen.has(current);) {
		seen.add(current);
		const consumers = consumersOf(dataflow, current);
		for(const consumer of consumers) {
			const target = targetOf(dataflow, consumer, current);
			const name = target === undefined ? undefined : nameOf(ast, target);
			if(target !== undefined && name !== undefined) {
				return { id: target, name };
			}
		}
		const next = consumers.find(c => handedOn(dataflow, ast, c).includes(current));
		if(next === undefined) {
			return undefined;
		}
		current = next.id;
	}
	return undefined;
}
