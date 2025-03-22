import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { remove } from '../../../../../environments/remove';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';

export function processRm<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	if(args.length === 0) {
		dataflowLogger.warn('empty rm, skipping');
		return processKnownFunctionCall({ name, args, rootId, data }).information;
	}
	const res = processKnownFunctionCall({ name, args, rootId, data }).information;

	const names: string[] = [];

	for(const arg of args) {
		if(arg === EmptyArgument) {
			dataflowLogger.warn('empty argument in rm, skipping');
			continue;
		}
		const unpacked = arg.value;
		if(unpacked === undefined || (unpacked.type !== RType.Symbol && unpacked.type !== RType.String)) {
			dataflowLogger.warn(`argument is not a symbol or string, skipping ${JSON.stringify(unpacked)}`);
		} else if(unpacked.type === RType.Symbol) {
			names.push(unpacked.content);
		} else if(unpacked.type === RType.String) {
			names.push(unpacked.content.str);
		}
	}

	let env = res.environment;
	for(const name of names) {
		env = remove(name, env);
	}

	return {
		...res,
		environment: env
	};
}
