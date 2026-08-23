import type { DataflowGraph } from '../graph/graph';
import { FunctionArgument, NoEdges } from '../graph/graph';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { DfEdge, EdgeType } from '../graph/edge';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition } from '../graph/vertex';
import { FunctionCallVertex } from '../graph/vertex';
import type { ArgProps, BuiltInFnInfo } from '../environments/built-in-props';
import { ArgProp, FnSig as Sig } from '../environments/built-in-props';
import type { Identifier } from '../environments/identifier';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RConstant } from '../../r-bridge/lang-4.x/ast/model/model';

/** What flowR states about the built-in a call names, see {@link BuiltInFnInfo}. */
export type BuiltInLookup = (name: Identifier) => BuiltInFnInfo | undefined;

/**
 * What the body of `definition` reaches about its own formals through the frame or the call it sits in, as the
 * {@link BuiltInFnInfo#frame} bits of the reflective calls it makes (`0` when it makes none).
 *
 * Only reflection flowR loses track of counts. `get("x", envir = e)` and `e$x` are followed to the name they
 * read, so they draw their own edges and the formals they reach need nothing added here; `as.list(environment())`,
 * `get(nm, envir = e)` and a frame handed on to someone else are the cases where any formal may be meant, and
 * `environment(g)` speaks about another function's frame altogether.
 */
export function reflectiveRoles(definition: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph, known: BuiltInLookup): ArgProps {
	let roles = 0;
	for(const node of definition.subflow.graph) {
		const vertex = graph.getVertex(node);
		if(!FunctionCallVertex.is(vertex)) {
			continue;
		}
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

/** Whether the call was handed the frame to look at ({@link ArgProp.Handle}, as in `environment(g)`). */
function handedAnotherFrame(vertex: DataflowGraphVertexFunctionCall, known: BuiltInLookup): boolean {
	const sig = known(vertex.name)?.sig;
	return sig !== undefined && Sig.posWith(Sig.layout(sig), vertex.args.length, ArgProp.Handle).length > 0;
}

/**
 * Whether everything done with what the reflective call at `frame` handed out is something flowR followed: at
 * least one consumer, and every one of them an access it resolved to a name of the definition. A frame nobody
 * consumes was handed to the caller, which is as good as lost.
 */
function resolvedThroughout(frame: NodeId, definition: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph): boolean {
	const formals = new Set(Object.keys(definition.params).map(NodeId.normalize));
	const carrying = carriersOf(frame, definition, graph);
	let consumers = 0;
	for(const node of definition.subflow.graph) {
		const vertex = graph.getVertex(node);
		if(!FunctionCallVertex.is(vertex) || carrying.has(node) || !consumes(vertex, carrying)) {
			continue;
		}
		consumers++;
		if(!resolvedToAFormal(vertex, formals, graph)) {
			return false;
		}
	}
	return consumers > 0;
}

/**
 * The nodes carrying what the reflective call handed out: the call itself, the names it was stored under, and
 * the uses reading them. Storing a frame and reading it back is no use of it, so the assignment and the
 * expression list around it carry the value on rather than consuming it.
 */
function carriersOf(frame: NodeId, definition: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph): Set<NodeId> {
	const carrying = new Set<NodeId>([frame]);
	let grew = true;
	while(grew) {
		grew = false;
		for(const node of definition.subflow.graph) {
			if(carrying.has(node)) {
				continue;
			}
			const vertex = graph.getVertex(node);
			if(FunctionCallVertex.is(vertex) && !passesOn(vertex)) {
				/* a call reading the frame is what uses it, so it is a consumer rather than another name for it */
				continue;
			}
			for(const [to, edge] of graph.outgoingEdges(node) ?? NoEdges) {
				if(carrying.has(to) && DfEdge.includesType(edge, EdgeType.Reads | EdgeType.DefinedBy | EdgeType.Returns | EdgeType.Argument)) {
					carrying.add(node);
					grew = true;
					break;
				}
			}
		}
	}
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

/**
 * Whether the access was followed to a formal of the definition, which is what `get("x", envir = e)` and `e$x`
 * leave behind: a read of the formal from the call itself or from the constant naming it. A name the code works
 * out for itself (`get(nm, envir = e)`) reads its own variable instead, and reaches whichever name it pleases.
 */
function resolvedToAFormal(vertex: DataflowGraphVertexFunctionCall, formals: ReadonlySet<NodeId>, graph: DataflowGraph): boolean {
	const idMap = graph.idMap;
	for(const node of [vertex.id, ...argumentsOf(vertex)]) {
		if(node !== vertex.id && !RConstant.is(idMap?.get(node))) {
			continue;
		}
		for(const [to, edge] of graph.outgoingEdges(node) ?? NoEdges) {
			if(formals.has(to) && DfEdge.includesType(edge, EdgeType.Reads)) {
				return true;
			}
		}
	}
	return false;
}
