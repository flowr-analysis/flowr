import type { DataflowProcessorInformation } from '../../../../../processor';
import type { ExitPoint, DataflowInformation } from '../../../../../info';
import { ExitPointType } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	EmptyArgument,
	type RFunctionArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { pMatch } from '../../../../linker';

// TODO: try writes to try.outfile if set as option ~> dependencies query
/// TODO: try outfile!

/**
 * Process a built-in try-catch or similar handler.
 */
export function processTryCatch<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: {
		block:    string,
		handlers: {
			error?:   string,
			finally?: string
		}
	}
): DataflowInformation {
	const res = processKnownFunctionCall({ name, args, rootId, data, origin: 'builtin:try', forceArgs: 'all' });
	if(args.length < 1 || args[0] === EmptyArgument) {
		dataflowLogger.warn(`TryCatch Handler ${name.content} does not have 1 argument, skipping`);
		return res.information;
	}
	// artificial ids :)
	const params = {
		[config.block]: 'block',
		'...':          '...'
	};
	// only remove exit points from the block
	const argMaps = pMatch(res.callArgs, params);
	const info = res.information;

	const blockArg = new Set(argMaps.entries().filter(([,v]) => v === 'block').map(([k]) => k));
	if(blockArg.size >= 1) {
		// only take those exit points from the block
		(info.exitPoints as ExitPoint[]) = res.processedArguments.flatMap(arg => {
			if(!arg) {
				return [];
			}
			if(!blockArg.has(arg.entryPoint)) {
				// not killing other args
				return arg.exitPoints;
			}
			return arg.exitPoints.filter(ep => ep.type !== ExitPointType.Error);
		});
	} else {
		// filter out errors
		(info.exitPoints as ExitPoint[]).filter(ep => ep.type !== ExitPointType.Error);
	}

	return info;
}
