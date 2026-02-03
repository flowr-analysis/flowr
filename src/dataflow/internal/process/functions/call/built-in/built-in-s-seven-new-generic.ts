import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { invertArgumentMap, pMatch } from '../../../../linker';
import { convertFnArguments } from '../common';
import { unpackArg } from '../argument/unpack-argument';
import { getArgumentWithId } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { BuiltInProcName } from '../../../../../environments/built-in';
import { EdgeType } from '../../../../../graph/edge';

/** e.g. new_generic(name, dispatch_args, fun=NULL) */
interface S7GenericDispatchConfig {
	args: {
		name:        string,
		dispatchArg: string,
		fun:         string
	}
}

/**
 * Process an S7 new generic dispatch call like `new_generic` or `setGeneric`.
 */
export function processS7NewGeneric<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: S7GenericDispatchConfig
): DataflowInformation {
	if(args.length < 1) {
		dataflowLogger.warn('empty s7 new_generic, skipping');
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const params = {
		[config.args.name]:        'name',
		[config.args.dispatchArg]: 'dispatchArg',
		[config.args.fun]:         'fun',
		'...':                     '...'
	};
	const argMaps = invertArgumentMap(pMatch(convertFnArguments(args), params));
	const genName = unpackArg(getArgumentWithId(args, argMaps.get('name')?.[0]));
	if(!genName) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const info = processKnownFunctionCall({ name, forceArgs: 'all', args, rootId, data, origin: BuiltInProcName.S7NewGeneric }).information;
	const funArg = unpackArg(getArgumentWithId(args, argMaps.get('fun')?.[0]));
	if(funArg) {
		info.graph.addEdge(rootId, funArg.info.id, EdgeType.Returns);
	}
	// else we treat it as a generic function with the S7 dispatch mechanism only
	// TODO TODO TODO

	// TODO: check fir setGeneric

	// TODO: also define and mark as a function definition in and of itself to allow linking calls to the generic!

	// TODO: also support S4 `standardGeneric`
	return info;
}
