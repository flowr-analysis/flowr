import type { DataflowProcessorInformation } from '../../../../../processor';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import { updateNestedFunctionClosures } from './built-in-function-definition';
import { processDataflowFor } from '../../../../../processor';
import { DataflowInformation, ExitPointType } from '../../../../../info';
import { DfgVertex } from '../../../../../graph/vertex';
import { EdgeType } from '../../../../../graph/edge';
import { processKnownFunctionCall } from '../known-call-handling';
import { ControlFlow } from '../../../../control-flow';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { convertFnArguments, patchFunctionCall } from '../common';
import { ReferenceType } from '../../../../../environments/identifier';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { type EnvirResolution, envirOf, resolveArgToEnvirOrAmbiguous, routeWrittenToEnvir, unknownIfAmbiguous } from './built-in-envir-utils';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { Resolve } from '../../../../../environments/resolve-helper';
import { REnvironment } from '../../../../../environments/environment';


export interface LocalFunctionConfiguration {
	args: {
		/** The expression in `local(expr, env)` */
		expr: string;
		/** The environment in `local(expr, env)` */
		env:  string;
	}
}

/** Processes a built-in 'local' function call. */
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
	const argMaps = FunctionSemantics.call.match.toSpec(convertFnArguments(args), {
		[config.args.expr]: 'expr',
		[config.args.env]:  'env',
		'...':              '...'
	});
	const envArg = RArgument.getWithId(args, argMaps.get('env')?.[0]);
	const env = RArgument.valueOf(envArg);
	const expr = RArgument.valueOf(RArgument.getWithId(args, argMaps.get('expr')?.[0]));
	if(!expr) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	/* when envir resolves to a tracked environment, evaluate expr inside it */
	const envirRouting = envArg ? resolveArgToEnvirOrAmbiguous(envArg, data) : undefined;
	const envirResolution = envirOf(envirRouting);
	const dfEnv = env ? processDataflowFor(env, data) : DataflowInformation.initialize(rootId, data);
	if(ControlFlow.alwaysExits(dfEnv, data.cds)) {
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

	const dfExpr = evaluateInEnvir(expr, envirResolution, rootId, data);
	patchFunctionCall({
		nextGraph:             dfEnv.graph,
		rootId,
		name,
		data,
		argumentProcessResult: env ? [dfExpr, dfEnv] : [dfExpr],
		origin:                BuiltInProcName.Local
	});

	const graph = dfEnv.graph.mergeWith(dfExpr.graph);
	graph.addEdge(rootId, expr.info.id, EdgeType.Returns);
	/* `y` in `local(y <- 1)` gets its value from `1`, so a definition in the body gets no `Reads` edge to `local` */
	for(const [id, vertex] of dfExpr.graph.vertices(false)) {
		if(!DfgVertex.isUse(vertex) && !DfgVertex.isValue(vertex) && !DfgVertex.isVariableDefinition(vertex)) {
			graph.addEdge(id, rootId, EdgeType.Reads);
		}
	}
	const cfgEntry = ControlFlow.inSequence(graph, env ? [dfEnv, dfExpr] : [dfExpr], rootId);
	/* `return` only leaves the evaluation that local opens */
	ControlFlow.jumpsTo(graph, dfExpr, ExitPointType.Return, rootId);
	const ingoing = dfEnv.in.concat(dfExpr.in, dfEnv.unknownReferences, dfExpr.unknownReferences);
	ingoing.push({ nodeId: rootId, name: name.content, cds: data.cds, type: ReferenceType.Function });
	const baseResult = {
		hooks:             dfExpr.hooks.concat(dfEnv.hooks),
		environment:       dfExpr.environment,
		exitPoints:        dfEnv.exitPoints.concat(dfExpr.exitPoints.filter(e => e.type !== ExitPointType.Return)),
		graph,
		entryPoint:        rootId,
		cfgEntry,
		cfgExit:           rootId,
		in:                ingoing,
		out:               dfExpr.out.concat(dfEnv.out),
		unknownReferences: []
	};

	unknownIfAmbiguous(envirRouting, baseResult, rootId);
	return baseResult;
}

/**
 * Evaluates `expr` in the environment `envir` pins down, or in a fresh frame on top of the current one, as `local`
 * and `eval(expr, envir)` do. The search path is global, so what `expr` attaches stays, and of a fresh frame only
 * what escaped it (e.g., via `<<-`) remains.
 */
export function evaluateInEnvir<OtherInfo>(
	expr: RNode<OtherInfo & ParentInformation>,
	envir: EnvirResolution<OtherInfo> | undefined,
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const dfExpr = processDataflowFor(expr, { ...data, environment: envir?.envirData.environment ?? REnvironment.pushLocal(data.environment) });
	/* in `local({ y <- 1; function() y })` the read of `y` is linked now, as the frame of `local` is dropped below */
	updateNestedFunctionClosures(dfExpr.graph, dfExpr.environment, []);
	if(envir !== undefined) {
		const environment = { level: data.environment.level, current: REnvironment.adoptSearchPath(data.environment.current, dfExpr.environment.current) };
		return routeWrittenToEnvir({ ...dfExpr, environment }, envir, rootId, data.environment);
	}
	const environment = REnvironment.popLocal(dfExpr.environment);
	/* definitions of the local scope vanish with it, only what escaped it may bubble up */
	const out = dfExpr.out.filter(o => o.name !== undefined && Resolve.byNameAndType(o.name, environment, o.type)?.some(d => d.nodeId === o.nodeId));
	return { ...dfExpr, environment, out };
}
