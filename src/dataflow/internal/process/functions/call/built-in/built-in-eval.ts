import { type DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { initializeCleanDataflowInformation } from '../../../../../info';
import { getConfig } from '../../../../../../config';
import { processKnownFunctionCall } from '../known-call-handling';
import { requestFromInput } from '../../../../../../r-bridge/retriever';
import type { AstIdMap, ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	sourcedDeterministicCountingIdGenerator
} from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { expensiveTrace } from '../../../../../../util/log';
import { sourceRequest } from './built-in-source';
import { EdgeType } from '../../../../../graph/edge';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { resolveValueOfVariable } from '../../../../../environments/resolve-by-name';
import { appendEnvironment } from '../../../../../environments/append';
import type { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { isUndefined } from '../../../../../../util/assert';
import { cartesianProduct } from '../../../../../../util/collections/arrays';

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

	if(!getConfig().solver.evalStrings) {
		expensiveTrace(dataflowLogger, () => `Skipping eval call ${JSON.stringify(evalArgument)} (disabled in config file)`);
		information.graph.markIdForUnknownSideEffects(rootId);
		return information;
	}

	const code: string[] | undefined = resolveEvalToCode(evalArgument.value as RNode<ParentInformation>, data.environment, data.completeAst.idMap);

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
	information.graph.markIdForUnknownSideEffects(rootId);
	return information;
}

function resolveEvalToCode<OtherInfo>(evalArgument: RNode<OtherInfo & ParentInformation>, env: REnvironmentInformation, idMap: AstIdMap): string[] | undefined {
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
			const resolve = resolveValueOfVariable(arg.value.content, env, idMap);
			if(resolve?.every(r => typeof r === 'object' && r !== null && 'str' in r)) {
				return resolve.map(r => r.str as string);
			}
		} else if(arg.value?.type === RType.FunctionCall && arg.value.named && ['paste', 'paste0'].includes(arg.value.functionName.content)) {
			return handlePaste(arg.value.arguments, env, idMap, arg.value.functionName.content === 'paste' ? [' '] : ['']);
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

function getAsString(val: RNode<ParentInformation> | undefined, env: REnvironmentInformation, idMap: AstIdMap): string[] | undefined {
	if(!val) {
		return undefined;
	}
	if(val.type === RType.String) {
		return [val.content.str];
	} else if(val.type === RType.Symbol) {
		const resolved = resolveValueOfVariable(val.content, env, idMap);
		if(resolved?.every(r => typeof r === 'object' && r !== null && 'str' in r)) {
			return resolved.map(r => r.str as string);
		}
	}
	return undefined;
}

function handlePaste(args: readonly RFunctionArgument<ParentInformation>[], env: REnvironmentInformation, idMap: AstIdMap, sepDefault: string[]): string[] | undefined {
	const sepArg = args.find(v => v !== EmptyArgument && v.name?.content === 'sep');
	if(sepArg) {
		const res = sepArg !== EmptyArgument && sepArg.value ? getAsString(sepArg.value, env, idMap) : undefined;
		if(!res) {
			// sep not resolvable clearly / unknown
			return undefined;
		}
		sepDefault = res;
	}

	const allArgs = args
		.filter(v => v !== EmptyArgument && v.name?.content !== 'sep' && v.value)
		.map(v => getAsString((v as RArgument<ParentInformation>).value, env, idMap));
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
