import { type DataflowProcessorInformation } from '../../../../../processor';
import { type DataflowInformation, initializeCleanDataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { requestFromInput } from '../../../../../../r-bridge/retriever';
import {
	type AstIdMap,
	type ParentInformation,
	sourcedDeterministicCountingIdGenerator
} from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	EmptyArgument,
	type RFunctionArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { expensiveTrace } from '../../../../../../util/log';
import { sourceRequest } from './built-in-source';
import { EdgeType } from '../../../../../graph/edge';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { appendEnvironment } from '../../../../../environments/append';
import type { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { isUndefined } from '../../../../../../util/assert';
import { valueSetGuard } from '../../../../../eval/values/general';
import { collectStrings } from '../../../../../eval/values/string/string-constants';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { resolveIdToValue } from '../../../../../eval/resolve/alias-tracking';
import { cartesianProduct } from '../../../../../../util/collections/arrays';
import type { FlowrConfigOptions } from '../../../../../../config';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';


/**
 *
 */
export function processEvalCall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: {
		/** should this produce an explicit source function call in the graph? */
		includeFunctionCall?: boolean
	}
): DataflowInformation {
	if(args.length !== 1 || args[0] === EmptyArgument || !args[0].value) {
		dataflowLogger.warn(`Expected exactly one argument for eval currently, but got ${args.length} instead, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const information = config.includeFunctionCall ?
		processKnownFunctionCall({ name, args, rootId, data, forceArgs: [true], origin: 'builtin:eval' }).information
		: initializeCleanDataflowInformation(rootId, data);
	const evalArgument = args[0];

	if(config.includeFunctionCall) {
		information.graph.addEdge(
			rootId,
			args[0].value.info.id,
			EdgeType.Returns
		);
	}

	if(!data.ctx.config.solver.evalStrings) {
		expensiveTrace(dataflowLogger, () => `Skipping eval call ${JSON.stringify(evalArgument)} (disabled in config file)`);
		handleUnknownSideEffect(information.graph, information.environment, rootId);
		return information;
	}

	const code: string[] | undefined = resolveEvalToCode(evalArgument.value as RNode<ParentInformation>, data.environment, data.completeAst.idMap, data.ctx);

	if(code) {
		const idGenerator = sourcedDeterministicCountingIdGenerator(name.lexeme + '::' + rootId, name.location);

		data = {
			...data,
			controlDependencies: [...(data.controlDependencies ?? []), { id: rootId, when: true }]
		};
		const originalInfo = { ...information };

		const result: DataflowInformation[] = [];
		for(const c of code) {
			const codeRequest = requestFromInput(c);
			const r = sourceRequest(rootId, codeRequest, data, originalInfo, idGenerator);
			result.push(r);
			// add a returns edge from the eval to the result
			for(const e of r.exitPoints) {
				information.graph.addEdge(rootId, e, EdgeType.Returns);
			}
		}
		return {
			graph:             result.reduce((acc, r) => acc.mergeWith(r.graph), information.graph),
			environment:       result.reduce((acc, r) => appendEnvironment(acc, r.environment), information.environment),
			entryPoint:        rootId,
			out:               [...information.out, ...result.flatMap(r => r.out)],
			in:                [...information.in, ...result.flatMap(r => r.in)],
			unknownReferences: [...information.unknownReferences, ...result.flatMap(r => r.unknownReferences)],
			exitPoints:        [...information.exitPoints, ...result.flatMap(r => r.exitPoints)],
		};
	}

	expensiveTrace(dataflowLogger, () => `Non-constant argument ${JSON.stringify(args)} for eval is currently not supported, skipping`);
	handleUnknownSideEffect(information.graph, information.environment, rootId);
	return information;
}

function resolveEvalToCode<OtherInfo>(evalArgument: RNode<OtherInfo & ParentInformation>, env: REnvironmentInformation, idMap: AstIdMap, ctx: ReadOnlyFlowrAnalyzerContext): string[] | undefined {
	const val = evalArgument;

	if(
		val.type === RType.FunctionCall && val.named && val.functionName.content === 'parse'
	) {
		const arg = val.arguments.find(v => v !== EmptyArgument && v.name?.content === 'text');
		const nArg = val.arguments.find(v => v !== EmptyArgument && v.name?.content === 'n');
		if(nArg !== undefined || arg === undefined || arg === EmptyArgument) {
			return undefined;
		}
		if(arg.value?.type === RType.String) {
			return [arg.value.content.str];
		} else if(arg.value?.type === RType.Symbol) {
			const resolved = valueSetGuard(resolveIdToValue(arg.value.info.id, { environment: env, idMap: idMap, resolve: ctx.config.solver.variables, ctx }));
			if(resolved) {
				return collectStrings(resolved.elements);
			}
		} else if(arg.value?.type === RType.FunctionCall && arg.value.named && ['paste', 'paste0'].includes(arg.value.functionName.content)) {
			return handlePaste(ctx.config, arg.value.arguments, env, idMap, arg.value.functionName.content === 'paste' ? [' '] : [''], ctx);
		}
		return undefined;
	} else if(val.type === RType.Symbol) {
		// const resolved = resolveValueOfVariable(val.content, env);
		// see https://github.com/flowr-analysis/flowr/pull/1467
		return undefined;
	} else {
		return undefined;
	}
}

function getAsString(config: FlowrConfigOptions, val: RNode<ParentInformation> | undefined, env: REnvironmentInformation, idMap: AstIdMap, ctx: ReadOnlyFlowrAnalyzerContext): string[] | undefined {
	if(!val) {
		return undefined;
	}
	if(val.type === RType.String) {
		return [val.content.str];
	} else if(val.type === RType.Symbol) {
		const resolved = valueSetGuard(resolveIdToValue(val.info.id, { environment: env, idMap: idMap, resolve: config.solver.variables, ctx }));
		if(resolved) {
			return collectStrings(resolved.elements);
		}
	}
	return undefined;
}

function handlePaste(config: FlowrConfigOptions, args: readonly RFunctionArgument<ParentInformation>[], env: REnvironmentInformation, idMap: AstIdMap, sepDefault: string[], ctx: ReadOnlyFlowrAnalyzerContext): string[] | undefined {
	const sepArg = args.find(v => v !== EmptyArgument && v.name?.content === 'sep');
	if(sepArg) {
		const res = sepArg !== EmptyArgument && sepArg.value ? getAsString(config, sepArg.value, env, idMap, ctx) : undefined;
		if(!res) {
			// sep not resolvable clearly / unknown
			return undefined;
		}
		sepDefault = res;
	}

	const allArgs = args
		.filter(v => v !== EmptyArgument && v.name?.content !== 'sep' && v.value)
		.map(v => getAsString(config, (v as RArgument<ParentInformation>).value, env, idMap, ctx));
	if(allArgs.some(isUndefined)) {
		return undefined;
	}
	// return all cartesian products using the separator
	const result: string[] = [];

	const cartesianProducts = cartesianProduct(...allArgs as string[][]);

	for(const sep of sepDefault) {
		for(const c of cartesianProducts) {
			result.push(c.join(sep));
		}
	}

	return result;
}
