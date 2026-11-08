import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { DataflowProcessorInformation } from '../../../../../processor';
import { RBinaryOp } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
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
import { isUndefined } from '../../../../../../util/assert';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { cartesianProduct } from '../../../../../../util/collections/arrays';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import type { InGraphIdentifierDefinition } from '../../../../../environments/identifier';
import { DfgVertex } from '../../../../../graph/vertex';
import { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { Resolve } from '../../../../../environments/resolve-helper';
import { envirOf, pipedCall, resolveArgToEnvirOrAmbiguous, resolveConstantString, routeWrittenToStackEnv, unknownIfAmbiguous } from './built-in-envir-utils';
import { evaluateInEnvir } from './built-in-local';
import { processDataflowFor } from '../../../../../processor';
import { REnvironment } from '../../../../../environments/environment';
import { CapturingCalls } from '../quoted';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { evaluatesCapturedCode } from './built-in-ambient-state';

const SymbolConstructors: ReadonlySet<string> = new Set(['as.name', 'as.symbol']);
const PasteFunctions: ReadonlySet<string> = new Set(['paste', 'paste0']);
const StringParsers: ReadonlySet<string> = new Set(['str2lang', 'str2expression']);
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
		parameterNames?:      readonly string[]
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

	const quoted = config.supportFunctionCall ? undefined : quotedCodeOf(evalArgument, data);
	if(quoted !== undefined) {
		return evaluateQuoted(quoted, config.parentFrame || namesParentFrame(envirArg?.value, data) ? undefined : envirArg, rootId, information, data);
	}

	const code: string[] | undefined = resolveEvalToCode(evalArgument as RNode<never>, config, data);

	if(code) {
		if(envirArg !== undefined) {
			/* the code runs in another environment, so its definitions do not land in the current one and
			 * pretending they do would produce wrong edges */
			handleUnknownSideEffect(information.graph, information.environment, rootId);
		}
		const idGenerator = sourcedDeterministicCountingIdGenerator(name.lexeme + '::' + rootId);

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
	/* a captured expression is linked once the graph is complete, but the state its calls access has to show now */
	return evaluatesCapturedCode(information, rootId, data);
}

/** the entry in {@link DataflowProcessorInformation#referenceChain} of evaluating `code`, so code evaluating itself (`q <- quote(eval(q))`) is not unrolled forever */
function evaluationOf(code: NodeId): string {
	return `eval:${String(code)}`;
}

/**
 * The code `eval` runs, if it is written down: what a quoting call captures (`eval(quote(x <- 1))`), or what each
 * binding of a name captures (`q <- quote(x <- 1); eval(q)`).
 */
function quotedCodeOf<OtherInfo>(node: RNode<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): readonly RNode<OtherInfo & ParentInformation>[] | undefined {
	const val = pipedCall(node, data) ?? node;
	const code = RSymbol.is(val)
		? Resolve.byNameAndType(val.content, data.environment, ReferenceType.Variable)?.map(d => capturedBy(boundValueOf(d.nodeId, data), data))
		: [capturedBy(val, data)];
	return code === undefined || code.length === 0 || code.some(isUndefined) ? undefined : code as RNode<OtherInfo & ParentInformation>[];
}

/**
 * The one expression a call to a built-in capturing code (`quote`, `bquote`, `expression`) holds on to, unless it is
 * being evaluated already; `substitute(expr, env)` replaces names before anything runs.
 */
function capturedBy<OtherInfo>(node: RNode<OtherInfo & ParentInformation> | undefined, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): RNode<OtherInfo & ParentInformation> | undefined {
	if(!RFunctionCall.isNamed(node)) {
		return undefined;
	}
	const defs = Resolve.byNameAndType(node.functionName.content, data.environment, ReferenceType.Function);
	const target = defs?.length === 1 && defs[0].type === ReferenceType.BuiltInFunction ? defs[0] : undefined;
	const index = target?.processorName === BuiltInProcName.Quote ? (target.config as { quoteArgumentsWithIndex?: number } | undefined)?.quoteArgumentsWithIndex
		: target !== undefined && CapturingCalls.has(Identifier.getName(node.functionName.content)) ? 0 : undefined;
	const code = index === undefined || node.arguments.length !== index + 1 ? undefined : RArgument.valueOf(node.arguments[index]);
	return code === undefined || data.referenceChain.includes(evaluationOf(code.info.id)) ? undefined : code;
}

/** the value a definition binds, `quote(x)` for `q` in `q <- quote(x)` */
function boundValueOf<OtherInfo>(target: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): RNode<OtherInfo & ParentInformation> | undefined {
	const assignment = data.completeAst.idMap.get(data.completeAst.idMap.get(target)?.info.parent ?? '');
	return RBinaryOp.is(assignment) ? assignment.lhs.info.id === target ? assignment.rhs : assignment.lhs : undefined;
}

/** Runs the quoted `code` where `eval` runs it: right here, or in the environment `envir` names (see {@link evaluateInEnvir}); with several candidates, each may be the one. */
function evaluateQuoted<OtherInfo>(
	code:        readonly RNode<OtherInfo & ParentInformation>[],
	envir:       PotentiallyEmptyRArgument<OtherInfo & ParentInformation> | undefined,
	rootId:      NodeId,
	information: DataflowInformation,
	data:        DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const routing = envir === undefined ? undefined : resolveArgToEnvirOrAmbiguous(envir, data);
	const at = { ...data, environment: information.environment, cds: code.length > 1 ? [...(data.cds ?? []), { id: rootId, when: true }] : data.cds };
	const results = code.map(c => {
		const inner = { ...at, referenceChain: [...at.referenceChain, evaluationOf(c.info.id)] };
		return envir === undefined ? processDataflowFor(c, inner) : evaluateInEnvir(c, envirOf(routing), rootId, inner);
	});
	const result: DataflowInformation = {
		...information,
		graph:       results.reduce((acc, r) => acc.mergeWith(r.graph), information.graph),
		environment: results.map(r => r.environment).reduce((acc, e) => REnvironment.append(acc, e)),
		in:          information.in.concat(results.flatMap(r => r.in), results.flatMap(r => r.unknownReferences)),
		out:         information.out.concat(results.flatMap(r => r.out)),
		exitPoints:  information.exitPoints.concat(results.flatMap(r => r.exitPoints)),
		hooks:       information.hooks.concat(results.flatMap(r => r.hooks))
	};
	for(const r of results) {
		result.graph.addEdge(rootId, r.entryPoint, EdgeType.Returns);
	}
	unknownIfAmbiguous(routing, result, rootId);
	return result;
}

function namesParentFrame<OtherInfo>(
	envir: RNode<OtherInfo & ParentInformation> | undefined,
	data:  DataflowProcessorInformation<OtherInfo & ParentInformation>
): boolean {
	return RFunctionCall.isNamed(envir, 'parent.frame')
		&& Resolve.isBuiltIn(envir.functionName.content, data.environment, ReferenceType.Function);
}

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
	const routed = routeWrittenToStackEnv({ ...information, out: written }, information.environment, rootId);
	information.environment = routed.environment;
	information.out = [...information.out, ...written];
}

