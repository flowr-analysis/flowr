import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import { type DataflowInformation, ExitPointType, filterOutLoopExitPoints } from '../../../../../info';
import {
	findNonLocalReads,
	linkCircularRedefinitionsWithinALoop,
	produceNameSharedIdMap,
	reapplyLoopExitPoints
} from '../../../../linker';
import { processKnownFunctionCall } from '../known-call-handling';
import { guard } from '../../../../../../util/assert';
import { patchFunctionCall } from '../common';
import { unpackNonameArg } from '../argument/unpack-argument';
import { dataflowLogger } from '../../../../../logger';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { overwriteEnvironment } from '../../../../../environments/overwrite';
import { define } from '../../../../../environments/define';
import { appendEnvironment } from '../../../../../environments/append';
import { EdgeType } from '../../../../../graph/edge';
import { ControlFlow } from '../../../../control-flow';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { IdentifierDefinition } from '../../../../../environments/identifier';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import { applyCdsToAllInGraphButConstants, applyCdToReferences } from '../../../../../environments/reference-to-maybe';
import { applyKills, makeKillsMaybe } from '../../../../../environments/apply-kill';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { linkAmbientStateWithinLoop } from './built-in-ambient-state';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import type { Value } from '../../../../../eval/values/r-value';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { RBinaryOp } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { DfgVertex } from '../../../../../graph/vertex';


/** a value R iterates over at least once, `NULL` and empty vectors are the ones it does not */
function hasElement(value: Value): boolean {
	switch(value.type) {
		case 'interval':
		case 'number':
		case 'string':
		case 'logical':
			return true;
		case 'vector':
			return Array.isArray(value.elements) && value.elements.length > 0;
		default:
			return false;
	}
}

/** whether the node certainly holds a value and every value it may hold satisfies `holds` */
function alwaysHolds<OtherInfo>(node: RNode<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, holds: (value: Value) => boolean): boolean {
	const values = NodeValue.setOf(node.info.id, data)?.elements;
	return values !== undefined && values.length > 0 && values.every(holds);
}

/** `a:b` always has an element or fails, unless both sides are factors, which a plain value is not */
function isNonEmptyRange<OtherInfo>(vector: RNode<OtherInfo & ParentInformation>, entry: DataflowInformation, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): boolean {
	if(!RBinaryOp.is(vector) || vector.operator !== ':') {
		return false;
	}
	const call = entry.graph.getVertex(vector.info.id);
	if(!DfgVertex.isFunctionCall(call) || !call.origin.includes(BuiltInProcName.Default)) {
		return false;
	}
	return [vector.lhs, vector.rhs].some(side => alwaysHolds(side, data, v => v.type !== 'vector' && hasElement(v)));
}

/** whether a for-loop over `vector` certainly runs its body at least once */
function iteratesAtLeastOnce<OtherInfo>(vector: RNode<OtherInfo & ParentInformation>, entry: DataflowInformation, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): boolean {
	return isNonEmptyRange(vector, entry, data) || alwaysHolds(vector, data, hasElement);
}

/** a `break` or `next` may cut the first iteration short */
function mayCutIterationShort(body: DataflowInformation): boolean {
	return body.exitPoints.some(e => e.type === ExitPointType.Break || e.type === ExitPointType.Next);
}

/**
 * Processes a for-loop call: `for(<variable> in <vector>) <body>`
 * desugared as:
 * ```r
 * `for`(<variable>, <vector>, <body>)
 * ```
 */
