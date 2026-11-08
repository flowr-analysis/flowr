/** Which methods a dispatching call reaches for the classes its arguments have, uniformly for S3 (`UseMethod`, a built-in generic, `NextMethod`) and S4 (`standardGeneric`, `callNextMethod`): the class of a value is followed through its value flow to where it is made (`structure(..., class = )`, `class<-`, `new("C")`, a constant), and a call whose classes are not all known keeps every method, which is sound. */

import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';
import type { DataflowGraph } from '../graph/graph';
import { EdgeType } from '../graph/edge';
import { type DataflowGraphVertexFunctionCall, DfgVertex, type S4SignatureEntry, VertexType } from '../graph/vertex';
import { Dataflow } from '../graph/df-helper';
import { callOfArgument, type ResolveInfo } from '../eval/resolve/alias-tracking';
import { NodeValue } from '../eval/resolve/node-value';
import { collectStrings } from '../eval/values/string/string-constants';
import { isValue } from '../eval/values/r-value';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { argForImpl, declaredClassesImpl } from './class-declaration';
import { DotsParameterName } from '../../util/arg-matching';
import type { BrandedIdentifier, ClassName } from '../environments/identifier';
import { s4GroupGenericsOf } from '../environments/group-generics';
import { uniqueArray } from '../../util/collections/arrays';

/** What a class vector of a value stems from, which decides the dispatch that can use it. */
export const enum ClassSource {
	/** the class attribute, set by `structure(..., class = )` or `class<-`, S3 dispatches on it */
	Attribute = 'attribute',
	/** an instance of the S4 class `new` creates */
	Instance  = 'instance',
	/** a value without a class attribute, R dispatches on its implicit class (`double`, `numeric`, ...) */
	Implicit  = 'implicit'
}

/** The class vector one producer of a value gives it. */
export interface ValueClass {
	readonly source:  ClassSource
	readonly classes: readonly ClassName[]
}

/** What the class flow needs: a finished graph with its AST, and what value resolution needs. */
export type ClassFlowInfo = ResolveInfo & { readonly graph: DataflowGraph, readonly idMap: AstIdMap };

/** how many producers the walk for one value visits before it gives up */
const MaxProducers = 64;

/** One step of the walk: the class a producer makes, the values the class comes from, or `undefined` if not known. */
type FlowStep = ValueClass | { readonly from: readonly NodeId[], readonly keepsAttribute?: boolean } | undefined;

/** The class vectors the value at `id` may have, one per producer its value flow reaches, `undefined` unless all are known. */
export function classesOfValue(id: NodeId, info: ClassFlowInfo): readonly ValueClass[] | undefined {
	const found: ValueClass[] = [];
	const seen = new Set<NodeId>();
	/* the ids to visit, with whether only a class attribute may reach them (`x$a <- 1` keeps the class of `x`, not its type) */
	const todo: [NodeId, boolean][] = [[id, false]];
	for(let next = todo.pop(); next !== undefined; next = todo.pop()) {
		const [at, attributeOnly] = next;
		if(seen.has(at)) {
			continue;
		}
		if(seen.size >= MaxProducers) {
			return undefined;
		}
		seen.add(at);
		const step = flowStepOf(NodeId.normalize(at), info);
		if(step === undefined) {
			return undefined;
		} else if('from' in step) {
			todo.push(...step.from.map(f => [f, attributeOnly || step.keepsAttribute === true] as [NodeId, boolean]));
		} else if(attributeOnly && step.source === ClassSource.Implicit) {
			return undefined;
		} else {
			found.push(step);
		}
	}
	return found.length > 0 ? found : undefined;
}

function flowStepOf(id: NodeId, info: ClassFlowInfo): FlowStep {
	const { graph, idMap } = info;
	const node = idMap.get(id);
	if(RArgument.is(node)) {
		return node.value === undefined ? undefined : { from: [node.value.info.id] };
	}
	const vertex = graph.getVertex(id);
	switch(vertex?.tag) {
		case VertexType.Value:
			return implicitClassOf(id, info);
		case VertexType.FunctionDefinition:
			return { source: ClassSource.Implicit, classes: ['function'] };
		case VertexType.Use: {
			const defs = Dataflow.targetsOf(graph, id, EdgeType.Reads);
			return defs.length === 0 || defs.some(NodeId.isBuiltIn) ? implicitClassOf(id, info) : { from: supersededByClassChange(defs, graph) };
		}
		case VertexType.VariableDefinition:
			return definitionStep(id, node, info);
		case VertexType.FunctionCall:
			return callStep(vertex, info);
		default:
			return undefined;
	}
}

