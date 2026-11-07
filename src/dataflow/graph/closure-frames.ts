import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { REnvironment, type REnvironmentInformation } from '../environments/environment';
import { anyRemovalMarker, removalMarkerOf } from '../environments/removal-marker';
import { type BrandedIdentifier, hasEnvState, Identifier, type IdentifierDefinition, type InGraphIdentifierDefinition } from '../environments/identifier';
import { Resolve } from '../environments/resolve-helper';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { DfEdge, EdgeType } from './edge';
import type { DataflowGraph } from './graph';
import { DfgVertex } from './vertex';
import { Dataflow } from './df-helper';
import { ProgramOrder } from '../internal/program-order';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';

/** What the frames of the closures one variable holds bind to a name, see {@link InGraphIdentifierDefinition#closureFrame}. */
export interface FrameWrites {
	/** the definitions written into the frames */
	readonly ids:      ReadonlySet<NodeId>
	/** the calls writing them, which a read reaches as well to keep them in a slice */
	readonly writers:  ReadonlySet<NodeId>
	/** whether every closure the variable may hold surely has such a write */
	readonly definite: boolean
	/** each definition with the call writing it and whether it surely does */
	readonly entries:  readonly FrameWrite[]
}

/** A definition written into the frame of a closure by the call `by`, which `definite` surely makes. */
interface FrameWrite {
	readonly id:       NodeId
	readonly by:       NodeId
	readonly definite: boolean
}

/** What a read within a closure reads in one call of it, see {@link ClosureFrames.readsInCall}. */
export interface FrameReads {
	/** the writes into the frame of the closure the call runs */
	readonly frames:   readonly NodeId[]
	/** whether the read may read `target` it has an edge to, besides the frames */
	readonly keeps:    (target: NodeId) => boolean
	/** the writes a later one surely replaces before the call, which no write the read reaches leads back to */
	readonly replaced: ReadonlySet<NodeId>
}

const NoWrites: FrameWrites = { ids: new Set(), writers: new Set(), definite: false, entries: [] };

/**
 * The frame a closure holds (`environment(g)`) is the one the call creating it ran in, so writes into it reach only the
 * calls of that very closure: they are tracked on the variables holding it (see {@link InGraphIdentifierDefinition#closureFrame}).
 */
