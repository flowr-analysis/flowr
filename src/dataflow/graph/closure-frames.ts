import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { REnvironmentInformation } from '../environments/environment';
import { type BrandedIdentifier, hasEnvState, Identifier, type InGraphIdentifierDefinition } from '../environments/identifier';
import { Resolve } from '../environments/resolve-helper';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { DfEdge, EdgeType } from './edge';
import type { DataflowGraph } from './graph';
import { DfgVertex } from './vertex';
import { Dataflow } from './df-helper';

/** What the frames of the closures one variable holds bind to a name, see {@link InGraphIdentifierDefinition#closureFrame}. */
export interface FrameWrites {
	/** the definitions written into the frames */
	readonly ids:      ReadonlySet<NodeId>
	/** the calls writing them, which a read reaches as well to keep them in a slice */
	readonly writers:  ReadonlySet<NodeId>
	/** whether every closure the variable may hold surely has such a write */
	readonly definite: boolean
}

/** What a read within a closure reads in one call of it, see {@link ClosureFrames.readsInCall}. */
export interface FrameReads {
	/** the writes into the frame of the closure the call runs */
	readonly frames: readonly NodeId[]
	/** whether the read may read `target` it has an edge to, besides the frames */
	readonly keeps:  (target: NodeId) => boolean
}

const NoWrites: FrameWrites = { ids: new Set(), writers: new Set(), definite: false };

/**
 * The frame a closure holds (`environment(g)`) is the one the call creating it ran in, so writes into it reach only the
 * calls of that very closure: they are tracked on the variables holding it (see {@link InGraphIdentifierDefinition#closureFrame}).
 */
