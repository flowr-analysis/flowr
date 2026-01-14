import { type DataflowProcessorInformation , processDataflowFor } from '../../../../../processor';
import { type DataflowInformation , alwaysExits, filterOutLoopExitPoints } from '../../../../../info';
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
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { overwriteEnvironment } from '../../../../../environments/overwrite';
import { define } from '../../../../../environments/define';
import { appendEnvironment } from '../../../../../environments/append';
import { EdgeType } from '../../../../../graph/edge';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { IdentifierDefinition } from '../../../../../environments/identifier';
import { ReferenceType } from '../../../../../environments/identifier';
import { makeAllMaybe } from '../../../../../environments/reference-to-maybe';


/**
 * Processes a for-loop call: `for(<variable> in <vector>) <body>`
 * desugared as:
 * ```r
 * `for`(<variable>, <vector>, <body>)
 * ```
 */
export function processForLoop<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(args.length !== 3) {
		dataflowLogger.warn(`For-Loop ${name.content} does not have three arguments, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const [variableArg, vectorArg, bodyArg] = args.map(e => unpackNonameArg(e));

	guard(variableArg !== undefined && vectorArg !== undefined && bodyArg !== undefined, () => `For-Loop ${JSON.stringify(args)} has missing arguments! Bad!`);
	const vector = processDataflowFor(vectorArg, data);
	if(alwaysExits(vector)) {
		dataflowLogger.warn(`For-Loop ${rootId} forces exit in vector, skipping rest`);
		return vector;
	}

	const variable = processDataflowFor(variableArg, data);
	// this should not be able to exit always!

	const originalDependency = data.controlDependencies;

	let headEnvironments = overwriteEnvironment(vector.environment, variable.environment);
	const headGraph = variable.graph.mergeWith(vector.graph);

	const writtenVariable = variable.unknownReferences.concat(variable.in);
	for(const write of writtenVariable) {
		headEnvironments = define({ ...write, definedAt: name.info.id, type: ReferenceType.Variable } as (IdentifierDefinition & { name: string }), false, headEnvironments, data.ctx.config);
	}
	data = { ...data, controlDependencies: [...data.controlDependencies ?? [], { id: name.info.id, when: true }], environment: headEnvironments };

	const body = processDataflowFor(bodyArg, data);

	const nextGraph = headGraph.mergeWith(body.graph);
	const outEnvironment = appendEnvironment(headEnvironments, body.environment );

	// now we have to identify all reads that may be effected by a circular redefinition
	// for this, we search for all reads with a non-local read resolve!
	const nameIdShares = produceNameSharedIdMap(findNonLocalReads(nextGraph, writtenVariable));

	for(const write of writtenVariable) {
		nextGraph.addEdge(write.nodeId, vector.entryPoint, EdgeType.DefinedBy);
		nextGraph.setDefinitionOfVertex(write);
	}

	const outgoing = variable.out.concat(writtenVariable, makeAllMaybe(body.out, nextGraph, outEnvironment, true));

	linkCircularRedefinitionsWithinALoop(nextGraph, nameIdShares, body.out);

	reapplyLoopExitPoints(body.exitPoints, body.in.concat(body.out,body.unknownReferences));

	patchFunctionCall({
		nextGraph,
		rootId,
		name,
		data:                  { ...data, controlDependencies: originalDependency },
		argumentProcessResult: [variable, vector, body],
		origin:                'builtin:for-loop'
	});
	/* mark the last argument as nse */
	nextGraph.addEdge(rootId, body.entryPoint, EdgeType.NonStandardEvaluation);
	// as the for-loop always evaluates its condition
	nextGraph.addEdge(name.info.id, vector.entryPoint, EdgeType.Reads);

	return {
		unknownReferences: [],
		// we only want those not bound by a local variable
		in:                [{ nodeId: rootId, name: name.content, controlDependencies: originalDependency, type: ReferenceType.Function }, ...vector.unknownReferences, ...[...nameIdShares.values()].flat()],
		out:               outgoing,
		graph:             nextGraph,
		entryPoint:        name.info.id,
		exitPoints:        filterOutLoopExitPoints(body.exitPoints),
		environment:       outEnvironment,
		hooks:             variable.hooks.concat(vector.hooks, body.hooks),
	};
}
