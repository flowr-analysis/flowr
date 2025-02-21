import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowInformation } from '../../../../../info';
import type { DataflowProcessorInformation } from '../../../../../processor';
import { processKnownFunctionCall } from '../known-call-handling';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import path from 'path';
import { resolveValueOfVariable } from '../../../../../environments/resolve-by-name';
import type { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';

function joinPaths(has: string[] | 'unknown', newPath: string): string[] | 'unknown'{
	if(path.isAbsolute(newPath)) {
		return [newPath];
	} else {
		return has === 'unknown' ? 'unknown' : has.map(h => path.join(h, newPath));
	}
}

/**
 * Process a setwd call.
 *
 * Example:
 * ```r
 * setwd("path")
 * ```
 */
export function processSetWd<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	const info = processKnownFunctionCall({ name, args, rootId, data, forceArgs: [true] }).information;
	info.graph.markIdForUnknownSideEffects(rootId);

	if(args.length !== 1) {
		return info;
	}


	const pathArgument = args[0];
	if(pathArgument === EmptyArgument) {
		return info;
	}
	const value = pathArgument.value;
	if(value?.type === RType.String) {
		const newPath = value.content;
		data.currentWd = joinPaths(data.currentWd, newPath.str);
	} else if(value?.type === RType.Symbol) {
		const resolved = resolveValueOfVariable(value.lexeme, data.environment);
		const newWds = resolved?.map(r => {
			if(typeof r === 'object' && r !== null && 'type' in r && r.type === RType.String) {
				return joinPaths(data.currentWd, (r as RString).content.str);
			}
			return 'unknown';
		}) ?? [data.currentWd];
		if(newWds.some(wd => wd === 'unknown')) {
			data.currentWd = 'unknown';
		} else {
			data.currentWd = newWds.filter(wd => wd && wd !== 'unknown').flat();
		}
	}

	return info;
}
