import type { DataflowGraph } from '../graph/graph';
import { FunctionArgument } from '../graph/graph';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { EdgeType } from '../graph/edge';
import { Dataflow } from '../graph/df-helper';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition } from '../graph/vertex';
import { DfgVertex } from '../graph/vertex';
import type { ArgProps, BuiltInFnInfo } from '../environments/built-in-props';
import { ArgProp, FnSig as Sig } from '../environments/built-in-props';
import { Identifier, type BrandedIdentifier } from '../environments/identifier';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { ReachSummaries } from '../../util/fixpoint';
import { Monoid } from '../../util/monoid';

/** What flowR states about the built-in a call names, see {@link BuiltInFnInfo}. */
export type BuiltInLookup = (name: Identifier) => BuiltInFnInfo | undefined;

/** the assignments binding in the frame they run in, which is a scope of the function's own */
const FrameLocalBinders: ReadonlySet<BrandedIdentifier> = new Set(['<-', '=', '->', ':=', 'assign']);

/** Whether the name is a replacement function binding in its own frame (`names(x) <- v`); the `<<-` twin does not. */
function isFrameLocalReplacement(name: BrandedIdentifier): boolean {
	return name.endsWith('<-') && !name.endsWith('<<-');
}

/** Whether the call binds a name beyond its own frame ({@link CallProp.Scope}): `y <<- 1`, `library(x)`, `assign` to an env do; `y <- 1` does not. */
export function bindsOutside(vertex: DataflowGraphVertexFunctionCall, info: BuiltInFnInfo | undefined): boolean {
	const name = Identifier.getName(vertex.name);
	if(!FrameLocalBinders.has(name) && !isFrameLocalReplacement(name)) {
		return true;
	}
	return info?.sig !== undefined && Sig.posWith(Sig.layout(info.sig), vertex.args.length, ArgProp.Written).length > 0;
}

/** What to ask for beyond the definition itself, see {@link reflectiveRolesOf}. */
export interface FrameReflectionOptions {
	/** what flowR states about a built-in, answered once per name */
	readonly known: BuiltInLookup
}

/**
 * What `definition`'s body reaches about its own formals through the frame or call it sits in, as the {@link BuiltInFnInfo#frame} bits of the reflective calls it makes (`0` for none).
 * @useInstead {@link FunctionSemantics.frameReflection}
 */
export function reflectiveRolesOf(this: void, definition: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph, { known }: FrameReflectionOptions): ArgProps {
	let roles = 0;
	for(const [node, vertex] of Dataflow.callsIn(definition, graph)) {
		const info = known(vertex.name);
		const frame = info?.frame ?? 0;
		if(frame === 0 || (roles & frame) === frame || handedAnotherFrame(vertex, info)) {
			continue;
		}
		if(!resolvedThroughout(node, definition, graph)) {
			roles |= frame;
		}
	}
	return roles;
}

/** Whether the call was handed the frame to look at ({@link ArgProp.Handle}, as in `environment(g)`). */
function handedAnotherFrame(vertex: DataflowGraphVertexFunctionCall, info: BuiltInFnInfo | undefined): boolean {
	return info?.sig !== undefined && Sig.posWith(Sig.layout(info.sig), vertex.args.length, ArgProp.Handle).length > 0;
}

/** Whether every consumer of what the reflective call at `frame` handed out resolves to a formal, and there is at least one. */
function resolvedThroughout(frame: NodeId, definition: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph): boolean {
	const formals = new Set(Dataflow.parametersOf(definition));
	const carrying = carriersOf(frame, definition, graph);
	let consumers = 0;
	for(const [node, vertex] of Dataflow.callsIn(definition, graph)) {
		const args = argumentIdsOf(vertex);
		if(carrying.has(node) || !args.some(id => carrying.has(id))) {
			continue;
		}
		consumers++;
		if(!resolvedToAFormal(node, args, formals, graph)) {
			return false;
		}
	}
	return consumers > 0;
}

/** Whether the consuming `call` itself, or one of its arguments naming what it looks up by a fixed name, reads a formal. */
function resolvedToAFormal(call: NodeId, args: readonly NodeId[], formals: ReadonlySet<NodeId>, graph: DataflowGraph): boolean {
	const fixed = args.filter(id => isFixedName(id, graph));
	return [call, ...fixed].some(id => Dataflow.targetsOf(graph, id, EdgeType.Reads).some(to => formals.has(to)));
}

function isFixedName(node: NodeId, graph: DataflowGraph): boolean {
	const vertex = graph.getVertex(node);
	return DfgVertex.isValue(vertex) || (DfgVertex.isUse(vertex) && vertex.constantFallback === true);
}

/** Every edge kind that carries a value on to whoever reads it next, for {@link carriersOf}. */
const CarryingEdges = EdgeType.Reads | EdgeType.DefinedBy | EdgeType.Returns | EdgeType.Argument;

/** The nodes carrying what the reflective call handed out: the call itself, the names stored under it, and reads of them. */
function carriersOf(frame: NodeId, definition: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph): Set<NodeId> {
	const body = definition.subflow.graph;
	const carries = new ReachSummaries<NodeId, boolean>(node => {
		const vertex = graph.getVertex(node);
		/* a call reading the frame is what uses it, so it is a consumer rather than another name for it, and carries nothing on */
		return !body.has(node) || node === frame || (DfgVertex.isFunctionCall(vertex) && !passesOn(vertex)) ? [] : Dataflow.targetsOf(graph, node, CarryingEdges);
	}, node => node === frame, Monoid.any);
	return new Set([frame, ...body.values().filter(node => carries.of(node))]);
}

/** Whether the call hands what it was given straight on: storing a frame under a name is no use of it. */
function passesOn(vertex: DataflowGraphVertexFunctionCall): boolean {
	return DfgVertex.hasOrigin(vertex, BuiltInProcName.Assignment) || DfgVertex.hasOrigin(vertex, BuiltInProcName.ExpressionList);
}

/** The nodes a call was handed, whatever way the arguments were written. */
function argumentIdsOf(vertex: DataflowGraphVertexFunctionCall): NodeId[] {
	return vertex.args.filter(FunctionArgument.isNotEmpty)
		.flatMap(a => FunctionArgument.isNamed(a) && a.valueId !== undefined ? [a.nodeId, a.valueId] : [a.nodeId]);
}
