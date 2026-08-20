import { MatchArgs } from '../../../../../graph/match-args';
import type { DataflowProcessorInformation } from '../../../../../processor';
import { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { requestFromInput } from '../../../../../../r-bridge/retriever';
import {
	type ParentInformation,
	sourcedDeterministicCountingIdGenerator
} from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	type PotentiallyEmptyRArgument,
	RFunctionCall
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { expensiveTrace } from '../../../../../../util/log';
import { mergeSourced, sourceRequest } from './built-in-source';
import { EdgeType } from '../../../../../graph/edge';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { isUndefined } from '../../../../../../util/assert';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { cartesianProduct } from '../../../../../../util/collections/arrays';
import { Identifier } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';


/** the formals of `eval(expr, envir, enclos)` */
const EvalParameterNames = ['expr', 'envir', 'enclos'] as const;

/**
 * Process a call to `eval()`, trying to resolve the code being evaluated if possible.
 */
export function processEvalCall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: {
		/** should this produce an explicit source function call in the graph? */
		includeFunctionCall?: boolean
		/** if selected processes evalText function call, else processes eval*/
		supportFunctionCall?: boolean
	}
): DataflowInformation {
	const bound = MatchArgs.toNames(args, EvalParameterNames);
	/* `evalText` names its formal differently, so a lone argument is the expression whatever it is called */
	const evalArgument = (bound.get('expr') ?? RFunctionCall.soleArgument(args))?.value;
	const envirArg = bound.get('envir');

	if(evalArgument === undefined) {
		dataflowLogger.warn(`Expected an expression argument for eval, but got ${args.length} argument(s), skipping`);
		const bail = processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
		handleUnknownSideEffect(bail.graph, bail.environment, rootId);
		return bail;
	}

	const information = config.includeFunctionCall ?
		processKnownFunctionCall({ name, args, rootId, data, forceArgs: [true], origin: BuiltInProcName.Eval }).information
		: DataflowInformation.initialize(rootId, data);

	if(config.includeFunctionCall) {
		information.graph.addEdge(
			rootId,
			evalArgument.info.id,
			EdgeType.Returns
		);
	}

	if(!data.ctx.config.solver.evalStrings) {
		expensiveTrace(dataflowLogger, () => `Skipping eval call ${JSON.stringify(evalArgument)} (disabled in config file)`);
		handleUnknownSideEffect(information.graph, information.environment, rootId);
		return information;
	}

	const code: string[] | undefined = resolveEvalToCode(evalArgument as RNode<never>, config, data);

	if(code) {
		if(envirArg !== undefined) {
			/* the code runs in another environment, so its definitions do not land in the current one and
			 * pretending they do would produce wrong edges */
			handleUnknownSideEffect(information.graph, information.environment, rootId);
		}
		const idGenerator = sourcedDeterministicCountingIdGenerator(name.lexeme + '::' + rootId, name.location);

		data = {
			...data,
			cds: code.length > 1 ? [...(data.cds ?? []), { id: rootId, when: true }] : data.cds
		};
		const originalInfo = { ...information };

		const result: DataflowInformation[] = [];
		for(const c of code) {
			const codeRequest = requestFromInput(c);
			const r = sourceRequest(rootId, codeRequest, data, originalInfo, code.length > 1, idGenerator);
			result.push(r);
			// add a returns edge from the eval to the result
			for(const e of r.exitPoints) {
				information.graph.addEdge(rootId, e.nodeId, EdgeType.Returns);
			}
		}
		return mergeSourced({ ...information, entryPoint: rootId }, result);
	}

	expensiveTrace(dataflowLogger, () => `Non-constant argument ${JSON.stringify(args)} for eval is currently not supported, skipping`);
	handleUnknownSideEffect(information.graph, information.environment, rootId);
	return information;
}

function resolveEvalToCode<OtherInfo>(evalArgument: RNode<OtherInfo & ParentInformation>, config: { includeFunctionCall?: boolean, supportFunctionCall?: boolean }, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): string[] | undefined {
	const val = evalArgument;

	if(config.supportFunctionCall){
		return getAsString(val, data);
	} else {
		if(
			RFunctionCall.isNamed(val) && Identifier.getName(val.functionName.content) === 'parse'
		) {
			const arg = val.arguments.find(v => v !== EmptyArgument && v.name?.content === 'text');
			const nArg = val.arguments.find(v => v !== EmptyArgument && v.name?.content === 'n');
			if(nArg !== undefined || arg === undefined || RArgument.isEmpty(arg)) {
				return undefined;
			}
			if(RFunctionCall.isNamed(arg.value) && ['paste', 'paste0'].includes(Identifier.getName(arg.value.functionName.content))) {
				return handlePaste(arg.value.arguments, data, Identifier.getName(arg.value.functionName.content) === 'paste' ? [' '] : ['']);
			}
			return getAsString(arg.value, data);
		} else if(RSymbol.is(val)) {
			// const resolved = resolveValueOfVariable(val.content, env);
			// see https://github.com/flowr-analysis/flowr/pull/1467
			return undefined;
		} else {
			return undefined;
		}
	}
}


function getAsString<OtherInfo>(val: RNode<ParentInformation> | undefined, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): string[] | undefined {
	if(!val) {
		return undefined;
	}
	if(RString.is(val)) {
		return [val.content.str];
	} else if(RSymbol.is(val)) {
		return NodeValue.stringsOf(val.info.id, data);
	}
	return undefined;
}

function handlePaste<OtherInfo>(args: readonly PotentiallyEmptyRArgument<ParentInformation>[], data: DataflowProcessorInformation<OtherInfo & ParentInformation>, sepDefault: string[]): string[] | undefined {
	const sepArg = args.find(v => v !== EmptyArgument && v.name?.content === 'sep');
	if(sepArg) {
		const res = sepArg !== EmptyArgument && sepArg.value ? getAsString(sepArg.value, data) : undefined;
		if(!res) {
			// sep not resolvable clearly / unknown
			return undefined;
		}
		sepDefault = res;
	}

	const allArgs = args
		.filter(v => v !== EmptyArgument && v.name?.content !== 'sep' && v.value)
		.map(v => getAsString((v as RArgument<ParentInformation>).value, data));
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