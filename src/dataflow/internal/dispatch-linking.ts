import type { DataflowGraph } from '../graph/graph';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { DfEdge, EdgeType } from '../graph/edge';
import { type CallRuledOut, type DataflowGraphVertexFunctionCall, type DataflowGraphVertexFunctionDefinition, DfgVertex, VertexType } from '../graph/vertex';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { ProgramOrder } from './program-order';
import { isNotUndefined } from '../../util/assert';
import { uniqueArray } from '../../util/collections/arrays';
import { DotsParameterName } from '../../util/arg-matching';
import { Dataflow } from '../graph/df-helper';
import { BuiltInProcName } from '../environments/built-in-proc-name';
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
	/** the registrations the choice relies on beyond those of the methods, which the call depends on */
	readonly reads?:   readonly NodeId[]
}

/** how many calls of the function holding a dispatch are each decided on their own, beyond that all of them share one decision */
const MaxDispatchContexts = 64;

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
	 * and the methods `callNextMethod()` in each method may run, `undefined` if nothing can be narrowed. An instantiation
	 * (`new("C")`) runs the methods of the initializer it reaches for a new object of the class it creates.
	 * @param info - how the classes of the arguments are found, by default for any call of the function holding `call`
	 */
	public s4(call: DataflowGraphVertexFunctionCall, name: string, targets: ReadonlySet<NodeId>, registeredLater: (registration: NodeId) => boolean, info: ClassFlowInfo = this.info): NarrowedDispatch | undefined {
		const { methods, byFunction, hierarchy } = this.s4Info();
		const created = call.instantiates;
		const generic = created === undefined ? name : genericOf(targets, byFunction);
		/* only the methods registered where the call runs compete, one registered after a call at the top level does not */
		const all = generic === undefined ? undefined : s4CandidatesFor(generic, methods);
		const candidates = all?.filter(m => !registeredLater(m.registration) && m.functions.some(f => targets.has(f)));
		if(all === undefined || candidates === undefined) {
			return undefined;
		}
		const formals = created === undefined ? this.s4Formals(targets, candidates) : firstFormalOf(candidates, this.info.idMap);
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
		const reads: NodeId[] = [];
		const s3Class = (vector: readonly string[]) => {
			const registration = this.oldClassRegistration(vector[0], all);
			if(registration !== undefined) {
				reads.push(registration);
			}
			return registration === undefined ? undefined : vector[0];
		};
		const bound = created === undefined ? boundArguments(call, formals, this.info.idMap) : undefined;
		const tuples = created !== undefined ? instantiated(created) : bound === undefined ? undefined : s4ActualClasses(bound, info, s3Class);
		if(tuples === undefined) {
			return { excluded: new Set(), next };
		}
		const selected = new Set(tuples.flatMap(actual => selectS4Methods(candidates, formals, actual, hierarchy)).flatMap(m => m.functions));
		/* a method handing on with `callNextMethod()` runs the next one as well */
		for(const fn of selected) {
			if(callsNextMethod(fn, this.graph)) {
				next.get(fn)?.forEach(n => selected.add(n));
			}
		}
		return { excluded: new Set(all.flatMap(m => m.functions).filter(fn => !selected.has(fn) && targets.has(fn))), next, reads: uniqueArray(reads) };
	}

	/** The formals of the generic among `targets` that `candidates` are methods of, which S4 dispatches on. */
	private s4Formals(targets: ReadonlySet<NodeId>, candidates: readonly S4Method[]): readonly string[] | undefined {
		const { byFunction } = this.s4Info();
		const generics = [...targets].filter(t => !byFunction.has(t) && DfgVertex.isFunctionDefinition(this.graph.getVertex(t)) && (this.graph.getVertex(t) as DataflowGraphVertexFunctionDefinition).mode?.includes('s4'));
		return generics.length <= 1 ? s4DispatchFormals(generics[0], candidates, this.info.idMap) : undefined;
	}

	/**
	 * The `setOldClass` call registering the S3 class `cls` if S4 dispatch surely sees it: the only registration of `cls`,
	 * run once before any of `methods` is set. R keeps the method it picked for a class until a method of the generic is
	 * set, which may well have been picked before the registration.
	 */
	private oldClassRegistration(cls: string | undefined, methods: readonly S4Method[]): NodeId | undefined {
		const registrations = cls === undefined ? undefined : this.s4Info().hierarchy.oldClasses?.get(cls);
		const registration = registrations?.length === 1 ? registrations[0] : undefined;
		const at = registration === undefined ? undefined : ProgramOrder.runsOnceAt(registration, this.graph);
		if(registration === undefined || at === undefined || (this.graph.getVertex(registration)?.cds ?? []).length > 0) {
			return undefined;
		}
		return methods.every(m => ProgramOrder.offset(m.registration, at, this.graph) > 0) ? registration : undefined;
	}

	/**
	 * The `<prefix>.<class>` methods among `targets` an S3 dispatch on the objects `objects` cannot run, and what `NextMethod()`
	 * in each method it runs may run, `undefined` if the class of an object is not known.
	 * @param info - how the classes of the objects are found, by default for any call of the function holding the dispatch
	 */
	public s3(objects: readonly NodeId[], prefixes: readonly string[], targets: ReadonlySet<NodeId>, info: ClassFlowInfo = this.info): NarrowedDispatch | undefined {
		const perObject = objects.map(o => s3DispatchClassesOf(o, info));
		if(perObject.length === 0 || !perObject.every(isNotUndefined)) {
			return undefined;
		}
		const methodOf = (fn: NodeId) => s3ClassOfMethod(fn, prefixes, this.graph);
		const methods = [...targets].filter(t => methodOf(t) !== undefined);
		const { runs, next } = s3Dispatch(perObject.flat(), methods, methodOf);
		const others = this.otherFunctions(targets, t => methodOf(t) !== undefined);
		return { excluded: new Set(methods.filter(m => !runs.has(m))), next: new Map(next.entries().map(([m, after]) => [m, [...after, ...others]])) };
	}

	/**
	 * Per call of the function holding the dispatch `call`, the methods among `targets` the dispatch rules out beyond `shared`
	 * (what it rules out for every call) when that call runs it: `decide` narrows the dispatch for the classes the context of
	 * one call gives. Only for a function the program calls by name alone and never hands on are all its calls known.
	 * @example
	 * ```r
	 * f <- function(x) UseMethod("f")
	 * f(structure(1, class = "a")) # rules out f.b
	 * f(structure(1, class = "b")) # rules out f.a
	 * ```
	 */
	public perCall(call: NodeId, targets: ReadonlySet<NodeId>, shared: NarrowedDispatch | undefined, decide: (info: ClassFlowInfo) => NarrowedDispatch | undefined): CallRuledOut[] | undefined {
		const fn = this.graph.isRoot(call) ? undefined : RNode.strictlyEnclosingFunction(call, this.info.idMap);
		const methods = [...targets].filter(t => DfgVertex.isFunctionDefinition(this.graph.getVertex(t)) && !shared?.excluded.has(t));
		const callers = fn === undefined || methods.length < 2 ? [] : Dataflow.sourcesOf(this.graph, fn, EdgeType.Calls);
		if(fn === undefined || callers.length === 0 || callers.length > MaxDispatchContexts || !calledByNameOnly(fn, callers, this.graph)) {
			return undefined;
		}
		const ruledOut: CallRuledOut[] = [];
		for(const caller of callers) {
			const excluded = decide({ ...this.info, callContext: new Map([[fn, caller]]) })?.excluded;
			const extra = excluded === undefined ? [] : methods.filter(m => excluded.has(m));
			if(extra.length > 0) {
				ruledOut.push({ call: caller, methods: extra });
			}
		}
		return ruledOut.length > 0 ? ruledOut : undefined;
	}

	/** The function definitions among `targets` that are no method by `isMethod`. */
	private otherFunctions(targets: ReadonlySet<NodeId>, isMethod: (fn: NodeId) => boolean): NodeId[] {
		return [...targets].filter(t => !isMethod(t) && DfgVertex.isFunctionDefinition(this.graph.getVertex(t)));
	}
}

