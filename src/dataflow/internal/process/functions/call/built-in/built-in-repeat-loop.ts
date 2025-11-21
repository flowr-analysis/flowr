import type { DataflowProcessorInformation } from '../../../../../processor';
import { type DataflowInformation , filterOutLoopExitPoints } from '../../../../../info';
import {
	findNonLocalReads,
	linkCircularRedefinitionsWithinALoop,
	produceNameSharedIdMap, reapplyLoopExitPoints
} from '../../../../linker';
import { processKnownFunctionCall } from '../known-call-handling';
import { guard } from '../../../../../../util/assert';
import { unpackArgument } from '../argument/unpack-argument';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type RFunctionArgument , EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';

/**
 * Process a built-in repeat loop function call like `repeat { ... }`.
 * @param name     - The name of the function being called.
 * @param args     - The arguments passed to the function.
 * @param rootId   - The root node ID for the current processing context.
 * @param data     - Additional dataflow processor information.
 * @returns        - The resulting dataflow information after processing the repeat loop.
 */
export function processRepeatLoop<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(args.length !== 1 || args[0] === EmptyArgument) {
		dataflowLogger.warn(`Repeat-Loop ${name.content} does not have 1 argument, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const unpacked = unpackArgument(args[0]);
	const { information, processedArguments } = processKnownFunctionCall({
		name,
		args:      unpacked ? [unpacked] : args,
		rootId,
		data,
		patchData: (d, i) => {
			if(i === 0) {
				return { ...d, controlDependencies: [...d.controlDependencies ?? [], { id: name.info.id }] };
			}
			return d;
		},
		markAsNSE: [0],
		origin:    'builtin:repeat-loop'
	});

	const body = processedArguments[0];
	guard(body !== undefined, () => `Repeat-Loop ${name.content} has no body, impossible!`);

	linkCircularRedefinitionsWithinALoop(information.graph, produceNameSharedIdMap(findNonLocalReads(information.graph, [])), body.out);
	reapplyLoopExitPoints(body.exitPoints, body.in.concat(body.out,body.unknownReferences));

	information.exitPoints = filterOutLoopExitPoints(information.exitPoints);

	return information;
}
