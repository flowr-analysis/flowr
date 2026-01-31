/**
 * Processes a list of expressions joining their dataflow graphs accordingly.
 * @module
 */
import type { ControlDependency, DataflowInformation, ExitPoint } from '../../../../../info';
import { addNonDefaultExitPoints, alwaysExits, ExitPointType, happensInEveryBranch } from '../../../../../info';
import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import { linkFunctionCalls } from '../../../../linker';
import { guard, isNotUndefined } from '../../../../../../util/assert';
import { unpackNonameArg } from '../argument/unpack-argument';
import { patchFunctionCall } from '../common';
import type { Environment, REnvironmentInformation } from '../../../../../environments/environment';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { DataflowGraph } from '../../../../../graph/graph';
import type { Identifier , type IdentifierReference, ReferenceType } from '../../../../../environments/identifier';
import { resolveByName } from '../../../../../environments/resolve-by-name';
import { EdgeType } from '../../../../../graph/edge';
import { type DataflowGraphVertexInfo, VertexType } from '../../../../../graph/vertex';
import { popLocalEnvironment } from '../../../../../environments/scoping';
import { builtInId, BuiltInProcName, isBuiltIn } from '../../../../../environments/built-in';
import { overwriteEnvironment } from '../../../../../environments/overwrite';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { dataflowLogger } from '../../../../../logger';
import { expensiveTrace } from '../../../../../../util/log';
import type { Writable } from 'ts-essentials';
import { makeAllMaybe } from '../../../../../environments/reference-to-maybe';


const dotDotDotAccess = /^\.\.\d+$/;

function linkReadNameToWriteIfPossible(read: IdentifierReference, environments: REnvironmentInformation, listEnvironments: Set<NodeId>, remainingRead: Map<string | undefined, IdentifierReference[]>, nextGraph: DataflowGraph) {
	const readName = read.name && dotDotDotAccess.test(read.name[0]) ? ['...'] as Identifier : read.name;
	const readId = readName?.[0];

	const probableTarget = readName ? resolveByName(readName, environments, read.type) : undefined;

	// record if at least one has not been defined
	if(probableTarget === undefined || probableTarget.some(t => !listEnvironments.has(t.nodeId) || !happensInEveryBranch(t.cds))) {
		const has = remainingRead.get(readId);
		if(has) {
			if(!has?.some(h => h.nodeId === read.nodeId && h.name === read.name && h.cds === read.cds)) {
				has.push(read);
			}
		} else {
			remainingRead.set(readId, [read]);
		}
	}

	// keep it, for we have no target, as read-ids are unique within the same fold, this should work for same links
	// we keep them if they are defined outside the current parent and maybe throw them away later
	if(probableTarget === undefined) {
		return;
	}

	const rid = read.nodeId;
	for(const target of probableTarget) {
		const tid = target.nodeId;
		if((read.type === ReferenceType.Function || read.type === ReferenceType.BuiltInFunction) && isBuiltIn(target.definedAt)) {
			nextGraph.addEdge(rid, tid, EdgeType.Reads | EdgeType.Calls);
		} else {
			nextGraph.addEdge(rid, tid, EdgeType.Reads);
		}
	}
}