/** The definitions without those a later, unconditional `class<-` on the same variable replaces, which a read sees alongside it. */
function supersededByClassChange(defs: readonly NodeId[], graph: DataflowGraph): NodeId[] {
	const replaced = new Set<NodeId>();
	for(const def of defs) {
		const cds = graph.getVertex(def)?.cds ?? [];
		for(const previous of Dataflow.targetsOf(graph, def, EdgeType.Reads)) {
			const before = graph.getVertex(previous)?.cds ?? [];
			if(defs.includes(previous) && classChangeOf(def, graph) !== undefined && cds.every(cd => before.some(b => b.id === cd.id && b.when === cd.when))) {
				replaced.add(previous);
			}
		}
	}
	return replaced.size === 0 ? [...defs] : defs.filter(d => !replaced.has(d));
}

/** the replacement functions that set the class attribute to the value they are given */
const ClassReplacements = ['class<-', 'oldClass<-'];
/** the replacement functions that change a part of the value and keep its class attribute */
const AttributeKeepingReplacements = ['$<-', '[[<-', '[<-', '@<-', 'names<-'];

/** The replacement call defining `def` if it is a built-in one, with whether it sets the class. */
function replacementOf(def: NodeId, graph: DataflowGraph): { readonly call: NodeId, readonly setsClass: boolean } | 'other' | undefined {
	const call = Dataflow.sourcesOf(graph, def, EdgeType.Returns).find(c => DfgVertex.hasOrigin(graph.getVertex(c), BuiltInProcName.Replacement));
	if(call === undefined) {
		return undefined;
	}
	const targets = Dataflow.targetsOf(graph, call, EdgeType.Calls);
	if(targets.some(t => !NodeId.isBuiltIn(t))) {
		return 'other';
	}
	const calls = (names: readonly BrandedIdentifier[]) => names.some(n => targets.includes(NodeId.toBuiltIn(n)));
	return calls(ClassReplacements) ? { call, setsClass: true } : calls(AttributeKeepingReplacements) ? { call, setsClass: false } : 'other';
}

/** The class a `class(x) <- value` definition sets, `undefined` if `def` is no such definition. */
function classChangeOf(def: NodeId, graph: DataflowGraph): NodeId | undefined {
	const replacement = replacementOf(def, graph);
	return typeof replacement === 'object' && replacement.setsClass ? replacement.call : undefined;
}

/** What the argument `bound` hands a function: its value, but for the target of a replacement call (`a` in `lab(a) <- 1`), which the call defines anew, the value the target has before. */
function handedValueOf(bound: NodeId, graph: DataflowGraph): readonly NodeId[] {
	if(!DfgVertex.isVariableDefinition(graph.getVertex(bound)) || !Dataflow.sourcesOf(graph, bound, EdgeType.Returns).some(c => DfgVertex.hasOrigin(graph.getVertex(c), BuiltInProcName.Replacement))) {
		return [bound];
	}
	return Dataflow.targetsOf(graph, bound, EdgeType.Reads).filter(r => DfgVertex.isVariableDefinition(graph.getVertex(r)));
}

