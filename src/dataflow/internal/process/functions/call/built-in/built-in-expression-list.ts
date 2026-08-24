import type { ControlDependency, DataflowInformation, ExitPoint, KillReference } from '../../../../../info';
import { addNonDefaultExitPoints, ExitPointType, happensInEveryBranch } from '../../../../../info';
import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import { getAllLinkedFunctionDefinitions, linkFunctionCalls } from '../../../../linker';
import { guard, isNotUndefined } from '../../../../../../util/assert';
import { unpackNonameArg } from '../argument/unpack-argument';
import { patchFunctionCall } from '../common';
import type { Environment, REnvironmentInformation } from '../../../../../environments/environment';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { DataflowGraph } from '../../../../../graph/graph';
import { Identifier, type IdentifierDefinition, type IdentifierReference, ReferenceType } from '../../../../../environments/identifier';
import { EdgeType } from '../../../../../graph/edge';
import { ControlFlow } from '../../../../control-flow';
import { type DataflowGraphVertexInfo, VertexType } from '../../../../../graph/vertex';
import { popLocalEnvironment } from '../../../../../environments/scoping';
import { overwriteEnvironment } from '../../../../../environments/overwrite';
import type { AstIdMap, ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { dataflowLogger } from '../../../../../logger';
import { expensiveTrace } from '../../../../../../util/log';
import type { Writable } from 'ts-essentials';
import { makeAllMaybe } from '../../../../../environments/reference-to-maybe';
import { cancelRevivedKills, dropKilledWrites, makeKillsMaybe } from '../../../../../environments/apply-kill';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { valueFromTsValue } from '../../../../../eval/values/general';
import { FunctionDefinitionVertex, FunctionCallVertex } from '../../../../../graph/vertex';
import { Resolve } from '../../../../../environments/resolve-helper';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';

/**
 * Whether the definitions of this list among the `targets` of a read cover every branch, alone or together.
 * Only then the read is resolved here and must not bubble up as an ingoing reference.
 */
function coveredByListDefinitions(targets: readonly IdentifierDefinition[], listEnvironments: Set<NodeId>): boolean {
	let cds: ControlDependency[] | undefined;
	for(const target of targets) {
		if(!listEnvironments.has(target.nodeId)) {
			continue;
		} else if(target.cds === undefined) {
			return true;
		}
		(cds ??= []).push(...target.cds);
	}
	return cds !== undefined && happensInEveryBranch(cds);
}

function linkReadNameToWriteIfPossible(read: IdentifierReference, environments: REnvironmentInformation, listEnvironments: Set<NodeId>, remainingRead: Map<string | undefined, IdentifierReference[]>, nextGraph: DataflowGraph) {
	const readName = read.name && Identifier.isDotDotDotAccess(read.name) ? Identifier.dotdotdot() : read.name;
	const probableTarget = readName ? Resolve.byNameAndType(readName, environments, read.type) : undefined;

	if(probableTarget === undefined || !coveredByListDefinitions(probableTarget, listEnvironments)) {
		const readId = readName ? Identifier.getName(readName) : undefined;
		const has = remainingRead.get(readId);
		if(has) {
			if(!has.some(h => h.nodeId === read.nodeId && h.name === read.name && h.cds === read.cds)) {
				has.push(read);
			}
		} else {
			remainingRead.set(readId, [read]);
		}
	}

	// no target: keep it as an ingoing read (read-ids are unique within the same fold); a later fold may still resolve and drop it
	if(probableTarget === undefined) {
		return;
	}

	const rid = read.nodeId;
	const isFunc = read.type === ReferenceType.Function || read.type === ReferenceType.BuiltInFunction;
	for(const target of probableTarget) {
		const tid = target.nodeId;
		if(NodeId.isBuiltIn(target.definedAt) && isFunc) {
			nextGraph.addEdge(rid, tid, EdgeType.Reads | EdgeType.Calls);
		} else {
			nextGraph.addEdge(rid, tid, EdgeType.Reads);
		}
		if(target.type === ReferenceType.BuiltInConstant) {
			nextGraph.addVertex({
				tag:   VertexType.Value,
				id:    tid,
				cds:   undefined,
				value: valueFromTsValue((target).value)
			}, environments, false);
		}
	}
}

/**
 * Expands `direct`'s directly-called functions with everything they transitively call (via `resolveEnv`): a sibling/outer
 * callee's escaped globals otherwise never fold into the caller, so a `<<-` escaping several call levels would go unlinked.
 */
function* transitivelyCalledDefinitions(initial: readonly DataflowGraphVertexInfo[], graph: DataflowGraph, resolveEnv: REnvironmentInformation): Generator<{ fn: DataflowGraphVertexInfo, direct: boolean }> {
	const seen = new Set<NodeId>();
	const stack = initial.map(fn => ({ fn, direct: true }));
	while(stack.length > 0) {
		const { fn, direct } = stack.pop() as { fn: DataflowGraphVertexInfo, direct: boolean };
		if(!FunctionDefinitionVertex.is(fn) || seen.has(fn.id)) {
			continue;
		}
		seen.add(fn.id);
		yield { fn, direct };
		for(const nodeId of fn.subflow.graph) {
			const call = graph.getVertex(nodeId);
			if(!FunctionCallVertex.is(call) || call.onlyBuiltin || call.name === undefined) {
				continue;
			}
			const resolved = Resolve.byNameAndType(call.name, resolveEnv, ReferenceType.Function);
			if(resolved === undefined) {
				continue;
			}
			const [targets] = getAllLinkedFunctionDefinitions(new Set(resolved.map(r => r.nodeId)), graph);
			for(const target of targets) {
				if(!seen.has(target.id)) {
					stack.push({ fn: target, direct: false });
				}
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
	let node = idMap.get(from);
	while(node !== undefined && node.info.id !== expression) {
		const parent = node.info.parent !== undefined ? idMap.get(node.info.parent) : undefined;
		if(parent === undefined) {
			return true;
		}
		switch(parent.type) {
			case RType.Argument:
			case RType.ExpressionList:
				break;
			case RType.FunctionCall:
				/* a handler catches the error instead of passing it on */
				if(FunctionCallVertex.hasOrigin(graph.getVertex(parent.info.id), BuiltInProcName.Try)) {
					return false;
				}
				break;
			case RType.IfThenElse:
			case RType.WhileLoop:
				/* only the condition is guaranteed to be evaluated */
				if(parent.condition.info.id !== node.info.id) {
					return false;
				}
				break;
			case RType.ForLoop:
				if(parent.vector.info.id !== node.info.id) {
					return false;
				}
				break;
			default:
				return false;
		}
		node = parent;
	}
	return true;
}

function updateSideEffectsForCalledFunctions(calledEnvs: {
	functionCall: NodeId;
	called:       readonly DataflowGraphVertexInfo[]
}[], inputEnvironment: REnvironmentInformation, nextGraph: DataflowGraph, localDefs: readonly IdentifierReference[]) {
	for(const { functionCall, called } of calledEnvs) {
		let callDependencies: ControlDependency[] | null | undefined = null;
		for(const { fn: calledFn, direct } of transitivelyCalledDefinitions(called, nextGraph, inputEnvironment)) {
			guard(FunctionDefinitionVertex.is(calledFn), 'called function must be a function definition');
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
			// update alle definitions to be defined at this function call
			let current: Environment | undefined = environment.current;

			let hasUpdate = false;
			while(!current?.builtInEnv) {
				// a package attached inside the body (library()) must propagate to the caller, like R attaching globally
				if(current.t !== undefined) {
					hasUpdate = true;
				}
				for(const definitions of current.memory.values()) {
					for(const def of definitions) {
						if(!NodeId.isBuiltIn(def.definedAt)) {
							hasUpdate = true;
							nextGraph.addEdge(def.nodeId, functionCall, EdgeType.SideEffectOnCall);
						}
					}
				}
				current = current.parent;
			}
			if(hasUpdate) {
				// link all definitions to the corresponding function call, but ignore expression-local writes
				if(localDefs.length > 0) {
					environment = {
						current: environment.current.removeAll(localDefs.filter(d => isNotUndefined(d.name)) as { name: string }[]),
						level:   environment.level
					};
				}
				if(callDependencies === null) {
					callDependencies = nextGraph.getVertex(functionCall)?.cds;
				}
				inputEnvironment = overwriteEnvironment(inputEnvironment, environment, callDependencies);
			}
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
	expensiveTrace(dataflowLogger, () => `[expr list] with ${args.length} expressions`);

	let { environment } = data;
	// used to detect if a "write" happens within the same expression list
	const listEnvironments: Set<NodeId> = new Set<NodeId>();

	const remainingRead = new Map<string, IdentifierReference[]>();

	const nextGraph = new DataflowGraph(data.completeAst.idMap);
	const out: IdentifierReference[] = [];
	/* lazily created - `rm` is rare, so rm-free lists never allocate this */
	let killed: KillReference[] | undefined;
	const exitPoints: ExitPoint[] = [];
	const activeCdsAtStart: ControlDependency[] | undefined = data.cds;
	const invertExitCds: ControlDependency[] = [];

	const processedExpressions: (DataflowInformation | undefined)[] = [];
	let defaultReturnExpr: undefined | DataflowInformation = undefined;
	let hooks: DataflowInformation['hooks'] | undefined;

	for(const arg of args) {
		const expression = unpackNonameArg(arg);
		if(expression === undefined) {
			processedExpressions.push(undefined);
			continue;
		}
		// use the current environments for processing
		(data as Writable<DataflowProcessorInformation<OtherInfo & ParentInformation>>).environment = environment;
		const processed = processDataflowFor(expression, data);
		processedExpressions.push(processed);
		nextGraph.mergeWith(processed.graph);
		defaultReturnExpr = processed;
		// a prior next/break means we do not know if the rest executes, so later environments append rather than overwrite
		if(exitPoints.length > 0) {
			processed.out = makeAllMaybe(processed.out, nextGraph, processed.environment, true, invertExitCds);
			processed.in = makeAllMaybe(processed.in, nextGraph, processed.environment, false, invertExitCds);
			processed.unknownReferences = makeAllMaybe(processed.unknownReferences, nextGraph, processed.environment, false);
		}

		if(processed.hooks.length > 0) {
			(hooks ??= []).push(...processed.hooks);
		}

		// all inputs that have not been written until now are read!
		for(const read of processed.in) {
			linkReadNameToWriteIfPossible(read, environment, listEnvironments, remainingRead, nextGraph);
		}
		for(const read of processed.unknownReferences) {
			linkReadNameToWriteIfPossible(read, environment, listEnvironments, remainingRead, nextGraph);
		}

		const calledEnvs = linkFunctionCalls(nextGraph, data.completeAst.idMap, processed.graph);
		for(const c of calledEnvs) {
			if(c.propagateExitPoints.length > 0 && errorEscapes(c.functionCall, expression.info.id, data.completeAst.idMap, nextGraph)) {
				for(const exit of c.propagateExitPoints) {
					(processed.exitPoints as Writable<ExitPoint[]>).push(exit);
				}
			}
		}

		addNonDefaultExitPoints(exitPoints, invertExitCds, activeCdsAtStart, processed.exitPoints);
		environment = exitPoints.length > 0 ? overwriteEnvironment(environment, processed.environment) : processed.environment;
		// if the called function has global redefinitions, we have to keep them within our environment
		environment = updateSideEffectsForCalledFunctions(calledEnvs, environment, nextGraph, processed.out);

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
		if(ControlFlow.alwaysExits(processed)) {
			/* if there is an always-exit expression, there is no default return active anymore */
			defaultReturnExpr = undefined;
			break;
		}
	}

	if(defaultReturnExpr) {
		exitPoints.push(data.cds ? {
			type:   ExitPointType.Default,
			nodeId: defaultReturnExpr.entryPoint,
			cds:    data.cds
		} : {
			type:   ExitPointType.Default,
			nodeId: defaultReturnExpr.entryPoint
		});
	}

	const ingoing: IdentifierReference[] = [...remainingRead.values()].flat();

	const rootNode = data.completeAst.idMap.get(rootId);
	const withGroup = rootNode?.grouping;

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

		// process all exit points as potential returns:
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
				exitPoints[i] = { ...exit, nodeId: rootId };
			}
		}
	}

	return {
		/* no active nodes remain, they are consumed within the remaining read collection */
		unknownReferences: [],
		in:                ingoing,
		/* a definition that a still-effective removal undid is no longer visible to the outside */
		out:               dropKilledWrites(out, killed),
		environment:       environment,
		graph:             nextGraph,
		/* if we have no group, we take the last evaluated expr */
		entryPoint:        meId,
		cfgEntry:          cfgEntry === meId ? undefined : cfgEntry,
		cfgExit:           reachesEnd ? rootId : undefined,
		exitPoints:        exitPoints,
		hooks:             hooks ?? [],
		kill:              killed,
	};
}
