import type { DataflowProcessorInformation } from '../../../../../processor';
import { processDataflowFor } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { alwaysExits, initializeCleanDataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { invertArgumentMap, pMatch } from '../../../../linker';
import { convertFnArguments, patchFunctionCall } from '../common';
import { unpackArg } from '../argument/unpack-argument';
import { getArgumentWithId } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { popLocalEnvironment, pushLocalEnvironment } from '../../../../../environments/scoping';
import { BuiltInProcName } from '../../../../../environments/built-in';
import { ReferenceType } from '../../../../../environments/identifier';


export interface LocalFunctionConfiguration {
	args: {
		/** The expression in `local(expr, env)` */
		expr: string;
		/** The environment in `local(expr, env)` */
		env:  string;
	}
}

/**
 * Processes a built-in 'local' function call.
 */
export function processLocal<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: LocalFunctionConfiguration
): DataflowInformation {
	if(args.length === 0) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const params = {
		[config.args.expr]: 'expr',
		[config.args.env]:  'env',
		'...':              '...'
	};
	const argMaps = invertArgumentMap(pMatch(convertFnArguments(args), params));
	const env = unpackArg(getArgumentWithId(args, argMaps.get('env')?.[0]));
	const expr = unpackArg(getArgumentWithId(args, argMaps.get('expr')?.[0]));
	if(!expr) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const dfEnv = env ? processDataflowFor(env, data) : initializeCleanDataflowInformation(rootId, data);
	patchFunctionCall({
		nextGraph:             dfEnv.graph,
		rootId,
		name,
		data,
		argumentProcessResult: [dfEnv],
		origin:                BuiltInProcName.Local
	});

	if(alwaysExits(dfEnv)) {
		return dfEnv;
	}


	const bodyData  = { ...data, environment: pushLocalEnvironment(data.environment) };

	const exprDf = processDataflowFor(expr, bodyData);
	const ingoing = dfEnv.in.concat(exprDf.in,dfEnv.unknownReferences, exprDf.unknownReferences);
	ingoing.push({ nodeId: rootId, name: name.content, cds: data.cds, type: ReferenceType.Function });
	return {
		hooks:             exprDf.hooks.concat(dfEnv?.hooks),
		environment:       popLocalEnvironment(bodyData.environment),
		exitPoints:        dfEnv.exitPoints.concat(exprDf.exitPoints),
		graph:             dfEnv.graph.mergeWith(exprDf.graph),
		entryPoint:        rootId,
		in:                ingoing,
		out:               exprDf.out.concat(dfEnv.out),
		unknownReferences: []
	};
}