function definitionStep(id: NodeId, node: RNode<ParentInformation> | undefined, info: ClassFlowInfo): FlowStep {
	const { graph } = info;
	if(node?.info.role === RoleInParent.ParameterName) {
		/* R dispatches on the promise the call binds, so every call of the function has to bind one */
		const fn = node.info.parent === undefined ? undefined : info.idMap.get(node.info.parent)?.info.parent;
		const bound = Dataflow.targetsOf(graph, id, EdgeType.DefinedByOnCall);
		/* in the context of one call, the parameter holds what that call binds */
		const inCall = fn === undefined ? undefined : info.callContext?.get(fn);
		if(inCall !== undefined) {
			const handed = bound.filter(b => callOfArgument(b, info.idMap) === inCall);
			return handed.length === 0 ? undefined : { from: handed.flatMap(b => handedValueOf(b, graph)) };
		}
		const calls = fn === undefined ? 0 : Dataflow.sourcesOf(graph, fn, EdgeType.Calls).length;
		return calls === 0 || bound.length < calls ? undefined : { from: bound.flatMap(b => handedValueOf(b, graph)) };
	}
	const replacement = replacementOf(id, graph);
	if(replacement === 'other') {
		return undefined;
	} else if(replacement !== undefined) {
		const values = Dataflow.targetsOf(graph, id, EdgeType.DefinedBy).filter(v => v !== replacement.call);
		if(!replacement.setsClass) {
			return { from: Dataflow.targetsOf(graph, id, EdgeType.Reads).filter(r => DfgVertex.isVariableDefinition(graph.getVertex(r))), keepsAttribute: true };
		}
		const classes = values.length === 1 ? NodeValue.stringsOf(values[0], info) : undefined;
		return classes?.length ? { source: ClassSource.Attribute, classes } : undefined;
	}
	const value = Dataflow.assignedValueOf(id, graph);
	return value === undefined ? undefined : { from: [value] };
}

function callStep(vertex: DataflowGraphVertexFunctionCall, info: ClassFlowInfo): FlowStep {
	const { graph } = info;
	const id = vertex.id;
	if(vertex.instantiates !== undefined) {
		const { classes } = vertex.instantiates;
		return classes.length === 1 ? { source: ClassSource.Instance, classes } : undefined;
	}
	const node = info.idMap.get(id);
	const targets = Dataflow.targetsOf(graph, id, EdgeType.Calls);
	if(RFunctionCall.is(node) && targets.includes(NodeId.toBuiltIn('structure'))) {
		const cls = NodeValue.soleOf(argForImpl(node.arguments, { name: 'class' }), info);
		const classes = cls?.type === 'string' ? collectStrings([cls]) : cls?.type === 'vector' && isValue(cls.elements) ? collectStrings(cls.elements) : undefined;
		return classes?.length ? { source: ClassSource.Attribute, classes } : undefined;
	}
	/* an access hands back a part of what it accesses, a replacement the value it assigns */
	if(DfgVertex.hasOrigin(vertex, BuiltInProcName.Access) || DfgVertex.hasOrigin(vertex, BuiltInProcName.Replacement)) {
		return undefined;
	}
	const defined = targets.filter(t => !NodeId.isBuiltIn(t));
	if(defined.length > 0 && defined.length < targets.length) {
		return undefined;
	}
	/* what a function of the program returns, or the argument a built-in hands back unchanged */
	const returned = Dataflow.targetsOf(graph, id, EdgeType.Returns);
	if(returned.length > 0) {
		return { from: returned };
	}
	return defined.length > 0 ? undefined : implicitClassOf(id, info);
}

/** The implicit class vector S3 dispatch sees for a constant, `undefined` if the value is not one. */
function implicitClassOf(id: NodeId, info: ClassFlowInfo): FlowStep {
	const sole = NodeValue.soleOf(id, info);
	/* a number resolves to the interval of just that number */
	const value = sole?.type === 'interval' ? sole.start : sole;
	if(value?.type === 'string') {
		return { source: ClassSource.Implicit, classes: ['character'] };
	} else if(value?.type === 'logical') {
		return { source: ClassSource.Implicit, classes: ['logical'] };
	} else if(value?.type === 'number' && isValue(value.value)) {
		return { source: ClassSource.Implicit, classes: value.value.complexNumber ? ['complex'] : value.value.markedAsInt ? ['integer', 'numeric'] : ['double', 'numeric'] };
	}
	return undefined;
}

/** The class vectors S3 dispatch may see for the argument at `id`, `undefined` unless all are known. */
export function s3DispatchClassesOf(id: NodeId, info: ClassFlowInfo): readonly (readonly ClassName[])[] | undefined {
	const classes = classesOfValue(id, info);
	return classes?.every(c => c.source !== ClassSource.Instance) ? classes.map(c => c.classes) : undefined;
}

