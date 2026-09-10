import type { DataflowProcessorInformation } from '../../../../../processor';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import { processDataflowFor } from '../../../../../processor';
import { DataflowInformation } from '../../../../../info';
import { EdgeType } from '../../../../../graph/edge';
import { processKnownFunctionCall } from '../known-call-handling';
import { ControlFlow } from '../../../../control-flow';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { convertFnArguments, patchFunctionCall } from '../common';
import { unpackArg } from '../argument/unpack-argument';
import { popLocalEnvironment, pushLocalEnvironment } from '../../../../../environments/scoping';
import { ReferenceType } from '../../../../../environments/identifier';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { envirOf, resolveArgToEnvirOrAmbiguous, routeWrittenToEnvir, unknownIfAmbiguous } from './built-in-envir-utils';
import { Resolve } from '../../../../../environments/resolve-helper';


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
	const argMaps = FunctionSemantics.call.match.toSpec(convertFnArguments(args), params);
	const envArg = RArgument.getWithId(args, argMaps.get('env')?.[0]);
	const env = unpackArg(envArg);
	const expr = unpackArg(RArgument.getWithId(args, argMaps.get('expr')?.[0]));
	if(!expr) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	/* when envir resolves to a tracked environment, evaluate expr inside it */
	const envirRouting = envArg ? resolveArgToEnvirOrAmbiguous(envArg, data) : undefined;
	const envirResolution = envirOf(envirRouting);

	const dfEnv = env ? processDataflowFor(env, data) : DataflowInformation.initialize(rootId, data);
	if(ControlFlow.alwaysExits(dfEnv)) {
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
		argumentProcessResult: env ? [dfExpr, dfEnv] : [dfExpr],
		origin:                BuiltInProcName.Local
	});

	const resultEnvironment = envirResolution ? data.environment : popLocalEnvironment(dfExpr.environment);
	/* definitions of the local scope vanish with it, only what escaped it (e.g. via `<<-`) may bubble up */
	const escaping = envirResolution ? dfExpr.out : dfExpr.out.filter(
		o => o.name !== undefined && Resolve.byNameAndType(o.name, resultEnvironment, o.type)?.some(d => d.nodeId === o.nodeId)
	);
	for(const escaped of escaping) {
		dfExpr.graph.addEdge(escaped.nodeId, rootId, EdgeType.Reads);
	}

	const ingoing = dfEnv.in.concat(dfExpr.in, dfEnv.unknownReferences, dfExpr.unknownReferences);
	ingoing.push({ nodeId: rootId, name: name.content, cds: data.cds, type: ReferenceType.Function });
	const graph = dfEnv.graph.mergeWith(dfExpr.graph);
	const cfgEntry = ControlFlow.inSequence(graph, env ? [dfEnv, dfExpr] : [dfExpr], rootId);
	const baseResult = {
		hooks:             dfExpr.hooks.concat(dfEnv.hooks),
		environment:       resultEnvironment,
		exitPoints:        dfEnv.exitPoints.concat(dfExpr.exitPoints),
		graph,
		entryPoint:        rootId,
		cfgEntry,
		cfgExit:           rootId,
		in:                ingoing,
		out:               escaping.concat(dfEnv.out),
		unknownReferences: []
	};

	unknownIfAmbiguous(envirRouting, baseResult, rootId);

	return envirResolution ? routeWrittenToEnvir(baseResult, envirResolution, rootId, data.environment) : baseResult;
}
