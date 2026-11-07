import type { DataflowGraph } from '../graph/graph';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { DfEdge, EdgeType } from '../graph/edge';
import { type DataflowGraphVertexFunctionCall, type DataflowGraphVertexFunctionDefinition, DfgVertex, VertexType } from '../graph/vertex';
import { Dataflow } from '../graph/df-helper';
import { FunctionSemantics } from '../fn/function-semantics';
import type { FlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import {
	type ClassFlowInfo, nextS4Methods, s3Dispatch, s3DispatchClassesOf, type S4Hierarchy, s4ActualClasses, s4CandidatesFor,
	s4DispatchFormals, s4HierarchyOf, type S4Method, s4MethodsOf, selectS4Methods, signatureFor
} from '../fn/dispatch';
import { getAllLinkedFunctionDefinitions } from './linker';

/** What the dispatch of one call rules out, and what the next-method calls of the methods it runs may run. */
export interface NarrowedDispatch {
	/** the method definitions the call cannot run */
	readonly excluded: ReadonlySet<NodeId>
	/** per method, the methods a `NextMethod()`/`callNextMethod()` within it may run; a method missing here may run any */
	readonly next:     ReadonlyMap<NodeId, readonly NodeId[]>
}

/** What the narrowing of the calls of one linking pass shares: the S4 methods of the program and its class hierarchy, found once. */
export class DispatchNarrower {
	private readonly info:  ClassFlowInfo;
	private readonly graph: DataflowGraph;
	private s4State?:       { readonly methods: ReadonlyMap<string, readonly S4Method[]>, readonly byFunction: ReadonlyMap<NodeId, readonly S4Method[]>, readonly hierarchy: S4Hierarchy };
	private registers?:     boolean;

	constructor(graph: DataflowGraph, ctx: FlowrAnalyzerContext) {
		this.graph = graph;
		this.info = { graph, idMap: graph.idMap as AstIdMap, ctx };
	}

	private s4Info() {
		if(this.s4State === undefined) {
			const methods = s4MethodsOf(this.graph, ids => linkedFunctionIds(ids, this.graph));
			const byFunction = new Map<NodeId, S4Method[]>();
			for(const method of methods.values().flatMap(m => m)) {
				for(const fn of method.functions) {
					byFunction.set(fn, [...byFunction.get(fn) ?? [], method]);
				}
			}
			this.s4State = { methods, byFunction, hierarchy: s4HierarchyOf(this.graph) };
		}
		return this.s4State;
	}

	/** Whether one of `targets` is a method the program registers with `setMethod`, so that the call dispatches on S4 classes. */
	public reachesS4Method(targets: Iterable<NodeId>): boolean {
		this.registers ??= this.graph.verticesOfType(VertexType.FunctionCall).some(([, v]) => v.s4Method !== undefined);
		if(!this.registers) {
			return false;
		}
		const { byFunction } = this.s4Info();
		for(const target of targets) {
			if(byFunction.has(target)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * The methods among `targets` the S4 dispatch of `call` (a call of `name`) cannot run for the classes of its arguments,
	 * and the methods `callNextMethod()` in each method may run, `undefined` if nothing can be narrowed.
	 */
	public s4(call: DataflowGraphVertexFunctionCall, name: string, targets: ReadonlySet<NodeId>, registeredLater: (registration: NodeId) => boolean): NarrowedDispatch | undefined {
		const { methods, byFunction, hierarchy } = this.s4Info();
		/* only the methods registered where the call runs compete, one registered after a call at the top level does not */
		const all = s4CandidatesFor(name, methods);
		const candidates = all?.filter(m => !registeredLater(m.registration) && m.functions.some(f => targets.has(f)));
		if(all === undefined || candidates === undefined) {
			return undefined;
		}
		const generics = [...targets].filter(t => !byFunction.has(t) && DfgVertex.isFunctionDefinition(this.graph.getVertex(t)) && (this.graph.getVertex(t) as DataflowGraphVertexFunctionDefinition).mode?.includes('s4'));
		const formals = generics.length <= 1 ? s4DispatchFormals(generics[0], candidates, this.info.idMap) : undefined;
		/* a signature naming a formal the generic does not dispatch on is not understood, so nothing is ruled out */
		if(formals === undefined || formals.length === 0 || candidates.some(m => signatureFor(m, formals) === undefined)) {
			return undefined;
		}
		/* what is no method, like the function a generic was made from, is the default a next method may fall back to */
		const others = this.otherFunctions(targets, t => byFunction.has(t));
		const next = new Map<NodeId, readonly NodeId[]>();
		for(const method of candidates) {
			const reached = [...nextS4Methods(method, candidates, formals, hierarchy).flatMap(m => m.functions), ...others];
			for(const fn of method.functions) {
				next.set(fn, [...next.get(fn) ?? [], ...reached]);
			}
		}
		const bound = boundArguments(call, formals, this.info.idMap);
		const tuples = bound === undefined ? undefined : s4ActualClasses(bound, this.info);
		if(tuples === undefined) {
			return { excluded: new Set(), next };
		}
		const selected = new Set(tuples.flatMap(actual => selectS4Methods(candidates, formals, actual, hierarchy)).flatMap(m => m.functions));
		return { excluded: new Set(all.flatMap(m => m.functions).filter(fn => !selected.has(fn) && targets.has(fn))), next };
	}

	/**
	 * The `<prefix>.<class>` methods among `targets` an S3 dispatch on the object `object` cannot run, and what `NextMethod()`
	 * in each method it runs may run, `undefined` if the class of the object is not known.
	 */
	public s3(object: NodeId | readonly (readonly string[])[], prefixes: readonly string[], targets: ReadonlySet<NodeId>): NarrowedDispatch | undefined {
		const classes = typeof object === 'object' ? object : s3DispatchClassesOf(object, this.info);
		if(classes === undefined) {
			return undefined;
		}
		const methodOf = (fn: NodeId) => s3ClassOfMethod(fn, prefixes, this.graph);
		const methods = [...targets].filter(t => methodOf(t) !== undefined);
		const { runs, next } = s3Dispatch(classes, methods, methodOf);
		const others = this.otherFunctions(targets, t => methodOf(t) !== undefined);
		return { excluded: new Set(methods.filter(m => !runs.has(m))), next: new Map(next.entries().map(([m, after]) => [m, [...after, ...others]])) };
	}

	/** The function definitions among `targets` that are no method by `isMethod`. */
	private otherFunctions(targets: ReadonlySet<NodeId>, isMethod: (fn: NodeId) => boolean): NodeId[] {
		return [...targets].filter(t => !isMethod(t) && DfgVertex.isFunctionDefinition(this.graph.getVertex(t)));
	}
}

/** The class the function `fn` is the S3 method of, for one of the generics `prefixes`, `undefined` unless every name it is bound to says the same. */
function s3ClassOfMethod(fn: NodeId, prefixes: readonly string[], graph: DataflowGraph): string | undefined {
	let cls: string | undefined;
	for(const def of Dataflow.sourcesOf(graph, fn, EdgeType.DefinedBy)) {
		const name = NodeId.recoverName(def, graph.idMap);
		const prefix = name === undefined ? undefined : prefixes.find(p => name.startsWith(p + '.'));
		const of = prefix === undefined ? undefined : name?.slice(prefix.length + 1);
		if(of === undefined || (cls !== undefined && cls !== of)) {
			return undefined;
		}
		cls = of;
	}
	return cls;
}

/** Per formal, the argument `call` binds to it, `undefined` for none; `undefined` overall if the call hands on `...` or binds several. */
function boundArguments(call: DataflowGraphVertexFunctionCall, formals: readonly string[], idMap: AstIdMap): (NodeId | undefined)[] | undefined {
	if(call.args.some(a => a !== EmptyArgument && RSymbol.is(RArgument.valueOf(idMap.get(a.nodeId))) && RArgument.valueOf(idMap.get(a.nodeId))?.lexeme === '...')) {
		return undefined;
	}
	const spec = FunctionSemantics.call.match.toSpec(call.args, Object.fromEntries(formals.map(f => [f, f])));
	const bound = formals.map(f => spec.get(f));
	return bound.every(b => b === undefined || b.length <= 1) ? bound.map(b => b?.[0]) : undefined;
}

/** The function definitions the definitions or reads `ids` lead to. */
export function linkedFunctionIds(ids: ReadonlySet<NodeId>, graph: DataflowGraph): NodeId[] {
	return getAllLinkedFunctionDefinitions(ids, graph)[0].values().map(d => d.id).toArray();
}

/**
 * Removes what linking `call` to the method definitions `excluded` added: the call, the returns, the arguments bound
 * to their parameters, the reads of the definitions registering only them, and what only their bodies read on the call.
 */
export function unlinkExcludedMethods(graph: DataflowGraph, call: DataflowGraphVertexFunctionCall, excluded: ReadonlySet<NodeId>): void {
	const id = call.id;
	for(const fn of excluded) {
		const vertex = graph.getVertex(fn);
		if(!DfgVertex.isFunctionDefinition(vertex)) {
			continue;
		}
		graph.removeEdgeType(id, fn, EdgeType.Calls);
		for(const exit of vertex.exitPoints) {
			graph.removeEdgeType(id, exit.nodeId, EdgeType.Returns);
		}
		const definition = graph.idMap?.get(fn);
		for(const param of RFunctionDefinition.is(definition) ? definition.parameters : []) {
			for(const arg of call.args) {
				if(arg !== EmptyArgument) {
					graph.removeEdgeType(arg.nodeId, param.name.info.id, EdgeType.DefinesOnCall);
					graph.removeEdgeType(param.name.info.id, arg.nodeId, EdgeType.DefinedByOnCall);
				}
			}
		}
	}
	const definitions = (ids: Iterable<NodeId>) => [...ids].map(t => graph.getVertex(t)).filter(v => DfgVertex.isFunctionDefinition(v)) as DataflowGraphVertexFunctionDefinition[];
	const kept = definitions(Dataflow.targetsOf(graph, id, EdgeType.Calls));
	const removed = definitions(excluded);
	const within = (bodies: readonly DataflowGraphVertexFunctionDefinition[], node: NodeId) => bodies.some(b => b.subflow.graph.has(node));
	for(const [target, edge] of graph.edgesFrom(id)) {
		if(DfEdge.includesType(edge, EdgeType.Reads | EdgeType.DefinedByOnCall) && DfEdge.doesNotIncludeType(edge, EdgeType.Argument) && DfgVertex.isVariableDefinition(graph.getVertex(target))) {
			const registers = linkedFunctionIds(new Set([target]), graph);
			if(registers.length > 0 && registers.every(r => excluded.has(r))) {
				graph.removeEdgeType(id, target, EdgeType.Reads | EdgeType.DefinedByOnCall);
				/* the calls of the generic handed the definition on to this dispatch alone */
				if(Dataflow.sourcesOf(graph, target, EdgeType.DefinedByOnCall).length === 0) {
					for(const caller of Dataflow.sourcesOf(graph, target, EdgeType.DefinesOnCall)) {
						graph.removeEdgeType(caller, target, EdgeType.DefinesOnCall);
					}
				}
			}
		}
		if(DfEdge.includesType(edge, EdgeType.DefinesOnCall)) {
			const readers = Dataflow.sourcesOf(graph, target, EdgeType.DefinedByOnCall);
			if(readers.some(r => within(removed, r)) && !readers.some(r => within(kept, r))) {
				graph.removeEdgeType(id, target, EdgeType.DefinesOnCall);
			}
		}
	}
}
