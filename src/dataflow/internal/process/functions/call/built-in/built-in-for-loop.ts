import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
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


const ScalarTypes: ReadonlySet<Value['type']> = new Set(['interval', 'number', 'string', 'logical']);

/** a value R iterates over at least once, `NULL` and empty vectors are the ones it does not */
function hasElement(value: Value): boolean {
	return value.type === 'vector' ? Array.isArray(value.elements) && value.elements.length > 0 : ScalarTypes.has(value.type);
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
	if(!DfgVertex.hasOrigin(entry.graph.getVertex(vector.info.id), BuiltInProcName.Default)) {
		return false;
	}
	return [vector.lhs, vector.rhs].some(side => alwaysHolds(side, data, v => v.type !== 'vector' && hasElement(v)));
}

/** whether a for-loop over `vector` certainly runs its body at least once */
function iteratesAtLeastOnce<OtherInfo>(vector: RNode<OtherInfo & ParentInformation>, entry: DataflowInformation, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): boolean {
	return isNonEmptyRange(vector, entry, data) || alwaysHolds(vector, data, hasElement);
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

	const [variableArg, vectorArg, bodyArg] = args.map(e => RArgument.unnamedValueOf(e));
	/* merged back in case the loop never runs */
	const origEnv = data.environment;
	guard(variableArg !== undefined && vectorArg !== undefined && bodyArg !== undefined, () => `For-Loop ${JSON.stringify(args)} has missing arguments! Bad!`);
	const vector = processDataflowFor(vectorArg, data);
	if(ControlFlow.alwaysExits(vector, data.cds)) {
		dataflowLogger.warn(`For-Loop ${rootId} forces exit in vector, skipping rest`);
		return vector;
	}

	/* resolved before the loop variable is bound, as it may share the name of what the vector reads */
	const nonEmpty = iteratesAtLeastOnce(vectorArg, vector, data);
	const variable = processDataflowFor(variableArg, data);
	let headEnvironments = overwriteEnvironment(vector.environment, variable.environment);
	/* only the vector's references and entry point are read past this, its graph is not */
	const headGraph = variable.graph.mergeWith(vector.graph, true, true);

	const writtenVariable = variable.unknownReferences.concat(variable.in);
	for(const write of writtenVariable) {
		const definition = {
			...write,
			definedAt: name.info.id,
			type:      ReferenceType.Unknown,
			value:     [vectorArg.info.id],
			iterated:  true
		} as IdentifierDefinition & { name: string };
		headEnvironments = define(definition, false, headEnvironments);
	}
	(data as { environment: REnvironmentInformation }).environment = headEnvironments;

	const body = processDataflowFor(bodyArg, data);
	const cd = [{ id: name.info.id, when: true }];
	const bodyRefs = body.in.concat(body.unknownReferences);
	applyCdsToAllInGraphButConstants(body.graph, bodyRefs, cd);
	/* likewise the body's, what is taken from it afterwards are its references, exit points and hooks */
	const nextGraph = headGraph.mergeWith(body.graph, true, true);

	/* the reads with a non-local resolve may be affected by a circular redefinition */
	const nameIdShares = produceNameSharedIdMap(findNonLocalReads(nextGraph, new Set(writtenVariable.map(w => w.nodeId))));

	for(const write of writtenVariable) {
		nextGraph.addEdge(write.nodeId, vector.entryPoint, EdgeType.DefinedBy);
		nextGraph.setDefinitionOfVertex(write, [vector.entryPoint]);
	}

	/* a `break` or `next` may cut the first iteration short */
	const once = nonEmpty && !body.exitPoints.some(e => e.type === ExitPointType.Break || e.type === ExitPointType.Next);
	/* a body that certainly runs defines as definitely as the code around the loop */
	if(!once) {
		applyCdToReferences(body.out, cd);
	}
	const outgoing = variable.out.concat(writtenVariable, body.out);

	linkCircularRedefinitionsWithinALoop(nextGraph, nameIdShares, body.out, body.environment);
	const ambientReads = linkAmbientStateWithinLoop(nextGraph, bodyRefs, body);

	/* the loop variable is bound by the head whenever the body runs, so reads of it are not ingoing */
	const loopVariables = new Set(writtenVariable.map(w => w.name));
	const bodyReadsOfOthers = [...nameIdShares.entries()].filter(([n]) => !loopVariables.has(n)).flatMap(([, refs]) => refs);

	reapplyLoopExitPoints(body.exitPoints, body.in.concat(body.out, body.unknownReferences), nextGraph);

	patchFunctionCall({
		nextGraph,
		rootId,
		name,
		data,
		argumentProcessResult: [variable, vector, body],
		origin:                BuiltInProcName.ForLoop
	});
	nextGraph.addEdge(rootId, body.entryPoint, EdgeType.NonStandardEvaluation);
	nextGraph.addEdge(name.info.id, vector.entryPoint, EdgeType.Reads);

	const variableEntry = ControlFlow.entryOf(variable);
	ControlFlow.continuesWith(nextGraph, vector, variableEntry);
	ControlFlow.branchesTo(nextGraph, variable, ControlFlow.entryOf(body), cd[0]);
	ControlFlow.branchesTo(nextGraph, variable, rootId, { id: cd[0].id, when: false });
	ControlFlow.continuesWith(nextGraph, body, variableEntry);
	ControlFlow.jumpsTo(nextGraph, body, ExitPointType.Next, variableEntry);
	ControlFlow.jumpsTo(nextGraph, body, ExitPointType.Break, rootId);

	// unless the body certainly runs, a removal within it only happens maybe; apply it as the merge cannot represent it
	const loopKill = body.kill?.length ? (once ? body.kill : makeKillsMaybe(body.kill, cd)) : undefined;
	const loopEnvironment = once ? body.environment : appendEnvironment(origEnv, appendEnvironment(headEnvironments, body.environment));

	return {
		unknownReferences: [],
		/* we only want those not bound by a local variable */
		in:                [{ nodeId: rootId, name: name.content, cds: data.cds, type: ReferenceType.Function }, ...vector.unknownReferences, ...bodyReadsOfOthers, ...ambientReads],
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