/** The class S4 dispatch sees for a value: the class of an instance, or of a constant; for an S3 class vector, what `s3Class` makes of it, `undefined` by default. */
function s4ClassOf({ source, classes }: ValueClass, s3Class: (vector: readonly ClassName[]) => ClassName | undefined): ClassName | undefined {
	switch(source) {
		case ClassSource.Instance:
			return classes[0];
		case ClassSource.Implicit:
			return classes[0] === 'double' ? 'numeric' : classes[0];
		default:
			return s3Class(classes);
	}
}

/** The S3 methods a dispatch on the class vectors `classes` may run, in each vector the method of a class or else that of a later one, then the default, and for each such method what its `NextMethod()` may run: the methods of the classes after its own in a vector it was run for. */
export function s3Dispatch<T>(classes: readonly (readonly ClassName[])[], methods: readonly T[], methodOf: (m: T) => ClassName | undefined): { readonly runs: Set<T>, readonly next: Map<T, Set<T>> } {
	const runs = new Set<T>();
	const next = new Map<T, Set<T>>();
	for(const vector of classes) {
		const chain = [...vector, 'default'].map(cls => methods.filter(m => methodOf(m) === cls));
		chain.flat().forEach(m => runs.add(m));
		for(let i = 0; i < chain.length; i++) {
			for(const method of chain[i]) {
				const after = next.get(method) ?? new Set<T>();
				chain.slice(i + 1).flat().forEach(m => after.add(m));
				next.set(method, after);
			}
		}
	}
	return { runs, next };
}

/** One method `setMethod` registered in the program. */
export interface S4Method {
	/** the `setMethod` call */
	readonly registration: NodeId
	/** the definition of the generic's name the call makes, which a call of the generic reads */
	readonly definition?:  NodeId
	/** the method's function definitions */
	readonly functions:    readonly NodeId[]
	readonly generic:      BrandedIdentifier
	readonly signature?:   readonly S4SignatureEntry[]
}

/** the distance R gives `ANY`, beyond that of any real superclass */
const AnyDistance = 1_000_000;

/** The class hierarchy S4 dispatch walks, with the classes whose superclasses are not all known (they come from packages). */
export interface S4Hierarchy {
	readonly supers:     ReadonlyMap<ClassName, readonly ClassName[]>
	/** classes the program does not declare, whose superclasses (from base R or a package) are open */
	readonly declared:   ReadonlySet<ClassName>
	/** per S3 class `setOldClass` registers, the calls registering it; `undefined` if one registers classes not known */
	readonly oldClasses: ReadonlyMap<ClassName, readonly NodeId[]> | undefined
}

/** the virtual class every S3 class `setOldClass` registers extends last */
const OldClass = 'oldClass';

/** The S4 class hierarchy the graph declares, with the superclasses `setClassUnion` and `setIs` give classes it does not declare, and the S3 classes `setOldClass` registers, each extending the next of its vector. */
export function s4HierarchyOf(graph: DataflowGraph): S4Hierarchy {
	const classes = declaredClassesImpl(graph);
	const supers = new Map<ClassName, ClassName[]>([...classes].map(([name, decl]) => [name, [...decl.contains]]));
	const declared = new Set(classes.keys());
	let oldClasses: Map<ClassName, NodeId[]> | undefined = new Map();
	const add = (sub: ClassName, sup: ClassName | undefined) => {
		const list = supers.get(sub) ?? [];
		if(sup !== undefined && sup !== sub && !list.includes(sup)) {
			supers.set(sub, [...list, sup]);
		}
	};
	for(const [id, { classDecl }] of graph.verticesOfType(VertexType.FunctionCall)) {
		const registered = classDecl?.oldClasses;
		if(registered !== undefined) {
			if(registered.length === 0) {
				oldClasses = undefined;
			}
			registered.forEach((cls, i) => {
				add(cls, registered[i + 1] ?? OldClass);
				declared.add(cls);
				oldClasses?.set(cls, [...oldClasses.get(cls) ?? [], id]);
			});
			declared.add(OldClass);
		}
		if(classDecl?.name === undefined) {
			continue;
		}
		for(const member of classDecl.union ?? []) {
			add(member, classDecl.name);
		}
		if(classDecl.relation === 'is') {
			add(classDecl.name, classDecl.contains[0]);
		}
	}
	/* the basic classes R places below `numeric` */
	add('integer', 'numeric');
	add('double', 'numeric');
	/* a class declared by `setClass` as well is no plain S3 class */
	classes.keys().forEach(c => oldClasses?.delete(c));
	return { supers, declared, oldClasses };
}

