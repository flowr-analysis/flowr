import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument, RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { signatureFor } from '../../../../../fn/dispatch';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Resolve } from '../../../../../environments/resolve-helper';
import type { DataflowInformation } from '../../../../../info';
import type { DataflowProcessorInformation } from '../../../../../processor';
import { type ClassArgRef, argForImpl, ClassSystem, declaredClassesImpl, superClassesOfImpl } from '../../../../../fn/class-declaration';
import { type BrandedIdentifier, type Identifier, type InGraphReferenceType, ReferenceType } from '../../../../../environments/identifier';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { type DataflowGraphVertexFunctionCall, DfgVertex, type S4SignatureEntry, VertexType } from '../../../../../graph/vertex';
import { Dataflow } from '../../../../../graph/df-helper';
import type { DataflowGraph } from '../../../../../graph/graph';
import { EdgeType } from '../../../../../graph/edge';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { processKnownFunctionCall } from '../known-call-handling';
import { ProgramOrder } from '../../../../program-order';
import { runsOnlyAfter } from '../../../../dispatch-linking';
import { REnvironment } from '../../../../../environments/environment';

/** shorthand for the decorated-info generics every helper below carries through */
type Data<O> = DataflowProcessorInformation<O & ParentInformation>;
type Args<O> = readonly PotentiallyEmptyRArgument<O & ParentInformation>[];

/** marks a name in R's S4 class registry (the string-keyed table `setClass` writes and `new("P")` reads), separate from the variable scope so a class `P` stays apart from a variable `P` */
const S4ClassMark = '﹕s4class﹕';

/** The registry name of the S4 class `cls`, see {@link S4ClassMark}. */
export function s4ClassName(cls: BrandedIdentifier): Identifier {
	return S4ClassMark + cls;
}

/** Which arguments of a call name S4 registrations it depends on rather than declares. */
export interface S4UseConfig {
	/** the argument naming the S4 generic the call answers or asks about (`f` in `setMethod`) */
	readonly genericArg?:      ClassArgRef;
	/** appended to the generic named by {@link genericArg} (`setReplaceMethod("f", ...)` answers `f<-`) */
	readonly genericSuffix?:   string;
	/** the arguments naming S4 classes the call uses (`Class` in `new`, `signature` in `setMethod`) */
	readonly classArgs?:       readonly ClassArgRef[];
	/** the argument naming an S4 class the call adds to without declaring it (`to` in `setAs`): read and registered anew, so a later use depends on this call as well as on the declaration */
	readonly registersArg?:    ClassArgRef;
	/** the call hands back a method of the generic its {@link genericArg} names (`getMethod`, `selectMethod`) */
	readonly returnsMethod?:   boolean;
	/** the call creates an instance of the classes its {@link classArgs} name, running the methods of the `initializer` generic and their validity functions */
	readonly instantiates?:    { readonly initializer: string };
	/** the call registers its definition as a method of the generic, for the signature the first of its {@link classArgs} states (`setMethod`) */
	readonly registersMethod?: boolean;
}


/** The names an argument states, looking through the `c(...)`/`signature(...)` wrappers a signature may use. */
function classNamesOf<O>(node: RNode<O & ParentInformation> | undefined, data: Data<O>): readonly string[] {
	const known = node === undefined ? [] : NodeValue.knownStringsOf(node.info.id, data);
	if(known.length > 0 || !RFunctionCall.isNamed(node)) {
		return known;
	}
	return node.arguments.flatMap(arg => classNamesOf(RArgument.valueOf(arg), data));
}

/** The signature an argument of `setMethod` states, with the formal each class is for where it names one: `"A"`, `c("A", "B")`, `signature(e1 = "A")`, or a variable holding such strings; `undefined` if any part does not resolve. */
function signatureOf<O>(node: RNode<O & ParentInformation> | undefined, data: Data<O>): S4SignatureEntry[] | undefined {
	if(node === undefined) {
		return [];
	}
	if(!RFunctionCall.isNamed(node)) {
		return NodeValue.stringsOf(node.info.id, data)?.map(cls => ({ cls }));
	}
	const entries: S4SignatureEntry[] = [];
	for(const arg of node.arguments) {
		if(arg === EmptyArgument || arg.value === undefined) {
			return undefined;
		}
		const cls = NodeValue.singleStringOf(arg.value.info.id, data);
		if(cls === undefined) {
			return undefined;
		}
		entries.push(arg.name === undefined ? { cls } : { cls, name: arg.name.content });
	}
	return entries;
}