function resolveEvalToCode<OtherInfo>(evalArgument: RNode<OtherInfo & ParentInformation>, config: { includeFunctionCall?: boolean, supportFunctionCall?: boolean }, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): string[] | undefined {
	const val = pipedCall(evalArgument, data) ?? evalArgument;

	if(config.supportFunctionCall) {
		return getAsString(val, data);
	} else {
		if(
			RFunctionCall.isNamed(val, 'parse')
		) {
			const arg = RArgument.findNamed(val.arguments, 'text');
			const nArg = RArgument.findNamed(val.arguments, 'n');
			if(nArg !== undefined || arg === undefined) {
				return undefined;
			}
			if(RFunctionCall.isNamed(arg.value, PasteFunctions)) {
				return handlePaste(arg.value.arguments, data, RFunctionCall.isNamed(arg.value, 'paste') ? [' '] : ['']);
			}
			return getAsString(arg.value, data);
		} else if(RFunctionCall.isNamed(val, StringParsers)) {
			/* both parse their string, like `parse(text = s)` */
			return getAsString(RFunctionCall.soleArgument(val.arguments)?.value, data);
		} else if(RFunctionCall.isNamed(val, SymbolConstructors)
			&& Resolve.isBuiltIn(val.functionName.content, data.environment, ReferenceType.Function)) {
			const arg = RFunctionCall.soleArgument(val.arguments);
			const named = arg?.value ? resolveConstantString(arg.value, data) : undefined;
			return named !== undefined && SyntacticName.test(named) ? [named] : undefined;
		} else if(RSymbol.is(val)) {
			/* `nm <- as.name("w"); eval(nm)`: a name bound once to code we can read is that code */
			const defs = Resolve.byName(val.content, data.environment);
			const source = defs?.length === 1 ? boundValueOf(defs[0].nodeId, data) : undefined;
			return source === undefined || RSymbol.is(source) ? undefined : resolveEvalToCode(source, config, data);
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
	const sepArg = RArgument.findNamed(args, 'sep');
	if(sepArg) {
		const res = sepArg.value ? getAsString(sepArg.value, data) : undefined;
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