export const ClosureFrames = {
	/**
	 * What the frames of the closures `holder` holds in `environment` bind to `name`. A frame of the closure `closure`
	 * that `name` was removed from (`rm("v", envir = environment(g))`) binds what the frames around it bind, see {@link boundAround}.
	 */
	writesOf(this: void, holder: Identifier, environment: REnvironmentInformation, name: BrandedIdentifier, closure: NodeId, graph: DataflowGraph): FrameWrites {
		const holders = Resolve.byName(holder, environment) ?? [];
		const ids = new Set<NodeId>();
		const writers = new Set<NodeId>();
		const entries: FrameWrite[] = [];
		let definite = holders.length > 0;
		for(const def of holders as readonly InGraphIdentifierDefinition[]) {
			const frame = def.closureFrame === true && hasEnvState(def) ? def.envState : undefined;
			const written = frame?.current.lookup(name) ?? [];
			const removals = frame === undefined || !anyRemovalMarker(name) ? [] : frame.current.memory.get(removalMarkerOf(name)) ?? [];
			for(const w of written) {
				ids.add(w.nodeId);
				writers.add(w.definedAt);
				entries.push({ id: w.nodeId, by: w.definedAt, definite: w.cds === undefined && holders.length === 1 });
			}
			if(removals.length > 0) {
				removals.forEach(r => writers.add(r.nodeId));
				for(const outer of boundAround(closure, graph, environment, name) ?? []) {
					if(!NodeId.isBuiltIn(outer.nodeId)) {
						ids.add(outer.nodeId);
					}
				}
			}
			definite &&= written.some(w => w.cds === undefined) || removals.some(r => r.cds === undefined);
		}
		return writers.size === 0 ? NoWrites : { ids, writers, definite, entries };
	},
	/** What the frame of the closure `closure` the call `call` runs binds to `name`, where it is called. */
	writesAt(this: void, graph: DataflowGraph, call: NodeId, name: BrandedIdentifier, closure: NodeId): FrameWrites {
		const vertex = graph.getVertex(call);
		return DfgVertex.isFunctionCall(vertex) && vertex.environment !== undefined ? ClosureFrames.writesOf(vertex.name, vertex.environment, name, closure, graph) : NoWrites;
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
			const created = creatorOf(graph, binding, new Set());
			if(created === undefined) {
				return undefined;
			}
			instances.push(created);
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
		const own = ClosureFrames.writesAt(graph, call, name, closure);
		const instances = ClosureFrames.instancesOf(graph, call);
		const elsewhere = new Set<NodeId>();
		const writers = new Set(own.writers);
		const frames = new Set(own.ids);
		for(const [other, edge] of graph.edgesTo(closure)) {
			if(other === call || !DfEdge.includesType(edge, EdgeType.Calls)) {
				continue;
			}
			const theirs = ClosureFrames.writesAt(graph, other, name, closure);
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
		const overwritten = overwrittenBefore(read, call, closure, own, graph, idMap);
		return {
			frames:   [...frames].filter(f => !elsewhere.has(f) && !overwritten.has(f)),
			/* the value of a write is what it writes, not the call writing it */
			keeps:    target => !frames.has(target) && !writers.has(target) && !elsewhere.has(target) && !overwritten.has(target) && !(own.definite && shadowedBy(target, closure, idMap)),
			replaced: overwritten
		};
	}
} as const;

/**
 * The call that created what `id` holds: the call a variable is defined by, through accesses of what holds it
 * (`g <- o$get` with `o <- mk()` holds what `mk()` created), `undefined` if that is not one call.
 */
function creatorOf(graph: DataflowGraph, id: NodeId, seen: Set<NodeId>): NodeId | undefined {
	const vertex = graph.getVertex(id);
	if(seen.has(id) || vertex === undefined) {
		return undefined;
	}
	seen.add(id);
	if(DfgVertex.isVariableDefinition(vertex)) {
		const created = Dataflow.targetsOf(graph, id, EdgeType.DefinedBy).filter(t => {
			const by = graph.getVertex(t);
			return DfgVertex.isFunctionCall(by) && !DfgVertex.hasOrigin(by, BuiltInProcName.Assignment);
		});
		return created.length === 1 ? creatorOf(graph, created[0], seen) : undefined;
	} else if(!DfgVertex.isFunctionCall(vertex)) {
		return undefined;
	} else if(!DfgVertex.hasOrigin(vertex, BuiltInProcName.Access)) {
		return id;
	}
	const [accessed] = vertex.args;
	const held = accessed === undefined || accessed === EmptyArgument ? [] : Dataflow.targetsOf(graph, accessed.nodeId, EdgeType.Reads);
	return held.length === 1 ? creatorOf(graph, held[0], seen) : undefined;
}

/**
 * The writes the read `read` in the closure `closure` that `call` runs may see but which do not reach it: a write
 * into its frame (`assign("v", 4, envir = environment(g))`), a super assignment of a closure created by the same call
 * (`set <- function() v <<- 5`), and what the scope binds itself, each replaced by a later one that surely writes the
 * frame before `call` (ordered by the top-level calls making them), and the super assignments only closures created by
 * other calls make, which write other frames.
 */
function overwrittenBefore(read: NodeId, call: NodeId, closure: NodeId, own: FrameWrites, graph: DataflowGraph, idMap: AstIdMap): ReadonlySet<NodeId> {
	const at = ProgramOrder.runsOnceAt(call, graph);
	const instances = ClosureFrames.instancesOf(graph, call);
	if(at === undefined || instances?.length !== 1) {
		return new Set();
	}
	const scope = RNode.strictlyEnclosingFunction(closure, idMap);
	const targets = Dataflow.targetsOf(graph, read, EdgeType.Reads);
	/* a super assignment binds in the frame of the creating call only if that frame surely binds the name */
	const bound = scope !== undefined && targets.some(t => RNode.strictlyEnclosingFunction(t, idMap) === scope && graph.getVertex(t)?.cds === undefined && !superAssigned(t, graph));
	const writes: FrameWrite[] = [...own.entries];
	const elsewhere = new Set<NodeId>();
	for(const target of bound ? targets : []) {
		/* the call creating the frame made what the scope binds itself */
		if(RNode.strictlyEnclosingFunction(target, idMap) === scope && !superAssigned(target, graph)) {
			writes.push({ id: target, by: instances[0], definite: graph.getVertex(target)?.cds === undefined });
			continue;
		}
		const sibling = RNode.strictlyEnclosingFunction(target, idMap);
		if(sibling === undefined || sibling === closure || RNode.strictlyEnclosingFunction(sibling, idMap) !== scope || !superAssigned(target, graph)) {
			continue;
		}
		const surely = graph.getVertex(target)?.cds === undefined;
		let calls = 0;
		let other = true;
		for(const [by, edge] of graph.edgesTo(sibling)) {
			if(DfEdge.includesType(edge, EdgeType.Calls) && DfgVertex.isFunctionCall(graph.getVertex(by))) {
				calls++;
				const same = ClosureFrames.instancesOf(graph, by);
				/* a closure created by another call writes another frame */
				if(same?.length === 1 && same[0] !== instances[0]) {
					continue;
				}
				other = false;
				writes.push({ id: target, by, definite: surely && graph.getVertex(by)?.cds === undefined && same?.length === 1 });
			}
		}
		if(other && calls > 0) {
			elsewhere.add(target);
		}
	}
	/* how many statements before the call the write is made, if it is made once at the top level */
	const before = (w: FrameWrite) => ProgramOrder.runsOnceAt(w.by, graph) === undefined ? undefined : -ProgramOrder.offset(w.by, at, graph);
	let last: FrameWrite | undefined;
	for(const w of writes) {
		const distance = before(w);
		if(w.definite && distance !== undefined && distance > 0 && (last === undefined || distance < (before(last) ?? 0))) {
			last = w;
		}
	}
	const lastAt = last === undefined ? undefined : ProgramOrder.runsOnceAt(last.by, graph);
	if(last === undefined || lastAt === undefined) {
		return elsewhere;
	}
	const replaced = (w: FrameWrite) => ProgramOrder.runsOnceAt(w.by, graph) !== undefined && ProgramOrder.offset(w.by, lastAt, graph) < 0;
	for(const w of writes) {
		if(w.id !== last.id && writes.every(o => o.id !== w.id || replaced(o))) {
			elsewhere.add(w.id);
		}
	}
	return elsewhere;
}

/** Whether the definition `id` is made by a super assignment (`v <<- 5`). */
function superAssigned(id: NodeId, graph: DataflowGraph): boolean {
	return Dataflow.targetsOf(graph, id, EdgeType.DefinedBy).some(t => DfgVertex.hasOrigin(graph.getVertex(t), BuiltInProcName.SuperAssignment));
}

/**
 * What the frames around the frame of `closure` bind to `name` once `environment` calls it: those of the functions around
 * the one that made the frame as it left them, and the global frame as it is at the call.
 */
function boundAround(closure: NodeId, graph: DataflowGraph, environment: REnvironmentInformation, name: BrandedIdentifier): readonly IdentifierDefinition[] | undefined {
	const maker = graph.idMap === undefined ? undefined : RNode.strictlyEnclosingFunction(closure, graph.idMap);
	const made = maker === undefined ? undefined : graph.getVertex(maker);
	if(DfgVertex.isFunctionDefinition(made)) {
		let frame = made.subflow.environment.current.parent;
		for(let level = made.subflow.environment.level - 1; level > 0 && frame !== undefined; level--, frame = frame.parent) {
			/* the body of a function sees the frames around it emptied, standing in for what they bound */
			const bound = frame.lookup(name) ?? frame.superMemory?.get(name);
			if(bound !== undefined) {
				return bound;
			}
		}
	}
	return Resolve.byName(name, REnvironment.visibleTo(1, environment));
}

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
