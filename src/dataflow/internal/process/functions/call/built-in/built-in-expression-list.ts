import type { ControlDependency, DataflowInformation, ExitPoint, KillReference } from '../../../../../info';
import { addNonDefaultExitPoints, ExitPointType, happensInEveryBranch, leaveThrough } from '../../../../../info';
import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import { bindAccessedField, type CalledFunctions, errorEscapes, getAllLinkedFunctionDefinitions, linkFunctionCalls, linkFunctionCallWithSingleTarget, linkWritesCarriedByLoop } from '../../../../linker';
import { isNotUndefined } from '../../../../../../util/assert';
import { patchFunctionCall } from '../common';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import type { MemoryView } from '../../../../../environments/frame-memory';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { loadNodesForNamespace } from './built-in-library';
import { scopeOf } from '../../../../../environments/resolve-by-name';
import { DataflowGraph } from '../../../../../graph/graph';
import { type BrandedIdentifier, hasEnvState, Identifier, type IdentifierDefinition, type InGraphIdentifierDefinition, isInGraphDefinition, type IdentifierReference, ReferenceType, type ClassName } from '../../../../../environments/identifier';
import { EdgeType } from '../../../../../graph/edge';
import { ControlFlow } from '../../../../control-flow';
import { type DataflowGraphVertexFunctionDefinition, type DataflowGraphVertexInfo, EnvOpKind, VertexType } from '../../../../../graph/vertex';
import type { AstIdMap, ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { Writable } from 'ts-essentials';
import { makeAllMaybe } from '../../../../../environments/reference-to-maybe';
import { readRemovals, cancelRevivedKills, dropKilledWrites, makeKillsMaybe } from '../../../../../environments/apply-kill';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { valueFromTsValue } from '../../../../../eval/values/general';
import { DfgVertex } from '../../../../../graph/vertex';
import { addEnvironmentWrites, linkClosureFrameReads } from './built-in-envir-utils';
import { instantiateEnvOps } from './built-in-deferred-env-ops';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import { Resolve } from '../../../../../environments/resolve-helper';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { DefaultMap } from '../../../../../../util/collections/defaultmap';
import { compactRecord } from '../../../../../../util/objects';
import { applyAmbientStateOfCalledBuiltIns, autoPrints, mayForce, readsOfAutoPrint } from './built-in-ambient-state';
import { AmbientStateName } from '../../../../../environments/ambient-state-name';
import { Dataflow } from '../../../../../graph/df-helper';
import { type ClassFlowInfo, s3Dispatch, s3DispatchClassesOf } from '../../../../../fn/dispatch';
import { internalGenericMethods, linkedFunctionIds } from '../../../../dispatch-linking';
import { REnvironment } from '../../../../../environments/environment';
import { isGroupGeneric, s3MethodPrefixesOf } from '../../../../../environments/group-generics';
import { InternalGenerics } from '../../../../../environments/default-builtin-config';
import { CallProp, CallProps } from '../../../../../environments/built-in-props';

/** Whether the definitions of this list among the `targets` of a read cover every branch, alone or together. */
function coveredByListDefinitions(targets: readonly IdentifierDefinition[], listEnvironments: Set<NodeId>): boolean {
	const own = targets.filter(t => listEnvironments.has(t.nodeId));
	if(own.some(t => t.cds === undefined)) {
		return true;
	}
	return own.length > 0 && happensInEveryBranch(own.flatMap(t => t.cds ?? []));
}

/** The functions an active binding (`makeActiveBinding`) bound by `target` runs, the binding itself or the call making it. */
function activeFunctionsOf(target: NodeId, graph: DataflowGraph): NodeId[] {
	const bindings = DfgVertex.isFunctionCall(graph.getVertex(target)) ? Dataflow.sourcesOf(graph, target, EdgeType.DefinedBy) : [target];
	return bindings.flatMap(b => DfgVertex.isVariableDefinition(graph.getVertex(b)) ? Dataflow.targetsOf(graph, b, EdgeType.Calls) : [])
		.filter(fn => DfgVertex.isFunctionDefinition(graph.getVertex(fn)));
}

/** The active bindings of an environment the name `holder` held that the expression assigns to (`e$s <- v`, `e[["s"]] <- v`, `assign("s", v, envir = e)`), with the call assigning and the functions each runs. */
function writtenActiveFields(holder: BrandedIdentifier, before: REnvironmentInformation, after: REnvironmentInformation, graph: DataflowGraph): [NodeId, NodeId, NodeId[]][] {
	const states = (env: REnvironmentInformation) => (Resolve.byName(holder, env) ?? []).map(d => (d as InGraphIdentifierDefinition).envState?.current).filter(isNotUndefined);
	const olds = states(before);
	const fields: [NodeId, NodeId, NodeId[]][] = [];
	for(const now of olds.length === 0 ? [] : states(after).filter(n => !olds.includes(n))) {
		for(const [name, defs] of now.memory) {
			const replaced = olds.flatMap(o => o.lookup(name) ?? []);
			const added = defs.filter(d => !replaced.some(b => b.nodeId === d.nodeId) && !NodeId.isBuiltIn(d.definedAt));
			for(const b of added.length > 0 ? replaced : []) {
				const fns = activeFunctionsOf(b.nodeId, graph);
				for(const d of fns.length > 0 ? added : []) {
					fields.push([d.definedAt, b.nodeId, fns]);
					/* the binding stays active, so the next access runs it again */
					for(const fn of fns) {
						graph.addEdge(d.nodeId, fn, EdgeType.Calls);
					}
				}
			}
		}
	}
	return fields;
}

/** Every access of an active binding runs its function, whether through an environment (`e$ab`, `get("ab", e)`, `as.list(e)`) or by assigning to it (`ab <- 2`): a read becomes a call of it, as one of the list does (see `activeReads`), the calls accessing it call it too and are handed back. */
function callActiveBindingsAccessed(processed: DataflowInformation, before: REnvironmentInformation, graph: DataflowGraph, activeReads: IdentifierReference[]): NodeId[] {
	const calls: NodeId[] = [];
	const readIds = new Set(activeReads.map(r => r.nodeId));
	const call = (id: NodeId, fns: readonly NodeId[], binding: NodeId) => {
		const vertex = graph.getVertex(id);
		if(DfgVertex.isUse(vertex)) {
			const node = graph.idMap?.get(id);
			if(!readIds.has(id) && node !== undefined && RSymbol.is(node)) {
				readIds.add(id);
				activeReads.push({ nodeId: id, name: node.content, cds: vertex.cds, type: ReferenceType.Variable });
			}
		} else if(DfgVertex.isFunctionCall(vertex) && !fns.every(fn => Dataflow.hasEdge(graph, id, fn, EdgeType.Calls))) {
			graph.addEdge(id, binding, EdgeType.Reads);
			for(const fn of fns) {
				const definition = graph.getVertex(fn);
				if(DfgVertex.isFunctionDefinition(definition) && graph.idMap !== undefined) {
					/* an access is no call of its own, so the binding's function sees what is bound where the access is */
					linkFunctionCallWithSingleTarget(graph, definition, { ...vertex, environment: vertex.environment ?? before }, graph.idMap);
				}
			}
			calls.push(id);
		}
	};
	for(const [id] of processed.graph.vertices(true)) {
		for(const target of Dataflow.targetsOf(graph, id, EdgeType.Reads)) {
			const fns = activeFunctionsOf(target, graph);
			if(fns.length > 0) {
				call(id, fns, target);
			}
		}
	}
	for(const written of processed.out) {
		const bound = written.name === undefined || !('definedAt' in written) ? [] : Resolve.byName(written.name, before) ?? [];
		for(const binding of bound) {
			const fns = binding.nodeId === written.nodeId ? [] : activeFunctionsOf(binding.nodeId, graph);
			if(fns.length > 0) {
				call((written as InGraphIdentifierDefinition).definedAt, fns, binding.nodeId);
			}
		}
	}
	/* the environment is named where it is written or read, `assign("s", v, envir = e)` only reads `e` */
	const used = processed.graph.vertexIdsOfType(VertexType.Use).map(id => graph.idMap?.get(id)).filter(RSymbol.is).map(s => s.content);
	const holders = new Set([...processed.out.map(r => r.name).filter(isNotUndefined), ...used].map(Identifier.getName));
	for(const holder of holders) {
		for(const [at, field, fns] of writtenActiveFields(holder, before, processed.environment, graph)) {
			call(at, fns, field);
		}
	}
	return calls;
}

/** A call handing an environment to a function reading it accesses the environment's active bindings, which only linking the call shows: `f <- function(env) env$a; f(e)`, as does a call of a function reading one it sees: `f <- function() ab; f()`. */
function bindingsCalledThroughCallees(processed: DataflowInformation, before: REnvironmentInformation, graph: DataflowGraph, known: readonly NodeId[], linked: readonly CalledFunctions[]): CalledFunctions[] {
	if(!mayForce(before)) {
		return [];
	}
	const read = linked.flatMap(({ functionCall, called }) => [...transitivelyCalledDefinitions(called, graph, before)].flatMap(({ fn }) => activeBindingsReadIn(fn, functionCall, before, graph)));
	return read.concat(callActiveBindingsAccessed(processed, before, graph, []).filter(id => !known.includes(id)).map(functionCall => {
		const fns = new Set(Dataflow.targetsOf(graph, functionCall, EdgeType.Reads).flatMap(t => activeFunctionsOf(t, graph)));
		for(const callee of Dataflow.calleeIdsOf(graph, functionCall).filter(c => !fns.has(c))) {
			readAccessesOfParameters(functionCall, graph.getVertex(callee), graph);
		}
		const called = [...fns].map(fn => graph.getVertex(fn)).filter(v => DfgVertex.isFunctionDefinition(v));
		return { functionCall, called, propagateExitPoints: [] };
	}));
}

/** The active bindings the calls `linked` access through the environments their callees read or write once the calls ran those operations (see {@link instantiateEnvOps}): `g <- function(env) assign("s", 3, envir = env); g(e)`. */
function bindingsAccessedByEnvOps(linked: readonly CalledFunctions[], processed: DataflowInformation, before: REnvironmentInformation, after: REnvironmentInformation, graph: DataflowGraph): CalledFunctions[] {
	const found: CalledFunctions[] = [];
	const runs = (functionCall: NodeId, binding: NodeId, fns: readonly NodeId[], access?: NodeId) => {
		graph.addEdge(functionCall, binding, EdgeType.Reads);
		if(access !== undefined) {
			graph.addEdge(functionCall, access, EdgeType.Reads);
		}
		found.push({ functionCall, called: fns.map(f => graph.getVertex(f)).filter(v => DfgVertex.isFunctionDefinition(v)), propagateExitPoints: [], alternatives: true });
	};
	for(const { functionCall, called } of linked) {
		for(const { fn } of transitivelyCalledDefinitions(called, graph, before)) {
			for(const op of fn.envOps?.filter(o => o.kind === EnvOpKind.Read) ?? []) {
				for(const binding of Dataflow.targetsOf(graph, op.id, EdgeType.Reads)) {
					const fns = activeFunctionsOf(binding, graph);
					if(fns.length > 0) {
						runs(functionCall, binding, fns, op.id);
					}
				}
			}
		}
	}
	const used = new Set(processed.graph.vertexIdsOfType(VertexType.Use).map(id => graph.idMap?.get(id)).filter(RSymbol.is).map(s => Identifier.getName(s.content)));
	for(const holder of used) {
		for(const [at, field, fns] of writtenActiveFields(holder, before, after, graph)) {
			runs(at, field, fns);
		}
	}
	return found;
}

/** The active bindings the body of `fn` reads, which the call `functionCall` running it runs: those its reads are linked to, and those its free reads see where the call is (`environment`). */
function activeBindingsReadIn(fn: DataflowGraphVertexFunctionDefinition, functionCall: NodeId, environment: REnvironmentInformation, graph: DataflowGraph): CalledFunctions[] {
	const found: CalledFunctions[] = [];
	const read = (id: NodeId, binding: NodeId) => {
		const called = activeFunctionsOf(binding, graph).map(f => graph.getVertex(f)).filter(v => DfgVertex.isFunctionDefinition(v));
		if(called.length > 0) {
			/* the access runs the binding only as the call does */
			graph.addEdge(functionCall, binding, EdgeType.Reads);
			graph.addEdge(functionCall, id, EdgeType.Reads);
			/* the body may not reach the access */
			found.push({ functionCall, called, propagateExitPoints: [], alternatives: true });
		}
	};
	for(const id of fn.subflow.graph) {
		/* a free read of the body is bound where the function is called */
		const bindings = Dataflow.targetsOf(graph, id, EdgeType.Reads | EdgeType.DefinedByOnCall);
		for(const binding of bindings) {
			read(id, binding);
		}
		/* one the call of a function around the body is left to resolve (see `linkLiftedReads`) is read there, with the field it accesses */
		const name = bindings.length === 0 && DfgVertex.isUse(graph.getVertex(id)) && graph.idMap !== undefined ? NodeId.recoverBareName(id, graph.idMap) : undefined;
		for(const holder of name === undefined ? [] : Resolve.byName(name, environment) ?? []) {
			read(id, holder.nodeId);
			if(hasEnvState(holder) && graph.idMap !== undefined) {
				bindAccessedField(graph, id, holder.envState, graph.idMap, functionCall);
				const node = graph.idMap.get(id);
				const access = node === undefined ? undefined : RNode.directParent(node, graph.idMap)?.info.id;
				Dataflow.targetsOf(graph, access ?? id, EdgeType.Reads).forEach(field => read(id, field));
			}
		}
	}
	for(const ref of fn.subflow.in) {
		for(const binding of ref.name === undefined ? [] : Resolve.byName(ref.name, environment) ?? []) {
			read(ref.nodeId, binding.nodeId);
		}
	}
	return found;
}

/** The call `call` runs the accesses of `callee` to what its parameters hold: `env$a` and `get(n, envir = env)` for the parameter `env`. */
function readAccessesOfParameters(call: NodeId, callee: DataflowGraphVertexInfo | undefined, graph: DataflowGraph): void {
	const idMap = graph.idMap;
	if(!DfgVertex.isFunctionDefinition(callee) || idMap === undefined) {
		return;
	}
	for(const param of Object.keys(callee.params)) {
		for(const reader of Dataflow.sourcesOf(graph, NodeId.normalize(param), EdgeType.Reads)) {
			const node = idMap.get(reader);
			let access = node && RNode.directParent(node, idMap);
			if(access !== undefined && RArgument.is(access)) {
				access = RNode.directParent(access, idMap);
			}
			if(access !== undefined && DfgVertex.isFunctionCall(graph.getVertex(access.info.id))) {
				graph.addEdge(call, access.info.id, EdgeType.Reads);
			}
		}
	}
}

/** @returns whether `read` sees a definition */
function linkReadNameToWriteIfPossible(read: IdentifierReference, environments: REnvironmentInformation, listEnvironments: Set<NodeId>, remainingRead: DefaultMap<BrandedIdentifier | undefined, IdentifierReference[]>, nextGraph: DataflowGraph, activeReads: IdentifierReference[]): boolean {
	const readName = Identifier.boundAs(read.name);
	const probableTarget = readName ? Resolve.byNameAndType(readName, scopeOf(read, environments), read.type) : undefined;

	/* without a target the read stays ingoing (read-ids are unique within the same fold), a later fold may still resolve it */
	if(probableTarget === undefined || !coveredByListDefinitions(probableTarget, listEnvironments)) {
		const has = remainingRead.get(readName ? Identifier.getName(readName) : undefined);
		if(!has.some(h => h.nodeId === read.nodeId && h.name === read.name && h.cds === read.cds)) {
			has.push(read);
		}
	}
	if(probableTarget === undefined) {
		return false;
	}

	const rid = read.nodeId;
	readRemovals(nextGraph, rid, readName, environments);
	const isFunc = read.type === ReferenceType.Function || read.type === ReferenceType.BuiltInFunction;
	for(const target of probableTarget) {
		const tid = target.nodeId;
		const owner = NodeId.isBuiltIn(tid) && target.name !== undefined ? Identifier.getNamespace(target.name) : undefined;
		/* a package object is only bound once the load attaching it ran */
		for(const load of owner === undefined ? [] : loadNodesForNamespace(environments, String(owner))) {
			nextGraph.addEdge(rid, load, EdgeType.Reads);
		}
		if(NodeId.isBuiltIn(target.definedAt) && isFunc) {
			nextGraph.addEdge(rid, tid, EdgeType.Reads | EdgeType.Calls);
		} else {
			nextGraph.addEdge(rid, tid, EdgeType.Reads);
			if(!isFunc && read.name !== undefined && DfgVertex.isUse(nextGraph.getVertex(rid)) && DfgVertex.isVariableDefinition(nextGraph.getVertex(tid)) && Dataflow.targetsOf(nextGraph, tid, EdgeType.Calls).length > 0) {
				activeReads.push(read);
			}
		}
		if(target.type === ReferenceType.BuiltInConstant) {
			nextGraph.addVertex({
				tag:   VertexType.Value,
				id:    tid,
				cds:   undefined,
				value: valueFromTsValue(target.value)
			}, environments, false);
		}
	}
	return true;
}

interface TransitiveCallee<Fn = DataflowGraphVertexInfo> {
	readonly fn:      Fn
	/** called by the call itself rather than by one of its callees */
	readonly direct?: boolean
	/** the calls on the way to the function, each in the body of the function the one before calls, unless it is `direct` */
	readonly chain?:  readonly NodeId[]
	readonly cds?:    readonly ControlDependency[]
}

/** Expands `initial` with everything it transitively calls, so a `<<-` escaping several call levels still folds into the caller. */
function* transitivelyCalledDefinitions(initial: readonly DataflowGraphVertexInfo[], graph: DataflowGraph, resolveEnv: REnvironmentInformation): Generator<TransitiveCallee<DataflowGraphVertexFunctionDefinition>> {
	const seen = new Set<NodeId>();
	const stack: TransitiveCallee[] = initial.map(fn => ({ fn, direct: true }));
	for(let next = stack.pop(); next !== undefined; next = stack.pop()) {
		const { fn, direct, chain, cds } = next;
		if(!DfgVertex.isFunctionDefinition(fn) || seen.has(fn.id)) {
			continue;
		}
		seen.add(fn.id);
		yield { fn, direct, chain, cds };
		for(const [id, call] of Dataflow.callsIn(fn, graph)) {
			if(call.onlyBuiltin || call.name === undefined) {
				continue;
			}
			const resolved = Resolve.byNameAndType(call.name, resolveEnv, ReferenceType.Function);
			if(resolved === undefined) {
				continue;
			}
			const [targets] = getAllLinkedFunctionDefinitions(new Set(resolved.map(r => r.nodeId)), graph);
			for(const target of targets) {
				/* a callee reached only on some paths writes only maybe */
				stack.push({ fn: target, chain: [...chain ?? [], id], cds: call.cds === undefined ? cds : [...cds ?? [], ...call.cds] });
			}
		}
	}
}

/** Drops the top frame, keeping its definitions in the frame below (they outlive it, see the caller). */
function foldFrameIntoParent({ current, level }: REnvironmentInformation): REnvironmentInformation {
	const parent = current.parent.clone(false);
	for(const [name, definitions] of current.memory) {
		parent.writableMemory.set(name, definitions);
	}
	return { current: parent, level: level - 1 };
}

const PrintName = Identifier.make('print');

/** Printing a visible top-level value (or one `capture.output` captures) dispatches to the `print` methods in scope, so the expression calls them: those for the classes the value may have, and what their `NextMethod()` may run, every one if the classes are not known. */
export function printMethodsOf(id: NodeId, environment: REnvironmentInformation, graph: DataflowGraph, info: ClassFlowInfo): ReturnType<typeof linkFunctionCalls> {
	/* printing runs what `print` dispatches to on its own, like `show` for an S4 object */
	const internal = internalGenericMethods(info.ctx.env.builtInFunctionOf(PrintName)?.config?.dispatches ?? [], environment, graph);
	const all = (Resolve.byNameAndType('print', environment, ReferenceType.S3MethodPrefix)?.filter(d => !NodeId.isBuiltIn(d.nodeId)) ?? []).concat(internal);
	const classes = all.length === 0 ? undefined : s3DispatchClassesOf(id, info);
	const methods = printedBy(classes, all, graph);
	if(methods.length === 0) {
		return [];
	}
	for(const method of methods) {
		graph.addEdge(id, method.nodeId, EdgeType.Reads);
	}
	const called = [...getAllLinkedFunctionDefinitions(new Set(methods.map(m => m.nodeId)), graph)[0]];
	/* a method bound outside the graph at hand (of the code `capture.output` prints) is the closure its binding holds */
	for(const value of methods.flatMap(m => graph.hasVertex(m.nodeId) || !isInGraphDefinition(m) ? [] : m.value ?? [])) {
		graph.addEdge(id, value, EdgeType.Calls);
	}
	/* what an internal generic returns, like `format` for a column, is what is printed */
	const returning = new Set(linkedFunctionIds(new Set(internal.map(m => m.nodeId)), graph));
	for(const method of called) {
		graph.addEdge(id, method.id, EdgeType.Calls);
		for(const exit of returning.has(method.id) ? method.exitPoints : []) {
			graph.addEdge(id, exit.nodeId, EdgeType.Reads);
		}
	}
	for(const ref of called.flatMap(c => c.subflow.in)) {
		for(const def of ref.name === undefined ? [] : Resolve.byNameAndType(ref.name, environment, ref.type) ?? []) {
			if(!NodeId.isBuiltIn(def.nodeId)) {
				graph.addEdge(ref.nodeId, def.nodeId, EdgeType.Reads);
			}
		}
	}
	return [{ functionCall: id, called, propagateExitPoints: [], alternatives: called.length > 1 }];
}

/** A call of a built-in generic (`length(x)`, `x$a`, `x + 1`) may run the `<name>.<class>` methods the code itself binds for it, and `new` the `initialize` methods, so it changes what they change, each only maybe. */
function ownMethodsCalledBy(thisGraph: DataflowGraph, environment: REnvironmentInformation, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): CalledFunctions[] {
	const methods = new Map<NodeId, NodeId[]>();
	const add = (call: NodeId, ids: readonly NodeId[]) => methods.set(call, [...methods.get(call) ?? [], ...ids]);
	/* the calls by each name whose `<name>.<class>` methods they may run */
	const generics = new Map<string, NodeId[]>();
	const methodsBound = REnvironment.findBuiltIn(environment.current).methods === true;
	for(const [id, call] of thisGraph.verticesOfType(VertexType.FunctionCall)) {
		if(!call.onlyBuiltin || call.name === undefined || !thisGraph.isRoot(id)) {
			continue;
		}
		/* a built-in may run generics of its own as well (`nrow(x)` asks `dim(x)`) */
		const prefixes = methodsBound ? [...isBuiltInGeneric(call.name, ctx) ? s3MethodPrefixesOf(call.name) : [], ...ctx.env.builtInFunctionOf(call.name)?.config?.dispatches ?? []] : [];
		prefixes.forEach(prefix => generics.set(prefix, [...generics.get(prefix) ?? [], id]));
		if(call.initializer !== undefined) {
			add(id, Dataflow.targetsOf(graph, id, EdgeType.Calls).filter(t => !NodeId.isBuiltIn(t)));
		}
	}
	for(const frame of generics.size > 0 ? REnvironment.frames(environment.current) : []) {
		/* the frames of the packages bind their own methods, which the configuration states */
		if(frame.t !== undefined || frame.builtInEnv) {
			break;
		}
		for(const [name, definitions] of frame.memory) {
			for(let dot = name.indexOf('.', 1); dot > 0; dot = name.indexOf('.', dot + 1)) {
				for(const call of generics.get(name.slice(0, dot)) ?? []) {
					add(call, definitions.filter(d => !NodeId.isBuiltIn(d.nodeId)).map(d => d.nodeId));
				}
			}
		}
	}
	const found: CalledFunctions[] = [];
	for(const [functionCall, ids] of methods) {
		const called = [...getAllLinkedFunctionDefinitions(new Set(ids), graph)[0]];
		if(called.length > 0) {
			found.push({ functionCall, called, propagateExitPoints: [], alternatives: true });
		}
	}
	return found;
}

function isBuiltInGeneric(name: Identifier, ctx: ReadOnlyFlowrAnalyzerContext): boolean {
	return InternalGenerics.has(Identifier.getName(name)) || CallProps.hasAny(ctx.env.builtInFunctionOf(name)?.config, CallProp.Generic);
}

/** Notes a binding of `name` a call of a built-in generic may dispatch to (`length.foo`, `Ops.foo`), as only then the calls look for such methods (see {@link ownMethodsCalledBy}). */
export function noteOwnMethod(name: Identifier, environment: REnvironmentInformation, ctx: ReadOnlyFlowrAnalyzerContext): void {
	const plain = Identifier.getName(name);
	for(let dot = plain.indexOf('.', 1); dot > 0; dot = plain.indexOf('.', dot + 1)) {
		const prefix = plain.slice(0, dot);
		if(isGroupGeneric(prefix) || isBuiltInGeneric(prefix, ctx)) {
			REnvironment.findBuiltIn(environment.current).methods = true;
			return;
		}
	}
}

/** Of the definitions `found` for `print`, those printing a value of the class vectors `classes` may run (all of them if the classes are not known), with any that is no `print.<class>` method; links the `NextMethod()` calls of each to the methods after it, any other one if the classes are not known. */
function printedBy(classes: readonly (readonly ClassName[])[] | undefined, found: readonly IdentifierDefinition[], graph: DataflowGraph): readonly IdentifierDefinition[] {
	const methodOf = (d: IdentifierDefinition) => d.name === undefined ? undefined : /^print\.(.+)$/.exec(Identifier.getName(d.name))?.[1];
	const { runs, next } = classes === undefined ? { runs: new Set(found), next: new Map(found.map(m => [m, new Set(found.filter(o => o !== m))])) } : s3Dispatch(classes, found, methodOf);
	for(const [method, after] of next) {
		const targets = linkedFunctionIds(new Set([...after].map(m => m.nodeId)), graph);
		for(const fn of getAllLinkedFunctionDefinitions(new Set([method.nodeId]), graph)[0]) {
			for(const [call, vertex] of Dataflow.callsIn(fn, graph)) {
				if(DfgVertex.hasOrigin(vertex, BuiltInProcName.S3DispatchNext)) {
					targets.forEach(t => graph.addEdge(call, t, EdgeType.Calls));
				}
			}
		}
	}
	return found.filter(d => runs.has(d) || methodOf(d) === undefined);
}

/** The bindings of every package layer `env` sees, which a callee's environment shares while nothing writes to them. */
function packageLayersOf(env: REnvironmentInformation): Set<MemoryView> {
	const layers = new Set<MemoryView>();
	for(const current of REnvironment.frames(env.current)) {
		if(current.t !== undefined) {
			layers.add(current.memory);
		}
	}
	return layers;
}

function updateSideEffectsForCalledFunctions(calledEnvs: ReturnType<typeof linkFunctionCalls>, inputEnvironment: REnvironmentInformation, nextGraph: DataflowGraph, localDefs: readonly IdentifierReference[], idMap: AstIdMap, listEnvironments: Set<NodeId>, ctx: ReadOnlyFlowrAnalyzerContext) {
	for(const { functionCall, called, alternatives } of calledEnvs) {
		const callDependencies = nextGraph.getVertex(functionCall)?.cds;
		for(const { fn: calledFn, direct, chain, cds } of transitivelyCalledDefinitions(called, nextGraph, inputEnvironment)) {
			if(direct) {
				linkClosureFrameReads(functionCall, calledFn, inputEnvironment, nextGraph);
			}
			inputEnvironment = instantiateEnvOps(functionCall, calledFn, chain ?? [], inputEnvironment, nextGraph, ctx);
			/* walk the smaller of the two, a script may hold many unknown side effects and a function many vertices */
			const inside = calledFn.subflow.graph;
			const effects = nextGraph.unknownSideEffects;
			for(const effect of inside.size < effects.size ? inside : effects) {
				if(typeof effect !== 'object' && inside.has(effect) && effects.has(effect)) {
					/* every call on the way makes it */
					for(const call of [functionCall, ...chain ?? []]) {
						nextGraph.addEdge(effect, call, EdgeType.SideEffectOnCall);
					}
				}
			}
			// only merge the environments they have in common
			let environment = calledFn.subflow.environment;
			if(environment.level > inputEnvironment.level) {
				/* the callee's own frame dies with the call */
				environment = REnvironment.popLocal(environment);
				/* frames above the caller are ones its closure captured, so fold them back instead of losing their writes */
				while(environment.level > inputEnvironment.level) {
					environment = foldFrameIntoParent(environment);
				}
			}
			let hasUpdate = false;
			const written: IdentifierDefinition[] = [];
			const envWrites: IdentifierDefinition[] = [];
			const seenByCaller = packageLayersOf(inputEnvironment);
			for(const current of REnvironment.frames(environment.current)) {
				if(current.t !== undefined) {
					/* the callee sees the caller's packages too, but only one attached inside the body (library()) is its doing, and propagates like R attaching globally */
					if(seenByCaller.has(current.memory)) {
						continue;
					}
					hasUpdate = true;
				}
				for(const definitions of current.memory.values()) {
					for(const def of definitions) {
						if(!NodeId.isBuiltIn(def.definedAt)) {
							hasUpdate = true;
							written.push(def);
							nextGraph.addEdge(def.nodeId, functionCall, EdgeType.SideEffectOnCall);
							/* what a call of the list writes is written by the list, a later read of it looks no further */
							listEnvironments.add(def.nodeId);
							if((def as InGraphIdentifierDefinition).envWrites === true) {
								envWrites.push(def);
							}
						}
					}
				}
			}
			if(!hasUpdate) {
				continue;
			}
			linkWritesCarriedByLoop(nextGraph, functionCall, written, idMap);
			if(envWrites.length > 0) {
				[environment, inputEnvironment] = addEnvironmentWrites(envWrites, environment, inputEnvironment, functionCall, nextGraph);
			}
			const shadowing = localDefs.filter(d => isNotUndefined(d.name) && idMap.has(functionCall) && RNode.findEnclosing(d.nodeId, idMap, n => n.info.id === functionCall) === undefined);
			if(shadowing.length > 0) {
				environment = {
					current: environment.current.removeAll(shadowing as { name: BrandedIdentifier }[]),
					level:   environment.level
				};
			}
			const dependencies = cds === undefined ? callDependencies : [...callDependencies ?? [], ...cds];
			inputEnvironment = alternatives ? REnvironment.append(inputEnvironment, environment) : REnvironment.overwrite(inputEnvironment, environment, dependencies);
		}
	}
	return inputEnvironment;
}

/** Processes a list of expressions joining their dataflow graphs accordingly. */
export function processExpressionList<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	let { environment } = data;
	const idMap = data.completeAst.idMap;
	/* the writes of this list, to detect whether a read sees one of them */
	const listEnvironments = new Set<NodeId>();
	const remainingRead = new DefaultMap<BrandedIdentifier | undefined, IdentifierReference[]>(() => []);
	const nextGraph = new DataflowGraph(idMap);
	const out: IdentifierReference[] = [];
	/* lazily created - `rm` is rare, so rm-free lists never allocate this */
	let killed: KillReference[] | undefined;
	const exitPoints: ExitPoint[] = [];
	/* what the list stands under as a whole, copied since the vertices share and extend that array */
	const context = data.cds?.slice();
	const invertExitCds: ControlDependency[] = [];

	const processedExpressions: (DataflowInformation | undefined)[] = [];
	let defaultReturnExpr: DataflowInformation | undefined;
	/* R prints what the top level of the analyzed script leaves visible, but not what a sourced file does */
	const fileRoot = data.completeAst.ast.files.some(f => f.root.info.id === rootId);
	const autoPrint = data.referenceChain.length <= 1 && data.environment.level === 0 && fileRoot;
	let initialState: Set<IdentifierReference> | undefined;
	const hooks: DataflowInformation['hooks'] = [];

	for(const arg of args) {
		const expression = RArgument.unnamedValueOf(arg);
		if(expression === undefined) {
			processedExpressions.push(undefined);
			continue;
		}
		(data as Writable<DataflowProcessorInformation<OtherInfo & ParentInformation>>).environment = environment;
		/* a statement runs first where it is first analyzed, a file sourced again later does not move it */
		const order = fileRoot && !data.statementOrder?.has(expression.info.id) ? data.statementOrder : undefined;
		const span: [number, number] | undefined = order === undefined ? undefined : [order.size, Infinity];
		if(span !== undefined) {
			order?.set(expression.info.id, span);
		}
		let processed = processDataflowFor(expression, data);
		if(span !== undefined) {
			span[1] = order?.size ?? Infinity;
		}
		const printed = autoPrint && autoPrints(expression, processed, data);
		if(printed) {
			processed = readsOfAutoPrint(processed, expression, data);
		}
		processedExpressions.push(processed);
		/* the expression's graph dies here, what is kept of it afterward is its entry point and its references */
		nextGraph.mergeWith(processed.graph, true, true);
		defaultReturnExpr = processed;
		/* a prior next/break means we do not know if the rest executes, so later environments append rather than overwrite */
		if(exitPoints.length > 0) {
			processed.out = makeAllMaybe(processed.out, nextGraph, processed.environment, true, invertExitCds);
			processed.in = makeAllMaybe(processed.in, nextGraph, processed.environment, false, invertExitCds);
			processed.unknownReferences = makeAllMaybe(processed.unknownReferences, nextGraph, processed.environment, false);
		}
		hooks.push(...processed.hooks);

		// all inputs that have not been written until now are read!
		const activeReads: IdentifierReference[] = [];
		for(const read of processed.in.concat(processed.unknownReferences)) {
			if(!linkReadNameToWriteIfPossible(read, environment, listEnvironments, remainingRead, nextGraph, activeReads) && autoPrint && AmbientStateName.is(read.name)) {
				(initialState ??= new Set()).add(read);
			}
		}
		const accessing = mayForce(environment) ? callActiveBindingsAccessed(processed, environment, nextGraph, activeReads) : [];
		for(const read of activeReads) {
			nextGraph.updateToFunctionCall({ tag: VertexType.FunctionCall, id: read.nodeId, name: read.name as Identifier, args: [], environment, onlyBuiltin: false, cds: read.cds, origin: [BuiltInProcName.Function] });
		}

		const calledEnvs = linkFunctionCalls(nextGraph, idMap, processed.graph, [...activeReads.map(r => r.nodeId), ...accessing]);
		if(accessing.length > 0 || calledEnvs.length > 0) {
			calledEnvs.push(...bindingsCalledThroughCallees(processed, environment, nextGraph, accessing, calledEnvs));
		}
		calledEnvs.push(...ownMethodsCalledBy(processed.graph, environment, nextGraph, data.ctx));
		if(printed) {
			calledEnvs.push(...printMethodsOf(processed.entryPoint, environment, nextGraph, { graph: nextGraph, idMap, ctx: data.ctx, environment }));
		}
		for(const c of calledEnvs) {
			if(c.propagateExitPoints.length > 0 && errorEscapes(c.functionCall, expression.info.id, idMap, nextGraph)) {
				(processed.exitPoints as Writable<ExitPoint[]>).push(...c.propagateExitPoints);
			}
		}
		for(const c of calledEnvs) {
			if(c.calledBuiltIns !== undefined) {
				processed = applyAmbientStateOfCalledBuiltIns(processed, c.functionCall, c.calledBuiltIns, environment, nextGraph, data);
			}
		}

		addNonDefaultExitPoints(exitPoints, invertExitCds, data.cds, processed.exitPoints);
		environment = exitPoints.length > 0 ? REnvironment.overwrite(environment, processed.environment) : processed.environment;
		// if the called function has global redefinitions, we have to keep them within our environment
		const beforeCalls = environment;
		environment = updateSideEffectsForCalledFunctions(calledEnvs, environment, nextGraph, processed.out, idMap, listEnvironments, data.ctx);
		const viaEnvOps = calledEnvs.length > 0 && mayForce(environment) ? bindingsAccessedByEnvOps(calledEnvs, processed, beforeCalls, environment, nextGraph) : [];
		if(viaEnvOps.length > 0) {
			environment = updateSideEffectsForCalledFunctions(viaEnvOps, environment, nextGraph, processed.out, idMap, listEnvironments, data.ctx);
		}

		// removals are already reflected in the threaded environment; we only bubble them (net of later writes)
		if(killed && processed.out.length > 0) {
			killed = cancelRevivedKills(killed, processed.out);
		}
		if(processed.kill?.length) {
			// if we may have already exited (break/next), the removal only happens maybe
			const kills = exitPoints.length > 0 ? makeKillsMaybe(processed.kill, invertExitCds) : processed.kill;
			(killed ??= []).push(...kills);
		}

		for(const ref of processed.out) {
			out.push(ref);
			listEnvironments.add(ref.nodeId);
		}

		/* if at least one exit point encountered happens unconditionally, we exit here (dead code) */
		if(ControlFlow.alwaysExits(processed, context)) {
			/* if there is an always-exit expression, there is no default return active anymore */
			defaultReturnExpr = undefined;
			break;
		}
	}

	if(defaultReturnExpr) {
		exitPoints.push(compactRecord({ type: ExitPointType.Default, nodeId: defaultReturnExpr.entryPoint, cds: data.cds }));
	}

	const ingoing: IdentifierReference[] = [...remainingRead.values()].flat();
	const withGroup = idMap.get(rootId)?.grouping;

	if(withGroup) {
		ingoing.push({ nodeId: rootId, name: name.content, cds: data.cds, type: ReferenceType.Function });
		patchFunctionCall({
			nextGraph,
			rootId,
			name,
			data,
			argumentProcessResult: processedExpressions,
			origin:                BuiltInProcName.ExpressionList
		});
		nextGraph.addEdge(rootId, NodeId.toBuiltIn('{'), EdgeType.Reads | EdgeType.Calls);
		for(const exit of exitPoints) {
			if(exit.type === ExitPointType.Return || exit.type === ExitPointType.Default) {
				nextGraph.addEdge(rootId, exit.nodeId, EdgeType.Returns);
			}
		}
	}

	const meId = withGroup ? rootId : (processedExpressions.find(isNotUndefined)?.entryPoint ?? rootId);
	/* an empty group completes on the spot, otherwise the last expression has to be able to reach the end */
	const reachesEnd = !!withGroup && (processedExpressions.length === 0 || exitPoints.some(e => e.type === ExitPointType.Default));
	const cfgEntry = ControlFlow.inSequence(nextGraph, processedExpressions, reachesEnd ? rootId : undefined);
	/* `{ break }` is entered and left by the jump within it, so its `{` is where that jump leaves the group: whatever catches the jump continues from there instead of from within the group, which keeps the `{` on the control flow rather than beside it as a vertex nothing leads away from. */
	if(withGroup && !reachesEnd) {
		for(let i = 0; i < exitPoints.length; i++) {
			const exit = exitPoints[i];
			nextGraph.addEdge(exit.nodeId, rootId, EdgeType.FlowEdge);
			/* what a `return` hands back and what a `stop` raises stay with the node that does it */
			if(exit.nodeId !== rootId && (exit.type === ExitPointType.Break || exit.type === ExitPointType.Next)) {
				exitPoints[i] = leaveThrough(exit, rootId);
			}
		}
	}

	return {
		/* no active nodes remain, they are consumed within the remaining read collection */
		unknownReferences: [],
		/* at the top of the script, only a read of the options or graphics state nothing set reads the state R starts with, which a write escaping a higher-order call may still replace, see the extractor */
		in:                autoPrint ? ingoing.filter(r => !AmbientStateName.is(r.name) || initialState?.has(r) === true) : ingoing,
		/* a definition that a still-effective removal undid is no longer visible to the outside */
		out:               dropKilledWrites(out, killed),
		environment,
		graph:             nextGraph,
		/* if we have no group, we take the last evaluated expr */
		entryPoint:        meId,
		cfgEntry:          cfgEntry === meId ? undefined : cfgEntry,
		cfgExit:           reachesEnd ? rootId : undefined,
		exitPoints,
		hooks,
		kill:              killed,
	};
}