/** Per class, the fewest steps from `cls` up to it, and the fewest to a class whose superclasses are open. */
function distancesFrom(cls: ClassName, hierarchy: S4Hierarchy): { readonly depth: ReadonlyMap<ClassName, number>, readonly open: number | undefined } {
	const depth = new Map<ClassName, number>([[cls, 0]]);
	let open: number | undefined;
	for(const [at, d] of depth) {
		if(!hierarchy.declared.has(at)) {
			open ??= d;
		}
		for(const sup of hierarchy.supers.get(at) ?? []) {
			if(!depth.has(sup)) {
				depth.set(sup, d + 1);
			}
		}
	}
	return { depth, open };
}

/** The classes a class with open superclasses may reach through them: the undeclared ones, and what the program places above an undeclared one. */
function reachableThroughOpen(hierarchy: S4Hierarchy): ReadonlySet<ClassName> {
	const reachable = new Set<ClassName>();
	for(const [sub, sups] of hierarchy.supers) {
		if(!hierarchy.declared.has(sub)) {
			sups.forEach(s => reachable.add(s));
		}
	}
	for(const cls of reachable) {
		hierarchy.supers.get(cls)?.forEach(s => reachable.add(s));
	}
	return reachable;
}

/** The range of distances R may see from the class `actual` of an argument to the class `wanted` of a signature, and whether it surely matches; `undefined` if it never matches. */
function distanceRange(actual: ClassName, wanted: ClassName, hierarchy: S4Hierarchy, open: ReadonlySet<ClassName>): [number, number, boolean] | undefined {
	if(wanted === 'ANY') {
		return [AnyDistance, AnyDistance, true];
	} else if(actual === wanted) {
		return [0, 0, true];
	} else if(actual === 'missing' || actual === 'ANY') {
		return undefined;
	}
	const { depth, open: openAt } = distancesFrom(actual, hierarchy);
	const known = depth.get(wanted);
	const viaOpen = openAt !== undefined && (!hierarchy.declared.has(wanted) || open.has(wanted));
	if(!viaOpen) {
		return known === undefined ? undefined : [known, known, true];
	}
	return [Math.min(known ?? AnyDistance, openAt + 1), known ?? AnyDistance - 1, known !== undefined];
}

/** The methods R may select among `methods` for arguments of the classes `actual` (one per dispatched formal, `missing` for an argument not given): every applicable method whose least possible distance is no more than the greatest possible one of the closest; ties are kept, as R would pick among them. */
export function selectS4Methods(methods: readonly S4Method[], formals: readonly BrandedIdentifier[], actual: readonly ClassName[], hierarchy: S4Hierarchy): S4Method[] {
	const open = reachableThroughOpen(hierarchy);
	const ranges: [S4Method, number, number, boolean][] = [];
	for(const method of methods) {
		const wanted = signatureFor(method, formals) ?? formals.map(() => 'ANY');
		let low = 0;
		let high = 0;
		let applies = true;
		let surely = true;
		for(let i = 0; i < formals.length && applies; i++) {
			const range = distanceRange(String(actual[i]), String(wanted[i]), hierarchy, open);
			applies = range !== undefined;
			low += range?.[0] ?? 0;
			high += range?.[1] ?? 0;
			surely &&= range?.[2] === true;
		}
		if(applies) {
			ranges.push([method, low, high, surely]);
		}
	}
	/* only a method that surely applies rules out those further away, one that may not apply leaves them */
	const best = Math.min(...ranges.filter(([, , , surely]) => surely).map(([, , high]) => high));
	return ranges.filter(([, low]) => low <= best).map(([m]) => m);
}

/** The class a method's signature wants per dispatched formal, `ANY` where it states none; `undefined` if it names a formal not dispatched on. */
export function signatureFor(method: Pick<S4Method, 'signature'>, formals: readonly BrandedIdentifier[]): ClassName[] | undefined {
	const wanted = formals.map((): ClassName => 'ANY');
	let position = 0;
	for(const { cls, name } of method.signature ?? []) {
		const at = name === undefined ? position : formals.indexOf(name);
		if(at < 0 || at >= formals.length) {
			return undefined;
		}
		wanted[at] = cls;
		position = at + 1;
	}
	return wanted;
}

