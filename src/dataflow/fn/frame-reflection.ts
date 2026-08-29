import type { DataflowGraph } from '../graph/graph';
import { FunctionArgument } from '../graph/graph';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { DfEdge, EdgeType } from '../graph/edge';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition } from '../graph/vertex';
import { Vertex } from '../graph/vertex';
import type { ArgProps, BuiltInFnInfo } from '../environments/built-in-props';
import { ArgProp, FnSig as Sig } from '../environments/built-in-props';
import type { Identifier } from '../environments/identifier';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RConstant } from '../../r-bridge/lang-4.x/ast/model/model';
import { DefaultMap } from '../../util/collections/defaultmap';

/** What flowR states about the built-in a call names, see {@link BuiltInFnInfo}. */
export type BuiltInLookup = (name: Identifier) => BuiltInFnInfo | undefined;

/** The nodes at the far end of `node`'s outgoing edges of any of `types`, shared by every walk here and in the sibling analyses that follow specific edge kinds. */
export function edgeTargets(this: void, graph: DataflowGraph, node: NodeId, types: EdgeType): NodeId[] {
	return [...graph.edgesFrom(node)].filter(([, edge]) => DfEdge.includesType(edge, types)).map(([target]) => target);
}

/** The calls a definition's body reaches, id and vertex paired; shared by every walk here and in the sibling analyses that visit them all. */
export function* callsIn(definition: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph): Generator<[NodeId, DataflowGraphVertexFunctionCall]> {
	for(const node of definition.subflow.graph) {
		const vertex = graph.getVertex(node);
		if(Vertex.isFunctionCall(vertex)) {
			yield [node, vertex];
		}
	}
}

/**
 * Recomputes `recompute(id)` for every node reachable from `seed` along the reverse of `successors`, so a
 * change at a node is carried on to whatever points at it, until nothing grows anymore. `recompute` updates
 * its node's value itself and reports whether it grew; shared by {@link propagateOverCalls} and
 * {@link calculateExceptionsOfFunction}, which differ only in what "grew" means for the value they carry, and
 * by {@link carriersOf} below, which grows a set rather than a bitfield.
 */
export function propagateToFixpoint(seed: Iterable<NodeId>, successors: ReadonlyMap<NodeId, readonly NodeId[]>, recompute: (id: NodeId) => boolean): void {
	const callers = new DefaultMap<NodeId, NodeId[]>(() => []);
	for(const [id, next] of successors) {
		for(const to of next) {
			callers.get(to).push(id);
		}
	}
	const pending = [...seed];
	const queued = new Set<NodeId>(pending);
	while(pending.length > 0) {
		const id = pending.pop() as NodeId;
		queued.delete(id);
		if(!recompute(id)) {
			continue;
		}
		for(const caller of callers.get(id)) {
			if(!queued.has(caller)) {
				queued.add(caller);
				pending.push(caller);
			}
		}
	}
}

/** What to ask for beyond the definition itself, see {@link reflectiveRolesOf}. */
export interface FrameReflectionOptions {
	/** what flowR states about a built-in, answered once per name */
	readonly known: BuiltInLookup
}

/**
 * What `definition`'s body reaches about its own formals through the frame or call it sits in, as the
 * {@link BuiltInFnInfo#frame} bits of the reflective calls it makes (`0` for none). `get("x", envir = e)` and
 * `e$x` are followed to the name directly; `as.list(environment())` and a frame handed elsewhere mean any formal.
 * @useInstead {@link Fn.frameReflection}
 */
export function reflectiveRolesOf(this: void, definition: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph, { known }: FrameReflectionOptions): ArgProps {
	let roles = 0;
	for(const [node, vertex] of callsIn(definition, graph)) {
		const frame = known(vertex.name)?.frame ?? 0;
		if(frame === 0 || (roles & frame) === frame || handedAnotherFrame(vertex, known)) {
			continue;
		}
		if(!resolvedThroughout(node, definition, graph)) {
			roles |= frame;
		}
	}
	return roles;
}


/**
 * What `definition`'s body reaches about its own formals through the frame or call it sits in, as the
 * {@link BuiltInFnInfo#frame} bits of the reflective calls it makes (`0` for none). `get("x", envir = e)` and
 * `e$x` are followed to the name directly; `as.list(environment())` and a frame handed elsewhere mean any formal.
 * @deprecated use {@link reflectiveRolesOf} instead
 */
export function reflectiveRoles(definition: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph, known: BuiltInLookup): ArgProps {
	return reflectiveRolesOf(definition, graph, { known });
}

/** Whether the call was handed the frame to look at ({@link ArgProp.Handle}, as in `environment(g)`). */
function handedAnotherFrame(vertex: DataflowGraphVertexFunctionCall, known: BuiltInLookup): boolean {
	const sig = known(vertex.name)?.sig;
	return sig !== undefined && Sig.posWith(Sig.layout(sig), vertex.args.length, ArgProp.Handle).length > 0;
}

/** Whether every consumer of what the reflective call at `frame` handed out resolves to a formal, and there is at least one. */
function resolvedThroughout(frame: NodeId, definition: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph): boolean {
	const formals = new Set(Object.keys(definition.params).map(NodeId.normalize));
	const carrying = carriersOf(frame, definition, graph);
	let consumers = 0;
	for(const node of definition.subflow.graph) {
		const vertex = graph.getVertex(node);
		if(!Vertex.isFunctionCall(vertex) || carrying.has(node) || !consumes(vertex, carrying)) {
			continue;
		}
		consumers++;
		if(!resolvedToAFormal(vertex, formals, graph)) {
			return false;
		}
	}
	return consumers > 0;
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
		successors.set(node, Vertex.isFunctionCall(vertex) && !passesOn(vertex) ? [] : edgeTargets(graph, node, CarryingEdges));
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

/** Whether one of the call's arguments is the value the reflective call handed out. */
function consumes(vertex: DataflowGraphVertexFunctionCall, carrying: ReadonlySet<NodeId>): boolean {
	return argumentsOf(vertex).some(id => carrying.has(id));
}

/** The nodes a call was handed, whatever way the arguments were written. */
function argumentsOf(vertex: DataflowGraphVertexFunctionCall): NodeId[] {
	const ids: NodeId[] = [];
	for(const argument of vertex.args) {
		if(typeof argument === 'object' && 'nodeId' in argument) {
			ids.push(argument.nodeId);
			if(FunctionArgument.isNamed(argument) && argument.valueId !== undefined) {
				ids.push(argument.valueId);
			}
		}
	}
	return ids;
}

/** Whether the access reads a formal directly, or via the constant naming it (`get("x", ...)`); a computed name (`get(nm, ...)`) does not. */
function resolvedToAFormal(vertex: DataflowGraphVertexFunctionCall, formals: ReadonlySet<NodeId>, graph: DataflowGraph): boolean {
	const idMap = graph.idMap;
	for(const node of [vertex.id, ...argumentsOf(vertex)]) {
		if(node !== vertex.id && !RConstant.is(idMap?.get(node))) {
			continue;
		}
		if(edgeTargets(graph, node, EdgeType.Reads).some(to => formals.has(to))) {
			return true;
		}
	}
	return false;
}