/** Adds a read of every given name to the call, so the call depends on whatever registered them. */
function readNames<O>(info: DataflowInformation, rootId: NodeId, names: readonly Identifier[], type: ReferenceType, data: Data<O>): void {
	if(names.length > 0) {
		info.in = [...info.in, ...names.map(name => ({ nodeId: rootId, name, type, cds: data.cds }))];
	}
}

/** Defines `name` in the environment and records it as an out-reference of the call at `rootId`. */
function defineOut<O>(info: DataflowInformation, rootId: NodeId, name: Identifier, type: InGraphReferenceType, data: Data<O>): void {
	info.environment = REnvironment.define({ name, nodeId: rootId, type, definedAt: rootId, cds: data.cds }, false, info.environment);
	info.out = [...info.out, { nodeId: rootId, name, type, cds: data.cds }];
}

/** wires the S4 registrations a call *uses* (the classes and generic its arguments name by string), read against the registry so the call depends on whatever `setClass`/`setGeneric` wrote them */
export function linkS4Uses<O>(info: DataflowInformation, args: Args<O>, rootId: NodeId, data: Data<O>, config: S4UseConfig): void {
	const classes = (config.classArgs ?? []).flatMap(ref => classNamesOf(argForImpl(args, ref), data));
	readNames(info, rootId, classes.map(s4ClassName), ReferenceType.Variable, data);
	const vertex = config.instantiates ? info.graph.getVertex(rootId) : undefined;
	if(config.instantiates && DfgVertex.isFunctionCall(vertex)) {
		vertex.instantiates = classes;
		vertex.initializer = config.instantiates.initializer;
		for(const { nodeId } of Resolve.byNameAndType(config.instantiates.initializer, data.environment, ReferenceType.Function) ?? []) {
			if(!NodeId.isBuiltIn(nodeId)) {
				info.graph.addEdge(rootId, nodeId, EdgeType.Calls);
			}
		}
	}
	const generics = classNamesOf(argForImpl(args, config.genericArg), data).map(n => n + (config.genericSuffix ?? ''));
	readNames(info, rootId, generics, ReferenceType.Function, data);
	const registering = config.registersMethod && generics.length === 1 ? info.graph.getVertex(rootId) : undefined;
	if(DfgVertex.isFunctionCall(registering)) {
		registering.s4Method = { generic: generics[0], signature: signatureOf(argForImpl(args, config.classArgs?.[0]), data) };
	}
	for(const { nodeId } of config.returnsMethod ? generics.flatMap(g => Resolve.byNameAndType(g, data.environment, ReferenceType.Function) ?? []) : []) {
		if(!NodeId.isBuiltIn(nodeId)) {
			info.graph.addEdge(rootId, nodeId, EdgeType.Returns);
		}
	}
	const registered = classNamesOf(argForImpl(args, config.registersArg), data).map(s4ClassName);
	readNames(info, rootId, registered, ReferenceType.Variable, data);
	for(const cls of registered) {
		defineOut(info, rootId, cls, ReferenceType.Variable, data);
	}
}

/** wires what the attached {@link DataflowGraphVertexFunctionCall.classDecl|class declaration} states, S4 and Reference Classes only: a declaration reads the classes it builds on and registers its own name; a mere relation (`setIs`, `setValidity`) reads and re-registers the class it names */
export function linkS4Declaration<O>(info: DataflowInformation, rootId: NodeId, data: Data<O>): void {
	const vertex = info.graph.getVertex(rootId);
	const decl = DfgVertex.isFunctionCall(vertex) ? vertex.classDecl : undefined;
	if(decl === undefined || (decl.system !== ClassSystem.S4 && decl.system !== ClassSystem.RefClass)) {
		return;
	}
	const used = [...decl.contains, ...(decl.union ?? []), ...decl.members.map(m => m.type).filter(t => t !== undefined)];
	if(decl.relation !== undefined && decl.name !== undefined) {
		used.push(decl.name);
	}
	readNames(info, rootId, used.map(s4ClassName), ReferenceType.Variable, data);
	for(const registered of decl.name === undefined ? decl.oldClasses ?? [] : [decl.name]) {
		defineOut(info, rootId, s4ClassName(registered), ReferenceType.Variable, data);
	}
}

/** Records that the call registers the S4 generics it names, which `setMethod` and a call of the name depend on. */
export function linkS4Generic<O>(info: DataflowInformation, rootId: NodeId, names: readonly BrandedIdentifier[], data: Data<O>): void {
	for(const name of names) {
		defineOut(info, rootId, name, ReferenceType.Function, data);
	}
}