function updateSideEffectsForCalledFunctions(calledEnvs: {
	functionCall: NodeId;
	called:       readonly DataflowGraphVertexInfo[]
}[], inputEnvironment: REnvironmentInformation, nextGraph: DataflowGraph, localDefs: readonly IdentifierReference[]) {
	for(const { functionCall, called } of calledEnvs) {
		let callDependencies: ControlDependency[] | null | undefined = null;
		for(const calledFn of called) {
			guard(calledFn.tag === VertexType.FunctionDefinition, 'called function must be a function definition');
			// only merge the environments they have in common
			let environment = calledFn.subflow.environment;
			while(environment.level > inputEnvironment.level) {
				environment = popLocalEnvironment(environment);
			}
			// update alle definitions to be defined at this function call
			let current: Environment | undefined = environment.current;

			let hasUpdate = false;
			while(!current?.builtInEnv) {
				for(const definitions of current.memory.values()) {
					for(const def of definitions) {
						if(!isBuiltIn(def.definedAt)) {
							hasUpdate = true;
							nextGraph.addEdge(def.nodeId, functionCall, EdgeType.SideEffectOnCall);
						}
					}
				}
				current = current.parent;
			}
			if(hasUpdate) {
				// we update all definitions to be linked with the corresponding function call
				// we, however, have to ignore expression-local writes!
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
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const expressions = args.map(unpackNonameArg);

	expensiveTrace(dataflowLogger, () => `[expr list] with ${expressions.length} expressions`);

	let { environment } = data;
	// used to detect if a "write" happens within the same expression list
	const listEnvironments: Set<NodeId> = new Set<NodeId>();

	const remainingRead = new Map<string, IdentifierReference[]>();

	const nextGraph = new DataflowGraph(data.completeAst.idMap);
	let out: IdentifierReference[] = [];
	const exitPoints: ExitPoint[] = [];
	const activeCdsAtStart: ControlDependency[] | undefined = data.cds;
	const invertExitCds: ControlDependency[] = [];

	const processedExpressions: (DataflowInformation | undefined)[] = [];
	let defaultReturnExpr: undefined | DataflowInformation = undefined;

	for(const expression of expressions) {
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
		// if the expression contained next or break anywhere before the next loop, the "overwrite" should be an "append", because we do not know if the rest is executed
		// update the environments for the next iteration with the previous writes
		if(exitPoints.length > 0) {
			processed.out = makeAllMaybe(processed.out, nextGraph, processed.environment, true, invertExitCds);
			processed.in = makeAllMaybe(processed.in, nextGraph, processed.environment, false, invertExitCds);
			processed.unknownReferences = makeAllMaybe(processed.unknownReferences, nextGraph, processed.environment, false);
		}

		out = out.concat(processed.out);

		// all inputs that have not been written until now are read!
		for(const ls of [processed.in, processed.unknownReferences]) {
			for(const read of ls) {
				linkReadNameToWriteIfPossible(read, environment, listEnvironments, remainingRead, nextGraph);
			}
		}

		const calledEnvs = linkFunctionCalls(nextGraph, data.completeAst.idMap, processed.graph);
		for(const c of calledEnvs) {
			if(c.propagateExitPoints.length > 0) {
				for(const exit of c.propagateExitPoints) {
					(processed.exitPoints as Writable<ExitPoint[]>).push(exit);
				}
			}
		}

		addNonDefaultExitPoints(exitPoints, invertExitCds, activeCdsAtStart, processed.exitPoints);
		environment = exitPoints.length > 0 ? overwriteEnvironment(environment, processed.environment) : processed.environment;
		// if the called function has global redefinitions, we have to keep them within our environment
		environment = updateSideEffectsForCalledFunctions(calledEnvs, environment, nextGraph, processed.out);

		for(const { nodeId } of processed.out) {
			listEnvironments.add(nodeId);
		}

		/** if at least built-one of the exit points encountered happens unconditionally, we exit here (dead code)! */
		if(alwaysExits(processed)) {
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

	const ingoing = remainingRead.values().toArray().flat();

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

		nextGraph.addEdge(rootId, builtInId('{'), EdgeType.Reads | EdgeType.Calls);

		// process all exit points as potential returns:
		for(const exit of exitPoints) {
			if(exit.type === ExitPointType.Return || exit.type === ExitPointType.Default) {
				nextGraph.addEdge(rootId, exit.nodeId, EdgeType.Returns);
			}
		}
	}

	const meId = withGroup ? rootId : (processedExpressions.find(isNotUndefined)?.entryPoint ?? rootId);
	return {
		/* no active nodes remain, they are consumed within the remaining read collection */
		unknownReferences: [],
		in:                ingoing,
		out,
		environment:       environment,
		graph:             nextGraph,
		/* if we have no group, we take the last evaluated expr */
		entryPoint:        meId,
		exitPoints:        exitPoints,
		hooks:             processedExpressions.flatMap(p => p?.hooks ?? []),
	};
}