export function processForLoop<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(args.length !== 3) {
		dataflowLogger.warn(`For-Loop ${Identifier.toString(name.content)} does not have three arguments, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const [variableArg, vectorArg, bodyArg] = args.map(e => unpackNonameArg(e));

	// we store the original environment here, as we merge it back lter in case the for-loop never executes
	const origEnv = data.environment;

	guard(variableArg !== undefined && vectorArg !== undefined && bodyArg !== undefined, () => `For-Loop ${JSON.stringify(args)} has missing arguments! Bad!`);
	const vector = processDataflowFor(vectorArg, data);
	if(ControlFlow.alwaysExits(vector)) {
		dataflowLogger.warn(`For-Loop ${rootId} forces exit in vector, skipping rest`);
		return vector;
	}

	/* resolved before the loop variable is bound, as it may share the name of what the vector reads */
	const nonEmpty = iteratesAtLeastOnce(vectorArg, vector, data);
	const variable = processDataflowFor(variableArg, data);
	// this should not be able to exit always!

	const originalDependency = data.cds;

	let headEnvironments = overwriteEnvironment(vector.environment, variable.environment);
	/* only the vector's references and entry point are read past this, its graph is not */
	const headGraph = variable.graph.mergeWith(vector.graph, true, true);

	const writtenVariable = variable.unknownReferences.concat(variable.in);
	const writtenIds = new Set<NodeId>();
	for(const write of writtenVariable) {
		writtenIds.add(write.nodeId);
		headEnvironments = define({ ...write, definedAt: name.info.id, type:      ReferenceType.Variable,
			value:     [vectorArg.info.id], iterated:  true } as (IdentifierDefinition & { name: string }), false, headEnvironments);
	}

	(data as { environment: REnvironmentInformation }).environment = headEnvironments;

	const body = processDataflowFor(bodyArg, data);

	const cd = [{ id: name.info.id, when: true }];


	const bodyRefs = body.in.concat(body.unknownReferences);
	applyCdsToAllInGraphButConstants(body.graph, bodyRefs, cd);
	/* likewise the body's, what is taken from it afterwards are its references, exit points and hooks */
	const nextGraph = headGraph.mergeWith(body.graph, true, true);

	// now we have to identify all reads that may be effected by a circular redefinition
	// for this, we search for all reads with a non-local read resolve!
	const nameIdShares = produceNameSharedIdMap(findNonLocalReads(nextGraph, writtenIds));

	for(const write of writtenVariable) {
		nextGraph.addEdge(write.nodeId, vector.entryPoint, EdgeType.DefinedBy);
		nextGraph.setDefinitionOfVertex(write, [vector.entryPoint]);
	}

	const once = nonEmpty && !mayCutIterationShort(body);
	/* a body that certainly runs defines as definitely as the code around the loop */
	if(!once) {
		applyCdToReferences(body.out, cd);
	}
	const outgoing = variable.out.concat(writtenVariable, body.out);

	linkCircularRedefinitionsWithinALoop(nextGraph, nameIdShares, body.out, body.environment);
	linkAmbientStateWithinLoop(nextGraph, bodyRefs, body);

	/* the loop variable is bound by the head whenever the body runs, so reads of it are not ingoing */
	const loopVariables = new Set(writtenVariable.map(w => w.name));
	const bodyReadsOfOthers = [...nameIdShares.entries()].filter(([n]) => !loopVariables.has(n)).flatMap(([, refs]) => refs);

	reapplyLoopExitPoints(body.exitPoints, body.in.concat(body.out, body.unknownReferences), nextGraph);

	patchFunctionCall({
		nextGraph,
		rootId,
		name,
		data:                  { ...data, cds: originalDependency },
		argumentProcessResult: [variable, vector, body],
		origin:                BuiltInProcName.ForLoop
	});
	/* mark the last argument as nse */
	nextGraph.addEdge(rootId, body.entryPoint, EdgeType.NonStandardEvaluation);
	// as the for-loop always evaluates its condition
	nextGraph.addEdge(name.info.id, vector.entryPoint, EdgeType.Reads);

	const bodyEntry = ControlFlow.entryOf(body);
	const variableEntry = ControlFlow.entryOf(variable);
	ControlFlow.continuesWith(nextGraph, vector, variableEntry);
	ControlFlow.branchesTo(nextGraph, variable, bodyEntry, cd[0]);
	ControlFlow.branchesTo(nextGraph, variable, rootId, { id: cd[0].id, when: false });
	ControlFlow.continuesWith(nextGraph, body, variableEntry);
	ControlFlow.jumpsTo(nextGraph, body, ExitPointType.Next, variableEntry);
	ControlFlow.jumpsTo(nextGraph, body, ExitPointType.Break, rootId);

	// unless the body certainly runs, a removal within it only happens maybe; apply it as the merge cannot represent it
	const loopKill = body.kill?.length ? (once ? body.kill : makeKillsMaybe(body.kill, cd)) : undefined;
	const loopEnvironment = once ? body.environment : appendEnvironment(origEnv, appendEnvironment(headEnvironments, body.environment));

	return {
		unknownReferences: [],
		// we only want those not bound by a local variable
		in:                [{ nodeId: rootId, name: name.content, cds: originalDependency, type: ReferenceType.Function }, ...vector.unknownReferences, ...bodyReadsOfOthers],
		out:               outgoing,
		graph:             nextGraph,
		entryPoint:        name.info.id,
		cfgEntry:          ControlFlow.entryOf(vector),
		cfgExit:           rootId,
		exitPoints:        filterOutLoopExitPoints(body.exitPoints),
		environment:       loopKill ? applyKills(loopEnvironment, loopKill) : loopEnvironment,
		hooks:             variable.hooks.concat(vector.hooks, body.hooks),
		kill:              loopKill,
	};
}