/**
 * Whether the function `fn` hands on to the next method, with `NextMethod()` or `callNextMethod()`.
 * @example
 * ```ts
 * // f.a <- function(x) NextMethod()
 * callsNextMethod(idOfTheFunction, graph); // true
 * ```
 */
export function callsNextMethod(fn: NodeId, graph: DataflowGraph): boolean {
	const vertex = graph.getVertex(fn);
	return DfgVertex.isFunctionDefinition(vertex) && Dataflow.callsIn(vertex, graph).some(([, c]) => DfgVertex.hasOrigin(c, BuiltInProcName.S3DispatchNext));
}

/**
 * Whether the function `fn` is bound to names (through assignments, `f <- g <- function...` as well) that only
 * `callers` read, so that they are all the ways it runs.
 */
function calledByNameOnly(fn: NodeId, callers: readonly NodeId[], graph: DataflowGraph): boolean {
	const seen = new Set<NodeId>([fn]);
	const todo = [fn];
	let bound = false;
	for(let at = todo.pop(); at !== undefined; at = todo.pop()) {
		for(const source of Dataflow.sourcesOf(graph, at, EdgeType.DefinedBy | EdgeType.Reads)) {
			const vertex = graph.getVertex(source);
			const holds = DfgVertex.isVariableDefinition(vertex) || DfgVertex.hasOrigin(vertex, BuiltInProcName.Assignment);
			if(!holds && !callers.includes(source)) {
				return false;
			} else if(holds && !seen.has(source)) {
				bound ||= DfgVertex.isVariableDefinition(vertex);
				seen.add(source);
				todo.push(source);
			}
		}
	}
	return bound;
}

