import type { DataflowProcessorInformation } from '../../../../../processor';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { requestFromInput } from '../../../../../../r-bridge/retriever';
import { type ParentInformation, sourcedDeterministicCountingIdGenerator } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type PotentiallyEmptyRArgument, RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { expensiveTrace } from '../../../../../../util/log';
import { mergeSourced, sourceRequest } from './built-in-source';
import { EdgeType } from '../../../../../graph/edge';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { isUndefined } from '../../../../../../util/assert';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { cartesianProduct } from '../../../../../../util/collections/arrays';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import type { InGraphIdentifierDefinition } from '../../../../../environments/identifier';
import { DfgVertex } from '../../../../../graph/vertex';
import { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { Resolve } from '../../../../../environments/resolve-helper';
import { pipedCall, resolveConstantString, routeWrittenToStackEnv } from './built-in-envir-utils';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';

/** the calls turning a string into the symbol it names, whose evaluation is a plain variable read */
const SymbolConstructors: ReadonlySet<string> = new Set(['as.name', 'as.symbol']);
/** a name that can be written as code as it stands, so the generated read is the one R would perform */
const SyntacticName = /^[.a-zA-Z][.a-zA-Z0-9_]*$/;

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
		/** the formals of the call, when they are not `eval`'s own; `eval.parent(expr, n)` counts its frames, not an environment */
		parameterNames?:      readonly string[]
		/** does the call write in the frame of its caller, as `eval.parent` does? */
		parentFrame?:         boolean
	}
): DataflowInformation {
	const bound = FunctionSemantics.call.match.toNames(args, config.parameterNames ?? EvalParameterNames);
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
		processKnownFunctionCall({ name, args, rootId, data, sig: FunctionSemantics.call.signature.only(0, 'expr'), origin: BuiltInProcName.Eval }).information
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

	if(config.parentFrame || namesParentFrame(envirArg?.value, data)) {
		escapeWritesToParentFrame(evalArgument, rootId, data, information);
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


/** Whether the environment argument names the caller's frame, as `eval(expr, parent.frame())` does. */
function namesParentFrame<OtherInfo>(
	envir: RNode<OtherInfo & ParentInformation> | undefined,
	data:  DataflowProcessorInformation<OtherInfo & ParentInformation>
): boolean {
	return RFunctionCall.isNamed(envir)
		&& Identifier.getName(envir.functionName.content) === 'parent.frame'
		&& Resolve.isBuiltIn(envir.functionName.content, data.environment, ReferenceType.Function);
}

/**
 * Records what an expression evaluated in the caller's frame writes there, which is the same effect `<<-` has:
 * the definitions leave this frame, so a call to the enclosing function carries them to whoever made it.
 */
function escapeWritesToParentFrame<OtherInfo>(
	expr:        RNode<OtherInfo & ParentInformation>,
	rootId:      NodeId,
	data:        DataflowProcessorInformation<OtherInfo & ParentInformation>,
	information: DataflowInformation
): void {
	const written: (InGraphIdentifierDefinition & { name: Identifier })[] = [];
	RNode.visitAst<OtherInfo & ParentInformation>(expr, inner => {
		if(!RSymbol.is(inner) || !DfgVertex.isVariableDefinition(information.graph.getVertex(inner.info.id))) {
			return false;
		}
		written.push({
			nodeId:    inner.info.id,
			name:      inner.content,
			type:      ReferenceType.Variable,
			definedAt: rootId,
			cds:       data.cds
		});
		return false;
	});
	if(written.length === 0) {
		return;
	}
	/* same fold + Reads edge as routeWrittenToStackEnv; written comes from the AST walk above, not result.out */
	const routed = routeWrittenToStackEnv({ ...information, out: written }, information.environment, rootId);
	information.environment = routed.environment;
	information.out = [...information.out, ...written];
}

function resolveEvalToCode<OtherInfo>(evalArgument: RNode<OtherInfo & ParentInformation>, config: { includeFunctionCall?: boolean, supportFunctionCall?: boolean }, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): string[] | undefined {
	/* match the call a pipe desugars to (e.g. `nm |> as.name()`), not the pipe node itself */
	const val = pipedCall(evalArgument, data) ?? evalArgument;

	if(config.supportFunctionCall) {
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
		} else if(RFunctionCall.isNamed(val) && SymbolConstructors.has(Identifier.getName(val.functionName.content))
			&& Resolve.isBuiltIn(val.functionName.content, data.environment, ReferenceType.Function)) {
			/* evaluating the symbol a string names is the same as running that name as code */
			const arg = RFunctionCall.soleArgument(val.arguments);
			const named = arg?.value ? resolveConstantString(arg.value, data) : undefined;
			return named !== undefined && SyntacticName.test(named) ? [named] : undefined;
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