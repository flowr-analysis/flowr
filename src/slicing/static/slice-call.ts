import type { NodeToSlice } from './slicer-types';
import type { VisitingQueue } from './visiting-queue';
import { guard } from '../../util/assert';
import type { Fingerprint } from './fingerprint';
import { envFingerprint } from './fingerprint';
import { getAllLinkedFunctionDefinitions } from '../../dataflow/internal/linker';
import type {
	DataflowGraphVertexFunctionCall,
	DataflowGraphVertexFunctionDefinition,
	DataflowGraphVertexInfo
} from '../../dataflow/graph/vertex';
import type { REnvironmentInformation } from '../../dataflow/environments/environment';
import type { DataflowGraph, FunctionArgument, OutgoingEdges } from '../../dataflow/graph/graph';
import { getReferenceOfArgument } from '../../dataflow/graph/graph';
import { BuiltIn } from '../../dataflow/environments/built-in';
import { resolveByName } from '../../dataflow/environments/resolve-by-name';
import { edgeIncludesType, EdgeType } from '../../dataflow/graph/edge';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { ReferenceType } from '../../dataflow/environments/identifier';
import {
	retrieveActiveEnvironment
} from '../../dataflow/internal/process/functions/call/built-in/built-in-function-definition';
import { updatePotentialAddition } from './static-slicer';

/**
 * Returns the function call targets (definitions) by the given caller
 */
export function getAllFunctionCallTargets(dataflowGraph: DataflowGraph, callerInfo: DataflowGraphVertexFunctionCall, baseEnvironment: REnvironmentInformation): [Set<DataflowGraphVertexInfo>, REnvironmentInformation] {
	// bind with call-local environments during slicing
	const outgoingEdges = dataflowGraph.get(callerInfo.id, true);
	guard(outgoingEdges !== undefined, () => `outgoing edges of id: ${callerInfo.id} must be in graph but can not be found, keep in slice to be sure`);

	// lift baseEnv on the same level

	const activeEnvironment = retrieveActiveEnvironment(callerInfo.environment, baseEnvironment);

	const name = callerInfo.name;
	guard(name !== undefined, () => `name of id: ${callerInfo.id} can not be found in id map`);
	const functionCallDefs = resolveByName(name, activeEnvironment, ReferenceType.Unknown)?.filter(d => d.definedAt !== BuiltIn)?.map(d => d.nodeId) ?? [];

	for(const [target, outgoingEdge] of outgoingEdges[1].entries()) {
		if(edgeIncludesType(outgoingEdge.types, EdgeType.Calls)) {
			functionCallDefs.push(target);
		}
	}

	const functionCallTargets = getAllLinkedFunctionDefinitions(new Set(functionCallDefs), dataflowGraph);
	return [functionCallTargets, activeEnvironment];
}

function includeArgumentFunctionCallClosure(arg: FunctionArgument, baseEnvironment: REnvironmentInformation, activeEnvironment: REnvironmentInformation, queue: VisitingQueue, dataflowGraph: DataflowGraph): void {
	const valueRoot = getReferenceOfArgument(arg);
	if(!valueRoot) {
		return;
	}
	const callTargets = getAllLinkedFunctionDefinitions(new Set<NodeId>([valueRoot]), dataflowGraph);
	linkCallTargets(
		false,
		callTargets,
		activeEnvironment,
		envFingerprint(activeEnvironment),
		queue
	);
}

function linkCallTargets(
	onlyForSideEffects: boolean,
	functionCallTargets: ReadonlySet<DataflowGraphVertexInfo>,
	activeEnvironment: REnvironmentInformation,
	activeEnvironmentFingerprint: Fingerprint,
	queue: VisitingQueue
): void {
	for(const functionCallTarget of functionCallTargets) {
		// all those linked within the scopes of other functions are already linked when exiting a function definition
		/* for(const openIn of (functionCallTarget as DataflowGraphVertexFunctionDefinition).subflow.in) {
			// only if the outgoing path does not already have a defined by linkage
			const defs = openIn.name ? resolveByName(openIn.name, activeEnvironment, openIn.type) : undefined;
			if(defs === undefined) {
				continue;
			}
			for(const def of defs.filter(d => d.nodeId !== BuiltIn)) {
				queue.add(def.nodeId, baseEnvironment, baseEnvPrint, onlyForSideEffects);
			}
		}*/

		for(const exitPoint of (functionCallTarget as DataflowGraphVertexFunctionDefinition).exitPoints) {
			queue.add(exitPoint, activeEnvironment, activeEnvironmentFingerprint, onlyForSideEffects);
		}
	}
}

/** returns the new threshold hit count */
export function sliceForCall(current: NodeToSlice, callerInfo: DataflowGraphVertexFunctionCall, dataflowGraph: DataflowGraph, queue: VisitingQueue): void {
	const baseEnvironment = current.baseEnvironment;
	const [functionCallTargets, activeEnvironment] = getAllFunctionCallTargets(dataflowGraph, callerInfo, current.baseEnvironment);
	const activeEnvironmentFingerprint = envFingerprint(activeEnvironment);

	if(functionCallTargets.size === 0) {
		/*
		 * if we do not have any call to resolve this function, we have to assume that every function passed is actually called!
		 * hence, we add a new flag and add all argument values to the queue causing directly
		 */
		for(const arg of callerInfo.args) {
			includeArgumentFunctionCallClosure(arg, baseEnvironment, activeEnvironment, queue, dataflowGraph);
		}
		return;
	}
	linkCallTargets(current.onlyForSideEffects, functionCallTargets, activeEnvironment, activeEnvironmentFingerprint, queue);
}

/** Returns true if we found at least one return edge */
export function handleReturns(from: NodeId, queue: VisitingQueue, currentEdges: OutgoingEdges, baseEnvFingerprint: Fingerprint, baseEnvironment: REnvironmentInformation): boolean {
	const e = [...currentEdges.entries()];
	const found = e.filter(([_, edge]) => edgeIncludesType(edge.types, EdgeType.Returns));
	if(found.length === 0) {
		return false;
	}
	for(const [target,] of found) {
		queue.add(target, baseEnvironment, baseEnvFingerprint, false);
	}
	for(const [target, edge] of e) {
		if(edgeIncludesType(edge.types, EdgeType.Reads)) {
			queue.add(target, baseEnvironment, baseEnvFingerprint, false);
		} else if(edgeIncludesType(edge.types, EdgeType.DefinesOnCall | EdgeType.DefinedByOnCall | EdgeType.Argument)) {
			updatePotentialAddition(queue, from, target, baseEnvironment);
		}
	}
	return true;
}
