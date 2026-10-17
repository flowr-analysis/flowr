import type { DataflowGraph } from '../graph/graph';
import { FunctionArgument } from '../graph/graph';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { DfEdge, EdgeType } from '../graph/edge';
import { Dataflow } from '../graph/df-helper';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition } from '../graph/vertex';
import { DfgVertex, VertexType } from '../graph/vertex';
import type { ArgProps, BuiltInFnInfo } from '../environments/built-in-props';
import { ArgProp, FnSig as Sig } from '../environments/built-in-props';
import type { Identifier } from '../environments/identifier';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

/** What flowR states about the built-in a call names, see {@link BuiltInFnInfo}. */
export type BuiltInLookup = (name: Identifier) => BuiltInFnInfo | undefined;

/** What to ask for beyond the definition itself, see {@link reflectiveRolesOf}. */
export interface FrameReflectionOptions {
	/** what flowR states about a built-in, answered once per name */
	readonly known: BuiltInLookup
}

/**
 * What `definition`'s body reaches about its own formals through the frame or call it sits in, as the
 * {@link BuiltInFnInfo#frame} bits of the reflective calls it makes (`0` for none). `get("x", envir = e)` and
 * `e$x` are followed to the name directly; `as.list(environment())` and a frame handed elsewhere mean any formal.
 * @useInstead {@link FunctionSemantics.frameReflection}
 */
export function reflectiveRolesOf(this: void, definition: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph, { known }: FrameReflectionOptions): ArgProps {
	let roles = 0;
	for(const [node, vertex] of callsIn(definition, graph)) {
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
	for(const [node, vertex] of callsIn(definition, graph)) {
		const args = argumentsOf(vertex);
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
	return [call, ...fixed].some(id => edgeTargets(graph, id, EdgeType.Reads).some(to => formals.has(to)));
}

function isFixedName(node: NodeId, graph: DataflowGraph): boolean {
	const vertex = graph.getVertex(node);
	return DfgVertex.isValue(vertex) || (DfgVertex.isUse(vertex) && vertex.constantFallback === true);
}

/** Every edge kind that carries a value on to whoever reads it next, for {@link carriersOf}. */
const CarryingEdges = EdgeType.Reads | EdgeType.DefinedBy | EdgeType.Returns | EdgeType.Argument;

/** The nodes carrying what the reflective call handed out: the call itself, the names stored under it, and reads of them. */
function carriersOf(frame: NodeId, definition: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph): Set<NodeId> {
	const carrying = new Set<NodeId>([frame]);
	const successors = new Map<NodeId, readonly NodeId[]>();
	for(const node of definition.subflow.graph) {
		const vertex = graph.getVertex(node);
		/* a call reading the frame is what uses it, so it is a consumer rather than another name for it, and carries nothing on */
		successors.set(node, DfgVertex.isFunctionCall(vertex) && !passesOn(vertex) ? [] : edgeTargets(graph, node, CarryingEdges));
	}
	propagateToFixpoint(successors.keys(), successors, id => {
		if(carrying.has(id) || !(successors.get(id) ?? []).some(to => carrying.has(to))) {
			return false;
		}
		carrying.add(id);
		return true;
	});
	return carrying;
}

/** Whether the call hands what it was given straight on: storing a frame under a name is no use of it. */
function passesOn(vertex: DataflowGraphVertexFunctionCall): boolean {
	return vertex.origin.includes(BuiltInProcName.Assignment) || vertex.origin.includes(BuiltInProcName.ExpressionList);
}

/** The nodes a call was handed, whatever way the arguments were written. */
function argumentsOf(vertex: DataflowGraphVertexFunctionCall): NodeId[] {
	return vertex.args.filter(FunctionArgument.isNotEmpty)
		.flatMap(a => FunctionArgument.isNamed(a) && a.valueId !== undefined ? [a.nodeId, a.valueId] : [a.nodeId]);
}