export const ClosureFrames = {
	/** What the frames of the closures `holder` holds in `environment` bind to `name`. */
	writesOf(this: void, holder: Identifier, environment: REnvironmentInformation, name: BrandedIdentifier): FrameWrites {
		const holders = Resolve.byName(holder, environment) ?? [];
		const ids = new Set<NodeId>();
		const writers = new Set<NodeId>();
		let definite = holders.length > 0;
		for(const def of holders as readonly InGraphIdentifierDefinition[]) {
			const written = def.closureFrame === true && hasEnvState(def) ? def.envState.current.lookup(name) ?? [] : [];
			for(const w of written) {
				ids.add(w.nodeId);
				writers.add(w.definedAt);
			}
			definite &&= written.some(w => w.cds === undefined);
		}
		return ids.size === 0 ? NoWrites : { ids, writers, definite };
	},
	/** What the frame of the closure the call `call` runs binds to `name`, where it is called. */
	writesAt(this: void, graph: DataflowGraph, call: NodeId, name: BrandedIdentifier): FrameWrites {
		const vertex = graph.getVertex(call);
		return DfgVertex.isFunctionCall(vertex) && vertex.environment !== undefined ? ClosureFrames.writesOf(vertex.name, vertex.environment, name) : NoWrites;
	},
	/** The call context `context` extended by the closures `call` runs whose frames some of their calls see written. */
	contextOf(this: void, graph: DataflowGraph, call: NodeId, context: ReadonlyMap<NodeId, NodeId> | undefined): ReadonlyMap<NodeId, NodeId> | undefined {
		let extended: Map<NodeId, NodeId> | undefined;
		for(const closure of Dataflow.targetsOf(graph, call, EdgeType.Calls)) {
			if(isFramed(graph, closure)) {
				(extended ??= new Map(context)).set(closure, call);
			}
		}
		return extended;
	},
	/**
	 * The calls that created what the bindings `call` reads hold, one per binding, `undefined` if a binding may hold
	 * anything else: two calls with different instances run closures with different frames.
	 */
	instancesOf(this: void, graph: DataflowGraph, call: NodeId): NodeId[] | undefined {
		const instances: NodeId[] = [];
		for(const [binding, edge] of graph.edgesFrom(call)) {
			if(!DfEdge.includesType(edge, EdgeType.Reads) || DfEdge.includesType(edge, EdgeType.Argument) || NodeId.isBuiltIn(binding)) {
				continue;
			}
			const created = DfgVertex.isVariableDefinition(graph.getVertex(binding)) ? Dataflow.targetsOf(graph, binding, EdgeType.DefinedBy).filter(t => {
				const vertex = graph.getVertex(t);
				return DfgVertex.isFunctionCall(vertex) && !DfgVertex.hasOrigin(vertex, BuiltInProcName.Assignment);
			}) : [];
			if(created.length !== 1) {
				return undefined;
			}
			instances.push(created[0]);
		}
		return instances.length > 0 ? instances : undefined;
	},
	/**
	 * Which definitions the read `read` within the closure the context calls may read in that call: of the writes into
	 * the frames of its closure, only those into the frame of the closure this call runs, and none of the bindings the
	 * frame shadows once a write surely binds the name. `undefined` if the context names no call of a closure around it.
	 */
	readsInCall(this: void, read: NodeId, graph: DataflowGraph, idMap: AstIdMap, context: ReadonlyMap<NodeId, NodeId>): FrameReads | undefined {
		const node = idMap.get(read);
		if(!RSymbol.is(node) || !DfgVertex.isUse(graph.getVertex(read)) || !context.keys().some(fn => isFramed(graph, fn))) {
			return undefined;
		}
		let closure: NodeId | undefined;
		let call: NodeId | undefined;
		for(let fn = RNode.strictlyEnclosingFunction(read, idMap); fn !== undefined && call === undefined; fn = RNode.strictlyEnclosingFunction(fn, idMap)) {
			closure = fn;
			call = context.get(fn);
		}
		const body = closure === undefined ? undefined : graph.getVertex(closure);
		if(call === undefined || closure === undefined || !DfgVertex.isFunctionDefinition(body)) {
			return undefined;
		}
		/* a binding in the body is no frame of the closure */
		if(graph.edgesFrom(read).keys().some(t => enclosedBy(t, closure, idMap))) {
			return undefined;
		}
		const name = Identifier.getName(node.content);
		const own = ClosureFrames.writesAt(graph, call, name);
		const instances = ClosureFrames.instancesOf(graph, call);
		const elsewhere = new Set<NodeId>();
		const writers = new Set(own.writers);
		const frames = new Set(own.ids);
		for(const [other, edge] of graph.edgesTo(closure)) {
			if(other === call || !DfEdge.includesType(edge, EdgeType.Calls)) {
				continue;
			}
			const theirs = ClosureFrames.writesAt(graph, other, name);
			if(theirs.ids.size === 0) {
				continue;
			}
			/* the same frame may be written through a variable we do not see, unless the calls create different ones */
			const distinct = instances !== undefined && ClosureFrames.instancesOf(graph, other)?.every(i => !instances.includes(i)) === true;
			for(const id of theirs.ids) {
				(distinct ? elsewhere : frames).add(id);
			}
			theirs.writers.forEach(w => writers.add(w));
		}
		if(writers.size === 0) {
			return undefined;
		}
		return {
			frames: [...frames].filter(f => !elsewhere.has(f)),
			/* the value of a write is what it writes, not the call writing it */
			keeps:  target => !frames.has(target) && !writers.has(target) && !elsewhere.has(target) && !(own.definite && shadowedBy(target, closure, idMap))
		};
	}
} as const;

function isFramed(graph: DataflowGraph, id: NodeId): boolean {
	const vertex = graph.getVertex(id);
	return DfgVertex.isFunctionDefinition(vertex) && vertex.framed === true;
}

function enclosedBy(id: NodeId, fn: NodeId, idMap: AstIdMap): boolean {
	return RNode.findEnclosing(id, idMap, n => n.info.id === fn) !== undefined;
}

/** Whether the frame of the closure `closure` shadows the binding `target`, made in the scope it was created in or one around it. */
function shadowedBy(target: NodeId, closure: NodeId, idMap: AstIdMap): boolean {
	const scope = RNode.strictlyEnclosingFunction(target, idMap);
	return scope === undefined || (scope !== closure && enclosedBy(closure, scope, idMap));
}
