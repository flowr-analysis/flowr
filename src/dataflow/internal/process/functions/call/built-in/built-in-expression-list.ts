import type { ControlDependency, DataflowInformation, ExitPoint, KillReference } from '../../../../../info';
import { addNonDefaultExitPoints, ExitPointType, happensInEveryBranch, leaveThrough } from '../../../../../info';
import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import { getAllLinkedFunctionDefinitions, linkFunctionCalls } from '../../../../linker';
import { isNotUndefined } from '../../../../../../util/assert';
import { unpackNonameArg } from '../argument/unpack-argument';
import { patchFunctionCall } from '../common';
import type { Environment, REnvironmentInformation } from '../../../../../environments/environment';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { DataflowGraph } from '../../../../../graph/graph';
import { Identifier, type IdentifierDefinition, type IdentifierReference, ReferenceType } from '../../../../../environments/identifier';
import { EdgeType } from '../../../../../graph/edge';
import { ControlFlow } from '../../../../control-flow';
import { type DataflowGraphVertexFunctionDefinition, type DataflowGraphVertexInfo, VertexType } from '../../../../../graph/vertex';
import { popLocalEnvironment } from '../../../../../environments/scoping';
import { overwriteEnvironment } from '../../../../../environments/overwrite';
import type { AstIdMap, ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type PotentiallyEmptyRArgument, RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { Writable } from 'ts-essentials';
import { makeAllMaybe } from '../../../../../environments/reference-to-maybe';
import { removalsOf, cancelRevivedKills, dropKilledWrites, makeKillsMaybe } from '../../../../../environments/apply-kill';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { valueFromTsValue } from '../../../../../eval/values/general';
import { DfgVertex } from '../../../../../graph/vertex';
import { Resolve } from '../../../../../environments/resolve-helper';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RExpressionList } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RIfThenElse } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import { RWhileLoop } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import { RForLoop } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { DefaultMap } from '../../../../../../util/collections/defaultmap';
import { compactRecord } from '../../../../../../util/objects';
import { callsIn, edgeTargets } from '../../../../../fn/frame-reflection';
import { AmbientStateName, applyAmbientStateOfCalledBuiltIns, autoPrints, readsOfAutoPrint } from './built-in-ambient-state';

/**
 * Whether the definitions of this list among the `targets` of a read cover every branch, alone or together.
 * Only then the read is resolved here and must not bubble up as an ingoing reference.
 */
function coveredByListDefinitions(targets: readonly IdentifierDefinition[], listEnvironments: Set<NodeId>): boolean {
	const own = targets.filter(t => listEnvironments.has(t.nodeId));
	if(own.some(t => t.cds === undefined)) {
		return true;
	}
	return own.length > 0 && happensInEveryBranch(own.flatMap(t => t.cds ?? []));
}

/** Whether reading the variable defined at `id` calls a function, as for an active binding. */
function callsOnRead(graph: DataflowGraph, id: NodeId): boolean {
	return DfgVertex.isVariableDefinition(graph.getVertex(id)) && edgeTargets(graph, id, EdgeType.Calls).length > 0;
}

