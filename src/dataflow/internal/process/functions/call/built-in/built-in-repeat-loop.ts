import type { DataflowProcessorInformation } from '../../../../../processor';
import { FnSig } from '../../../../../environments/built-in-props';
import { type DataflowInformation, ExitPointType, filterOutLoopExitPoints } from '../../../../../info';
import {
	findNonLocalReads,
	linkCircularRedefinitionsWithinALoop,
	produceNameSharedIdMap,
	reapplyLoopExitPoints
} from '../../../../linker';
import { processKnownFunctionCall } from '../known-call-handling';
import { guard } from '../../../../../../util/assert';
import { unpackNonameArg } from '../argument/unpack-argument';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type {
	PotentiallyEmptyRArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { Identifier } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { ControlFlow } from '../../../../control-flow';
import { applyKills } from '../../../../../environments/apply-kill';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';

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
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(args.length !== 1 || RArgument.isEmpty(args[0])) {
		dataflowLogger.warn(`Repeat-Loop ${Identifier.toString(name.content)} does not have 1 argument, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const unpacked = unpackNonameArg(args[0]);
	const { information, processedArguments } = processKnownFunctionCall({
		name,
		args:      unpacked ? [unpacked] : args,
		rootId,
		data,
		sig:       FnSig.every,
		patchData: (d, i) => {
			if(i === 0) {
				return { ...d, cds: [...d.cds ?? [], { id: name.info.id }] };
			}
			return d;
		},
		markAsNSE:         [0],
		customControlFlow: true,
		origin:            BuiltInProcName.RepeatLoop
	});

	const body = processedArguments[0];
	guard(body !== undefined, () => `Repeat-Loop ${Identifier.toString(name.content)} has no body, impossible!`);

	linkCircularRedefinitionsWithinALoop(information.graph, produceNameSharedIdMap(findNonLocalReads(information.graph)), body.out, body.environment);
	reapplyLoopExitPoints(body.exitPoints, body.in.concat(body.out, body.unknownReferences), information.graph);

	information.exitPoints = filterOutLoopExitPoints(information.exitPoints);

	const graph = information.graph;
	const bodyEntry = ControlFlow.entryOf(body);
	ControlFlow.continuesWith(graph, body, bodyEntry);
	ControlFlow.jumpsTo(graph, body, ExitPointType.Next, bodyEntry);
	ControlFlow.jumpsTo(graph, body, ExitPointType.Break, rootId);

	/* the body is evaluated in the enclosing environment, so its definitions and removals have to bubble up */
	const kill = body.kill?.length ? body.kill : undefined;
	const leftByBreak = body.exitPoints.some(e => e.type === ExitPointType.Break);
	if(!leftByBreak) {
		/* without a `break` the loop never terminates, so nothing ever reaches the repeat vertex */
		information.exitPoints = information.exitPoints.filter(e => e.type !== ExitPointType.Default || e.nodeId !== rootId);
	}
	return {
		...information,
		cfgEntry:    bodyEntry,
		cfgExit:     leftByBreak ? rootId : undefined,
		out:         information.out.concat(body.out),
		/* the body always runs at least once, so a removal within it is certain */
		environment: applyKills(information.environment, kill),
		kill
	};
}
