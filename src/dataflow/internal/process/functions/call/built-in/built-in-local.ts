import type { DataflowProcessorInformation } from '../../../../../processor';
import { processDataflowFor } from '../../../../../processor';
import { DataflowInformation, alwaysExits } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { pMatch } from '../../../../linker';
import { convertFnArguments, patchFunctionCall } from '../common';
import { unpackArg } from '../argument/unpack-argument';
import { popLocalEnvironment, pushLocalEnvironment } from '../../../../../environments/scoping';
import { ReferenceType } from '../../../../../environments/identifier';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { resolveEnvirArg, routeWrittenToCustomEnv } from './built-in-envir-utils';


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
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
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
	const argMaps = pMatch(convertFnArguments(args), params);
	const env = unpackArg(RArgument.getWithId(args, argMaps.get('env')?.[0]));
	const expr = unpackArg(RArgument.getWithId(args, argMaps.get('expr')?.[0]));
	if(!expr) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	/* when envir resolves to a tracked environment, evaluate expr inside it */
	const envirResolution = env ? resolveEnvirArg(args, data, config.args.env) : undefined;

	const dfEnv = env ? processDataflowFor(env, data) : DataflowInformation.initialize(rootId, data);
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

	const baseEnvironment = envirResolution
		? envirResolution.envirData.environment     // evaluate in the tracked custom env
		: pushLocalEnvironment(data.environment);   // normal new local scope

	const dfExpr = processDataflowFor(expr, { ...data, environment: baseEnvironment });
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
	const baseResult = {
		hooks:             dfExpr.hooks.concat(dfEnv.hooks),
		environment:       envirResolution ? data.environment : popLocalEnvironment(dfExpr.environment),
		exitPoints:        dfEnv.exitPoints.concat(dfExpr.exitPoints),
		graph:             dfEnv.graph.mergeWith(dfExpr.graph),
		entryPoint:        rootId,
		in:                ingoing,
		out:               dfExpr.out.concat(dfEnv.out),
		unknownReferences: []
	};

	/* move all definitions made inside the body into the custom env's tracked state */
	if(envirResolution) {
		return routeWrittenToCustomEnv(baseResult, envirResolution.envDef, rootId, data);
	}
	return baseResult;
}
