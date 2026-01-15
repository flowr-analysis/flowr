import type { DataflowProcessorInformation } from '../../../../../processor';
import { processDataflowFor } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { alwaysExits, initializeCleanDataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	type RFunctionArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { BuiltInProcName } from '../../../../../environments/built-in';
import { invertArgumentMap, pMatch } from '../../../../linker';
import { convertFnArguments, patchFunctionCall } from '../common';
import { getArgumentWithId } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { unpackArg } from '../argument/unpack-argument';
import { resolveIdToValue } from '../../../../../eval/resolve/alias-tracking';
import { isValue } from '../../../../../eval/values/r-value';
import { ReferenceType } from '../../../../../environments/identifier';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { invalidRange } from '../../../../../../util/range';

/** e.g. UseMethod(generic, object) */
interface S3DispatchConfig {
	args: {
		generic: string,
		object:  string
	}
}

/**
 * Process an S3 dispatch call like `UseMethod`.
 */
export function processS3Dispatch<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: S3DispatchConfig
): DataflowInformation {
	if(args.length === 0) {
		dataflowLogger.warn('empty s3, skipping');
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const params = {
		[config.args.generic]: 'generic',
		[config.args.object]:  'object',
		'...':                 '...'
	};
	const argMaps = invertArgumentMap(pMatch(convertFnArguments(args), params));
	const generic = unpackArg(getArgumentWithId(args, argMaps.get('generic')?.[0]));
	if(!generic) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const obj = unpackArg(getArgumentWithId(args, argMaps.get('object')?.[0]));
	const dfObj = obj ? processDataflowFor(obj, data) : initializeCleanDataflowInformation(rootId, data);

	if(alwaysExits(dfObj)) {
		patchFunctionCall({
			nextGraph:             dfObj.graph,
			rootId,
			name,
			data,
			argumentProcessResult: [dfObj],
			origin:                BuiltInProcName.S3Dispatch
		});
		return dfObj;
	}

	const n = resolveIdToValue(generic.info.id, { environment: data.environment, resolve: data.ctx.config.solver.variables, idMap: data.completeAst.idMap, full: true, ctx: data.ctx });
	const accessedIdentifiers: string[] = [];
	if(n.type === 'set') {
		for(const elem of n.elements) {
			if(elem.type === 'string' && isValue(elem.value)) {
				accessedIdentifiers.push(elem.value.str);
			}
		}
	}
	if(accessedIdentifiers.length === 0) {
		dataflowLogger.warn('s3 dispatch with non-resolvable generic, skipping');
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const dfGeneric = processDataflowFor(generic, data);
	const symbol: RSymbol<OtherInfo & ParentInformation> = {
		type:      RType.Symbol,
		info:      generic.info,
		content:   accessedIdentifiers[0],
		lexeme:    accessedIdentifiers[0],
		location:  generic.location ?? invalidRange(),
		namespace: undefined
	};

	patchFunctionCall({
		nextGraph:             dfGeneric.graph,
		rootId:                generic.info.id,
		name:                  symbol,
		data,
		argumentProcessResult: [], // arguments will be attached by the accompanying enveloping function definition
		origin:                BuiltInProcName.S3Dispatch
	});

	patchFunctionCall({
		nextGraph:             dfGeneric.graph,
		rootId,
		name,
		data,
		argumentProcessResult: [dfGeneric, dfObj],
		origin:                BuiltInProcName.Function
	});


	const ingoing = dfObj.in.concat(dfGeneric.in,dfObj.unknownReferences, dfGeneric.unknownReferences);
	ingoing.push({ nodeId: rootId, name: name.content, cds: data.cds, type: ReferenceType.Function });
	for(const id of accessedIdentifiers) {
		ingoing.push({ nodeId: generic.info.id, name: id, cds: data.cds, type: ReferenceType.S3MethodPrefix });
	}
	return {
		hooks:             dfGeneric.hooks.concat(dfObj?.hooks),
		environment:       dfGeneric.environment,
		exitPoints:        dfObj.exitPoints.concat(dfGeneric.exitPoints),
		graph:             dfObj.graph.mergeWith(dfGeneric.graph),
		entryPoint:        rootId,
		in:                ingoing,
		out:               dfGeneric.out.concat(dfObj.out),
		unknownReferences: []
	};
}