/** @returns whether `read` sees a definition */
function linkReadNameToWriteIfPossible(read: IdentifierReference, environments: REnvironmentInformation, listEnvironments: Set<NodeId>, remainingRead: DefaultMap<string | undefined, IdentifierReference[]>, nextGraph: DataflowGraph, activeReads: IdentifierReference[]): boolean {
	const readName = read.name && Identifier.isDotDotDotAccess(read.name) ? Identifier.dotdotdot() : read.name;
	const probableTarget = readName ? Resolve.byNameAndType(readName, environments, read.type) : undefined;

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
	const isFunc = read.type === ReferenceType.Function || read.type === ReferenceType.BuiltInFunction;
	if(readName !== undefined) {
		for(const removal of removalsOf(readName, environments)) {
			nextGraph.addEdge(rid, removal, EdgeType.Reads);
		}
	}
	for(const target of probableTarget) {
		const tid = target.nodeId;
		if(NodeId.isBuiltIn(target.definedAt) && isFunc) {
			nextGraph.addEdge(rid, tid, EdgeType.Reads | EdgeType.Calls);
		} else {
			nextGraph.addEdge(rid, tid, EdgeType.Reads);
			if(!isFunc && read.name !== undefined && DfgVertex.isUse(nextGraph.getVertex(rid)) && callsOnRead(nextGraph, tid)) {
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
	readonly fn:     Fn
	readonly direct: boolean
	readonly cds?:   readonly ControlDependency[]
}

/** Expands `initial` with everything it transitively calls, so a `<<-` escaping several call levels still folds into the caller. */
function* transitivelyCalledDefinitions(initial: readonly DataflowGraphVertexInfo[], graph: DataflowGraph, resolveEnv: REnvironmentInformation): Generator<TransitiveCallee<DataflowGraphVertexFunctionDefinition>> {
	const seen = new Set<NodeId>();
	const stack: TransitiveCallee[] = initial.map(fn => ({ fn, direct: true }));
	while(stack.length > 0) {
		const { fn, direct, cds } = stack.pop() as TransitiveCallee;
		if(!DfgVertex.isFunctionDefinition(fn) || seen.has(fn.id)) {
			continue;
		}
		seen.add(fn.id);
		yield { fn, direct, cds };
		for(const [, call] of callsIn(fn, graph)) {
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
				stack.push({ fn: target, direct: false, cds: call.cds === undefined ? cds : [...cds ?? [], ...call.cds] });
			}
		}
	}
}

/** Rebuilds `env` without its attached-package/namespace layers (`t !== undefined`), keeping only the lexical frames a `<<-` can bind. */
function withoutPackageLayers(env: REnvironmentInformation): REnvironmentInformation {
	let builtIn: Environment = env.current;
	const core: Environment[] = [];
	let hasPackage = false;
	while(!builtIn.builtInEnv) {
		if(builtIn.t === undefined) {
			core.push(builtIn);
		} else {
			hasPackage = true;
		}
		builtIn = builtIn.parent;
	}
	if(!hasPackage) {
		return env;
	}
	let parent: Environment = builtIn;
	for(let i = core.length - 1; i >= 0; i--) {
		const cloned = core[i].clone(false);
		cloned.parent = parent;
		parent = cloned;
	}
	return { current: parent, level: env.level };
}

/** Drops the top frame, keeping its definitions in the frame below (they outlive it, see the caller). */
function foldFrameIntoParent({ current, level }: REnvironmentInformation): REnvironmentInformation {
	const parent = current.parent.clone(false);
	for(const [name, definitions] of current.memory) {
		parent.writableMemory.set(name, definitions);
	}
	return { current: parent, level: level - 1 };
}

/**
 * Whether an error raised by the call `from` still leaves the expression it is written in: redoes what a `stop`
 * written at that spot would have done, since we only learn a callee always throws after linking it here.
 */
function errorEscapes(from: NodeId, expression: NodeId, idMap: AstIdMap, graph: DataflowGraph): boolean {
	for(let node = idMap.get(from); node !== undefined && node.info.id !== expression;) {
		const parent = RNode.directParent(node, idMap);
		if(parent === undefined) {
			return true;
		}
		if(!errorPassesThrough(parent, node.info.id, graph)) {
			return false;
		}
		node = parent;
	}
	return true;
}

/** Whether an error raised within the child `child` of `parent` is sure to be raised by `parent` as well. */
function errorPassesThrough(parent: RNode<ParentInformation>, child: NodeId, graph: DataflowGraph): boolean {
	if(RArgument.is(parent) || RExpressionList.is(parent)) {
		return true;
	} else if(RFunctionCall.is(parent)) {
		/* a handler catches the error instead of passing it on */
		return !DfgVertex.hasOrigin(graph.getVertex(parent.info.id), BuiltInProcName.Try);
	} else if(RIfThenElse.is(parent) || RWhileLoop.is(parent)) {
		/* only the condition is guaranteed to be evaluated */
		return parent.condition.info.id === child;
	} else if(RForLoop.is(parent)) {
		return parent.vector.info.id === child;
	}
	return false;
}

/** Whether `node` is written within the call `call` (or the call is not part of the AST). */
function writtenWithinCall(call: NodeId, node: NodeId, idMap: AstIdMap): boolean {
	return !idMap.has(call) || RNode.findEnclosing(node, idMap, n => n.info.id === call) !== undefined;
}

/** Printing a visible top-level value dispatches to the `print` methods in scope, so the expression runs them like a call would. */
function printMethodsOf(id: NodeId, environment: REnvironmentInformation, graph: DataflowGraph): ReturnType<typeof linkFunctionCalls> {
	const methods = Resolve.byNameAndType('print', environment, ReferenceType.S3MethodPrefix)?.filter(d => !NodeId.isBuiltIn(d.nodeId)) ?? [];
	if(methods.length === 0) {
		return [];
	}
	for(const method of methods) {
		graph.addEdge(id, method.nodeId, EdgeType.Reads);
	}
	const called = [...getAllLinkedFunctionDefinitions(new Set(methods.map(m => m.nodeId)), graph)[0]];
	for(const ref of called.flatMap(c => c.subflow.in)) {
		for(const def of ref.name === undefined ? [] : Resolve.byNameAndType(ref.name, environment, ref.type) ?? []) {
			if(!NodeId.isBuiltIn(def.nodeId)) {
				graph.addEdge(ref.nodeId, def.nodeId, EdgeType.Reads);
			}
		}
	}
	return [{ functionCall: id, called, propagateExitPoints: [] }];
}

function updateSideEffectsForCalledFunctions(calledEnvs: ReturnType<typeof linkFunctionCalls>, inputEnvironment: REnvironmentInformation, nextGraph: DataflowGraph, localDefs: readonly IdentifierReference[], idMap: AstIdMap) {
	for(const { functionCall, called } of calledEnvs) {
		const callDependencies = nextGraph.getVertex(functionCall)?.cds;
		for(const { fn: calledFn, direct, cds } of transitivelyCalledDefinitions(called, nextGraph, inputEnvironment)) {
			/* walk the smaller of the two, a script may hold many unknown side effects and a function many vertices */
			const inside = calledFn.subflow.graph;
			const effects = nextGraph.unknownSideEffects;
			for(const effect of inside.size < effects.size ? inside : effects) {
				if(typeof effect !== 'object' && inside.has(effect) && effects.has(effect)) {
					nextGraph.addEdge(effect, functionCall, EdgeType.SideEffectOnCall);
				}
			}
			// only merge the environments they have in common
			let environment = direct ? calledFn.subflow.environment : withoutPackageLayers(calledFn.subflow.environment);
			if(environment.level > inputEnvironment.level) {
				/* the callee's own frame dies with the call */
				environment = popLocalEnvironment(environment);
				/* frames above the caller are ones its closure captured, so fold them back instead of losing their writes */
				while(environment.level > inputEnvironment.level) {
					environment = foldFrameIntoParent(environment);
				}
			}
			let hasUpdate = false;
			for(let current = environment.current; !current.builtInEnv; current = current.parent) {
				/* a package attached inside the body (library()) propagates to the caller, like R attaching globally */
				hasUpdate ||= current.t !== undefined;
				for(const definitions of current.memory.values()) {
					for(const def of definitions) {
						if(!NodeId.isBuiltIn(def.definedAt)) {
							hasUpdate = true;
							nextGraph.addEdge(def.nodeId, functionCall, EdgeType.SideEffectOnCall);
						}
					}
				}
			}
			if(!hasUpdate) {
				continue;
			}
			const shadowing = localDefs.filter(d => isNotUndefined(d.name) && !writtenWithinCall(functionCall, d.nodeId, idMap));
			if(shadowing.length > 0) {
				environment = {
					current: environment.current.removeAll(shadowing as { name: string }[]),
					level:   environment.level
				};
			}
			const dependencies = cds === undefined ? callDependencies : [...callDependencies ?? [], ...cds];
			inputEnvironment = overwriteEnvironment(inputEnvironment, environment, dependencies);
		}
	}
	return inputEnvironment;
}

/**
 * Processes a list of expressions joining their dataflow graphs accordingly.
 */
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
	const remainingRead = new DefaultMap<string | undefined, IdentifierReference[]>(() => []);
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
	const autoPrint = data.referenceChain.length <= 1 && data.environment.level === 0 && data.completeAst.ast.files.some(f => f.root.info.id === rootId);
	let initialState: Set<IdentifierReference> | undefined;
	const hooks: DataflowInformation['hooks'] = [];

	for(const arg of args) {
		const expression = unpackNonameArg(arg);
		if(expression === undefined) {
			processedExpressions.push(undefined);
			continue;
		}
		(data as Writable<DataflowProcessorInformation<OtherInfo & ParentInformation>>).environment = environment;
		let processed = processDataflowFor(expression, data);
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
		for(const read of activeReads) {
			nextGraph.updateToFunctionCall({ tag: VertexType.FunctionCall, id: read.nodeId, name: read.name as Identifier, args: [], environment, onlyBuiltin: false, cds: read.cds, origin: [BuiltInProcName.Function] });
		}

		const calledEnvs = linkFunctionCalls(nextGraph, idMap, processed.graph, activeReads.map(r => r.nodeId));
		if(printed) {
			calledEnvs.push(...printMethodsOf(processed.entryPoint, environment, nextGraph));
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
		environment = exitPoints.length > 0 ? overwriteEnvironment(environment, processed.environment) : processed.environment;
		// if the called function has global redefinitions, we have to keep them within our environment
		environment = updateSideEffectsForCalledFunctions(calledEnvs, environment, nextGraph, processed.out, idMap);

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
	/*
	 * `{ break }` is entered and left by the jump within it, so its `{` is where that jump leaves the group:
	 * whatever catches the jump continues from there instead of from within the group, which keeps the `{`
	 * on the control flow rather than beside it as a vertex nothing leads away from.
	 */
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
		/* at the top of the script, only a read of the options or graphics state nothing set reads the state R starts with,
		   which a write escaping a higher-order call may still replace, see the extractor */
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