/** The one generic the S4 methods among `targets` belong to, `undefined` unless there is exactly one. */
function genericOf(targets: ReadonlySet<NodeId>, byFunction: ReadonlyMap<NodeId, readonly S4Method[]>): string | undefined {
	const generics = new Set([...targets].flatMap(t => byFunction.get(t) ?? []).map(m => m.generic));
	return generics.size === 1 ? [...generics][0] : undefined;
}

/** The first formal the functions of `methods` share, which an instantiation hands the new object. */
function firstFormalOf(methods: readonly S4Method[], idMap: AstIdMap): readonly string[] | undefined {
	const firsts = new Set(methods.flatMap(m => m.functions).map(fn => {
		const node = idMap.get(fn);
		return RFunctionDefinition.is(node) ? node.parameters[0]?.name.content : undefined;
	}));
	const first = firsts.size === 1 ? [...firsts][0] : undefined;
	return first === undefined || first === DotsParameterName ? undefined : [first];
}

/** The class tuple an instantiation dispatches its initializer on: the one class it creates, `undefined` if that is not known. */
function instantiated(created: readonly string[]): string[][] | undefined {
	return created.length === 1 ? [[created[0]]] : undefined;
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


/** the edges by which a call reaches a definition registering a method, by name or as what a generic hands on */
const RegistrationEdges = EdgeType.Reads | EdgeType.DefinedByOnCall | EdgeType.Calls;

/**
 * Per target, the edges from `call` only its link to the method definitions `excluded` needs: the call and the returns of
 * them, the reads of the definitions registering only them, and what only their bodies read on the call.
 * @example
 * ```ts
 * // f <- function(x) UseMethod("f"); f.a <- function(x) k; f.b <- function(x) j
 * methodOnlyEdges(graph, idOfDispatch, new Set([idOfFb])); // f.b, its exit point `j`, the definition `f.b <-`
 * ```
 */
export function methodOnlyEdges(graph: DataflowGraph, call: NodeId, excluded: ReadonlySet<NodeId>): Map<NodeId, EdgeType> {
	const only = new Map<NodeId, EdgeType>();
	const add = (target: NodeId, types: EdgeType) => only.set(target, (only.get(target) ?? 0) | types);
	const definitions = (ids: Iterable<NodeId>) => [...ids].map(t => graph.getVertex(t)).filter(v => DfgVertex.isFunctionDefinition(v)) as DataflowGraphVertexFunctionDefinition[];
	const removed = definitions(excluded);
	const kept = definitions(Dataflow.targetsOf(graph, call, EdgeType.Calls).filter(t => !excluded.has(t)));
	for(const fn of removed) {
		add(fn.id, EdgeType.Calls);
		fn.exitPoints.forEach(exit => add(exit.nodeId, EdgeType.Returns));
	}
	const within = (bodies: readonly DataflowGraphVertexFunctionDefinition[], node: NodeId) => bodies.some(b => b.subflow.graph.has(node));
	for(const [target, edge] of graph.edgesFrom(call)) {
		if(DfEdge.includesType(edge, RegistrationEdges) && DfEdge.doesNotIncludeType(edge, EdgeType.Argument) && DfgVertex.isVariableDefinition(graph.getVertex(target))) {
			const registers = linkedFunctionIds(new Set([target]), graph);
			if(registers.length > 0 && registers.every(r => excluded.has(r))) {
				add(target, RegistrationEdges);
			}
		}
		if(DfEdge.includesType(edge, EdgeType.DefinesOnCall)) {
			const readers = Dataflow.sourcesOf(graph, target, EdgeType.DefinedByOnCall);
			if(readers.some(r => within(removed, r)) && !readers.some(r => within(kept, r))) {
				add(target, EdgeType.DefinesOnCall);
			}
		}
	}
	return only;
}

/**
 * Removes what linking `call` to the method definitions `excluded` added: the edges {@link methodOnlyEdges} names and
 * the arguments bound to the parameters of the methods.
 */
export function unlinkExcludedMethods(graph: DataflowGraph, call: DataflowGraphVertexFunctionCall, excluded: ReadonlySet<NodeId>): void {
	const id = call.id;
	for(const [target, types] of methodOnlyEdges(graph, id, excluded)) {
		graph.removeEdgeType(id, target, types);
		/* the calls of the generic handed a registering definition on to this dispatch alone */
		if((types & EdgeType.DefinedByOnCall) !== 0 && Dataflow.sourcesOf(graph, target, EdgeType.DefinedByOnCall).length === 0) {
			for(const caller of Dataflow.sourcesOf(graph, target, EdgeType.DefinesOnCall)) {
				graph.removeEdgeType(caller, target, EdgeType.DefinesOnCall);
			}
		}
	}
	for(const fn of excluded) {
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
}
