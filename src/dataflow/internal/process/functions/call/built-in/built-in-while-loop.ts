import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { alwaysExits, filterOutLoopExitPoints } from '../../../../../info';
import {
	findNonLocalReads,
	linkCircularRedefinitionsWithinALoop,
	linkInputs,
	produceNameSharedIdMap
} from '../../../../linker';
import { processKnownFunctionCall } from '../known-call-handling';
import { guard, isUndefined } from '../../../../../../util/assert';
import { unpackArgument } from '../argument/unpack-argument';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { makeAllMaybe } from '../../../../../environments/environment';
import { EdgeType } from '../../../../../graph/edge';
import { ReferenceType } from '../../../../../environments/identifier';
import { valueSetGuard } from '../../../../../eval/values/general';
import { resolveIdToValue } from '../../../../../eval/resolve/alias-tracking';

export function processWhileLoop<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(args.length !== 2 || args[1] === EmptyArgument) {
		dataflowLogger.warn(`While-Loop ${name.content} does not have 2 arguments, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const unpackedArgs = args.map(e => unpackArgument(e));

	if(unpackedArgs.some(isUndefined)) {
		dataflowLogger.warn(`While-Loop ${name.content} has empty arguments in ${JSON.stringify(args)}, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	// we should defer this to the abstract interpretation
	const values = resolveIdToValue(unpackedArgs[0]?.info.id, { environment: data.environment, idMap: data.completeAst.idMap, resolve: data.flowrConfig.solver.variables });
	const conditionIsAlwaysFalse = valueSetGuard(values)?.elements.every(d => d.type === 'logical' && d.value === false) ?? false;
	
	//We don't care about the body if it never executes
	if(conditionIsAlwaysFalse) {
		unpackedArgs.pop();
	}

	/* we inject the cf-dependency of the while-loop after the condition */
	const { information, processedArguments } = processKnownFunctionCall({
		name,
		args:      unpackedArgs as RNode<ParentInformation & OtherInfo>[],
		rootId,
		data,
		markAsNSE: [1],
		patchData: (d, i) => {
			if(i === 1) {
				return { ...d, controlDependencies: [...d.controlDependencies ?? [], { id: name.info.id, when: true }] };
			}
			return d;
		}, origin: 'builtin:while-loop' });
	const [condition, body] = processedArguments;

	// If the condition is always false, we don't include the body
	if(condition !== undefined && conditionIsAlwaysFalse) {
		information.graph.addEdge(name.info.id, condition.entryPoint, EdgeType.Reads);
		return {
			unknownReferences: [],
			in:                [{ nodeId: name.info.id, name: name.lexeme, controlDependencies: data.controlDependencies, type: ReferenceType.Function }],
			out:               condition.out,
			entryPoint:        name.info.id,
			exitPoints:        [],
			graph:             information.graph,
			environment:       information.environment
		};
	}

	guard(condition !== undefined && body !== undefined, () => `While-Loop ${name.content} has no condition or body, impossible!`);
	const originalDependency = data.controlDependencies;

	if(alwaysExits(condition)) {
		dataflowLogger.warn(`While-Loop ${rootId} forces exit in condition, skipping rest`);
		information.graph.addEdge(name.info.id, condition.entryPoint, EdgeType.Reads);
		return condition;
	}

	const remainingInputs = linkInputs([
		...makeAllMaybe(body.unknownReferences, information.graph, information.environment, false),
		...makeAllMaybe(body.in, information.graph, information.environment, false)
	], information.environment, [...condition.in, ...condition.unknownReferences], information.graph, true);
	linkCircularRedefinitionsWithinALoop(information.graph, produceNameSharedIdMap(findNonLocalReads(information.graph, condition.in)), body.out);

	// as the while-loop always evaluates its condition
	information.graph.addEdge(name.info.id, condition.entryPoint, EdgeType.Reads);

	return {
		unknownReferences: [],
		in:                [{ nodeId: name.info.id, name: name.lexeme, controlDependencies: originalDependency, type: ReferenceType.Function }, ...remainingInputs],
		out:               [...makeAllMaybe(body.out, information.graph, information.environment, true), ...condition.out],
		entryPoint:        name.info.id,
		exitPoints:        filterOutLoopExitPoints(body.exitPoints),
		graph:             information.graph,
		environment:       information.environment
	};
}