/** Processes a call that consumes S4 registrations without declaring any, like `new("P")` or `getMethod("f", "P")`. */
export function processS4Use<O>(name: RSymbol<O & ParentInformation>, args: Args<O>, rootId: NodeId, data: Data<O>, config: S4UseConfig): DataflowInformation {
	const info = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.S4Use }).information;
	linkS4Uses(info, args, rootId, data, config);
	return info;
}

/** The class per formal of its method the registration `call` states, `ANY` where it states none, `undefined` if not known. */
function registeredClasses(call: DataflowGraphVertexFunctionCall, graph: DataflowGraph): string | undefined {
	if(call.s4Method?.signature === undefined) {
		return undefined;
	}
	const definition = call.args.map(a => a === EmptyArgument ? undefined : graph.idMap?.get(a.nodeId)).map(RArgument.valueOf).find(RFunctionDefinition.is);
	const formals = definition?.parameters.filter(p => !p.special).map(p => p.name.content);
	return formals === undefined ? undefined : signatureFor(call.s4Method, formals)?.join(',');
}

/** Drops what a `setMethod` reads of the methods registered before it for other signatures: it reads the generic by name, which finds them as well, yet R keeps them apart. */
export function separateMethodRegistrations(graph: DataflowGraph): void {
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		const classes = registeredClasses(vertex, graph);
		if(classes === undefined) {
			continue;
		}
		let replaces: boolean | undefined;
		for(const read of Dataflow.targetsOf(graph, id, EdgeType.Reads)) {
			const earlier = Dataflow.targetsOf(graph, read, EdgeType.DefinedBy).map(d => graph.getVertex(d)).find(v => DfgVertex.isFunctionCall(v) && v.s4Method !== undefined) as DataflowGraphVertexFunctionCall | undefined;
			const other = earlier === undefined ? undefined : registeredClasses(earlier, graph);
			if(other !== undefined && earlier?.s4Method?.generic === vertex.s4Method?.generic && (other !== classes || (replaces ??= replacesForGood(id, graph)))) {
				graph.removeEdgeType(id, read, EdgeType.Reads);
			}
		}
	}
}

/** Whether the registration `id` surely runs, once, and every call that sees the generic it defines runs after it, so that no call can see the method it replaces through it. */
function replacesForGood(id: NodeId, graph: DataflowGraph): boolean {
	const at = ProgramOrder.runsOnceAt(id, graph);
	if(at === undefined || (graph.getVertex(id)?.cds ?? []).length > 0) {
		return false;
	}
	const defined = Dataflow.targetsOf(graph, id, EdgeType.Returns).filter(t => DfgVertex.isVariableDefinition(graph.getVertex(t)));
	return defined.length > 0 && defined.every(d => Dataflow.sourcesOf(graph, d, EdgeType.Reads).every(reader => DfgVertex.isFunctionCall(graph.getVertex(reader)) && runsOnlyAfter(reader, at, graph)));
}

/** Links every instantiation to the validity functions of the class it creates and of the superclasses of that, all of which R runs on the new object, to those of every class if the class is unknown; done once the graph knows every class declaration. */
export function linkInstantiations(graph: DataflowGraph): void {
	const instantiations = graph.verticesOfType(VertexType.FunctionCall).filter(([, v]) => v.instantiates !== undefined).toArray();
	if(instantiations.length === 0) {
		return;
	}
	const validators = new Map<BrandedIdentifier, NodeId[]>();
	for(const [, { classDecl }] of graph.verticesOfType(VertexType.FunctionCall)) {
		if(classDecl?.validity !== undefined && classDecl.name !== undefined) {
			validators.set(classDecl.name, [...validators.get(classDecl.name) ?? [], classDecl.validity]);
		}
	}
	const classes = validators.size === 0 ? undefined : declaredClassesImpl(graph);
	let byName: ReturnType<typeof Dataflow.definitionsByName> | undefined;
	for(const [id, vertex] of instantiations) {
		if(vertex.initializer !== undefined && !graph.isRoot(id)) {
			for(const definition of (byName ??= Dataflow.definitionsByName(graph)).get(vertex.initializer)) {
				graph.addEdge(id, definition, EdgeType.Calls);
			}
		}
		const created = vertex.instantiates ?? [];
		const checked = classes === undefined ? [] : created.length === 0 ? [...validators.keys()] : created.flatMap(cls => [cls, ...superClassesOfImpl(cls, classes)]);
		for(const validity of checked.flatMap(cls => validators.get(cls) ?? [])) {
			graph.addEdge(id, validity, EdgeType.Calls);
		}
		/* the call runs code of the program, which the linking of nested calls has to see */
		vertex.onlyBuiltin &&= Dataflow.targetsOf(graph, id, EdgeType.Calls).every(NodeId.isBuiltIn);
	}
}
