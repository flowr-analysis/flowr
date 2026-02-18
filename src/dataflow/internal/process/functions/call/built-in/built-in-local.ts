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
import { popLocalEnvironment, pushLocalEnvironment } from '../../../../../environments/scoping';
import { BuiltInProcName } from '../../../../../environments/built-in';
import { ReferenceType } from '../../../../../environments/identifier';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';


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
	const env = unpackArg(RArgument.getWithId(args, argMaps.get('env')?.[0]));
	const expr = unpackArg(RArgument.getWithId(args, argMaps.get('expr')?.[0]));
	if(!expr) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const dfEnv = env ? processDataflowFor(env, data) : initializeCleanDataflowInformation(rootId, data);
	if(alwaysExits(dfEnv)) {
		patchFunctionCall({
			nextGraph:             dfEnv.graph,
			rootId,
			name,
			data,
			argumentProcessResult: [dfEnv],
			origin:                BuiltInProcName.Local
		});
		return dfEnv;
	}


	const bodyData  = { ...data, environment: pushLocalEnvironment(data.environment) };

	const dfExpr = processDataflowFor(expr, bodyData);
	patchFunctionCall({
		nextGraph:             dfEnv.graph,
		rootId,
		name,
		data,
		argumentProcessResult: [dfExpr, dfEnv],
		origin:                BuiltInProcName.Local
	});

	const ingoing = dfEnv.in.concat(dfExpr.in, dfEnv.unknownReferences, dfExpr.unknownReferences);
	ingoing.push({ nodeId: rootId, name: name.content, cds: data.cds, type: ReferenceType.Function });
	return {
		hooks:             dfExpr.hooks.concat(dfEnv.hooks),
		environment:       popLocalEnvironment(dfExpr.environment),
		exitPoints:        dfEnv.exitPoints.concat(dfExpr.exitPoints),
		graph:             dfEnv.graph.mergeWith(dfExpr.graph),
		entryPoint:        rootId,
		in:                ingoing,
		out:               dfExpr.out.concat(dfEnv.out),
		unknownReferences: []
	};
}