/** Every method `setMethod` registers in the graph, by the generic it is for. */
export function s4MethodsOf(graph: DataflowGraph, linked: (ids: ReadonlySet<NodeId>) => readonly NodeId[]): Map<BrandedIdentifier, S4Method[]> {
	const methods = new Map<BrandedIdentifier, S4Method[]>();
	for(const [registration, { s4Method }] of graph.verticesOfType(VertexType.FunctionCall)) {
		if(s4Method === undefined) {
			continue;
		}
		const definition = Dataflow.targetsOf(graph, registration, EdgeType.Returns).find(t => DfgVertex.isVariableDefinition(graph.getVertex(t)));
		const functions = definition === undefined ? [] : linked(new Set([definition]));
		methods.set(s4Method.generic, [...methods.get(s4Method.generic) ?? [], { registration, definition, functions, generic: s4Method.generic, signature: s4Method.signature }]);
	}
	return methods;
}

/** The formals of the generic S4 dispatches on: the formals of the program's generic, or those all its methods share, without `...`. */
export function s4DispatchFormals(generic: NodeId | undefined, methods: readonly S4Method[], idMap: AstIdMap): readonly BrandedIdentifier[] | undefined {
	const formalsOf = (fn: NodeId) => {
		const node = idMap.get(fn);
		return RFunctionDefinition.is(node) ? node.parameters.map(p => p.special ? DotsParameterName : p.name.content).filter(n => n !== DotsParameterName) : undefined;
	};
	if(generic !== undefined) {
		/* a `setGeneric(signature = )` restricts the formals dispatched on */
		const own = idMap.get(generic);
		const definer = own === undefined ? undefined : RNode.directParent(own, idMap);
		const call = RArgument.is(definer) ? RNode.directParent(definer, idMap) : definer;
		if(RFunctionCall.is(call) && argForImpl(call.arguments, { name: 'signature', idx: 6 }) !== undefined) {
			return undefined;
		}
		return formalsOf(generic);
	}
	const all = methods.flatMap(m => m.functions).map(formalsOf);
	const first = all[0];
	return first !== undefined && all.every(f => f !== undefined && f.length === first.length && f.every((n, i) => n === first[i])) ? first : undefined;
}

/** The S4 methods of the program a call of `name` may reach: those of the generic and of the group generics it belongs to, `undefined` if any of them has a signature that does not resolve, so none can be ruled out. */
export function s4CandidatesFor(name: BrandedIdentifier, methods: ReadonlyMap<BrandedIdentifier, readonly S4Method[]>): readonly S4Method[] | undefined {
	const candidates = [name, ...s4GroupGenericsOf(name)].flatMap(g => methods.get(g) ?? []);
	return candidates.every(m => m.signature !== undefined) ? candidates : undefined;
}

/** The classes an S4 call dispatches on, one tuple per combination the arguments may have, `undefined` unless all are known. */
export function s4ActualClasses(bound: readonly (NodeId | undefined)[], info: ClassFlowInfo, s3Class: (vector: readonly ClassName[]) => ClassName | undefined): ClassName[][] | undefined {
	let tuples: ClassName[][] = [[]];
	for(const arg of bound) {
		const classes: readonly (ClassName | undefined)[] | undefined = arg === undefined ? ['missing'] : classesOfValue(arg, info)?.map(c => s4ClassOf(c, s3Class));
		if(classes === undefined || classes.includes(undefined)) {
			return undefined;
		}
		tuples = tuples.flatMap(t => uniqueArray(classes as ClassName[]).map(c => [...t, c]));
		if(tuples.length > MaxProducers) {
			return undefined;
		}
	}
	return tuples;
}

/** The methods `callNextMethod()` within `method` may run: those R would select for the signature `method` is defined for, `method` aside. */
export function nextS4Methods(method: S4Method, candidates: readonly S4Method[], formals: readonly BrandedIdentifier[], hierarchy: S4Hierarchy): S4Method[] {
	const own = signatureFor(method, formals);
	if(own === undefined) {
		return [...candidates];
	}
	const others = candidates.filter(m => m.functions.every(f => !method.functions.includes(f)));
	return selectS4Methods(others, formals, own, hierarchy);
}
