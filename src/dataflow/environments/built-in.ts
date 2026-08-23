import type { DataflowProcessorInformation } from '../processor';
import type { DataflowInformation, ExitPoint } from '../info';
import { ExitPointType } from '../info';
import { processKnownFunctionCall, markArgumentsAsNonStandardEvaluation, NseArguments, NseKind } from '../internal/process/functions/call/known-call-handling';
import { processAccess } from '../internal/process/functions/call/built-in/built-in-access';
import { processIfThenElse } from '../internal/process/functions/call/built-in/built-in-if-then-else';
import {
	processAssignment,
	processAssignmentLike,
	processDefineArgument
} from '../internal/process/functions/call/built-in/built-in-assignment';
import { processSpecialBinOp } from '../internal/process/functions/call/built-in/built-in-special-bin-op';
import { processPipe } from '../internal/process/functions/call/built-in/built-in-pipe';
import { processForLoop } from '../internal/process/functions/call/built-in/built-in-for-loop';
import { processRepeatLoop } from '../internal/process/functions/call/built-in/built-in-repeat-loop';
import { processWhileLoop } from '../internal/process/functions/call/built-in/built-in-while-loop';
import {
	type BrandedIdentifier,
	Identifier,
	type IdentifierDefinition,
	type IdentifierReference,
	ReferenceType
} from './identifier';
import { guard } from '../../util/assert';
import { processReplacementFunction } from '../internal/process/functions/call/built-in/built-in-replacement';
import { processQuote } from '../internal/process/functions/call/built-in/built-in-quote';
import { processFunctionDefinition } from '../internal/process/functions/call/built-in/built-in-function-definition';
import { processExpressionList } from '../internal/process/functions/call/built-in/built-in-expression-list';
import { processGet } from '../internal/process/functions/call/built-in/built-in-get';
import type { ParentInformation, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { type BuiltIn, NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { EdgeType } from '../graph/edge';
import { processLibrary } from '../internal/process/functions/call/built-in/built-in-library';
import { processSourceCall } from '../internal/process/functions/call/built-in/built-in-source';
import type { ForceArguments } from '../internal/process/functions/call/common';
import { processApply } from '../internal/process/functions/call/built-in/built-in-apply';
import type { LinkTo } from '../../queries/catalog/call-context-query/call-context-query-format';
import { processList } from '../internal/process/functions/call/built-in/built-in-list';
import { processVector } from '../internal/process/functions/call/built-in/built-in-vector';
import { processRm } from '../internal/process/functions/call/built-in/built-in-rm';
import { processEvalCall } from '../internal/process/functions/call/built-in/built-in-eval';
import { VertexType } from '../graph/vertex';
import { handleUnknownSideEffect } from '../graph/unknown-side-effect';
import type { REnvironmentInformation } from './environment';
import type { Value } from '../eval/values/r-value';
import type { ResolveInfo } from '../eval/resolve/alias-tracking';
import { resolveAsSeq, resolveAsVector } from '../eval/resolve/resolve';
import { StringFold } from '../eval/resolve/resolve-strings';
import { resolveAsComparison, resolveAsGroup, resolveAsLogical } from '../eval/resolve/resolve-operators';
import { NumericFold } from '../eval/resolve/resolve-numbers';
import { BuiltInEvalName } from './built-in-eval-name';
import type { VariableResolve } from '../../config';
import type {
	BuiltInConstantDefinition,
	BuiltInDefinition,
	BuiltInFunctionDefinition,
	BuiltInReplacementDefinition
} from './built-in-config';
import { processStopIfNot } from '../internal/process/functions/call/built-in/built-in-stop-if-not';
import { processTryCatch } from '../internal/process/functions/call/built-in/built-in-try-catch';
import { processRegisterHook } from '../internal/process/functions/call/built-in/built-in-register-hook';
import { processLocal } from '../internal/process/functions/call/built-in/built-in-local';
import { processS3Dispatch } from '../internal/process/functions/call/built-in/built-in-s-three-dispatch';
import { processRecall } from '../internal/process/functions/call/built-in/built-in-recall';
import { processS7NewGeneric, processMakeConstructor } from '../internal/process/functions/call/built-in/built-in-s-seven-new-generic';
import { processS7Dispatch } from '../internal/process/functions/call/built-in/built-in-s-seven-dispatch';
import { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { BuiltInProcName } from './built-in-proc-name';
import { processPurrrFormula } from '../internal/process/functions/call/built-in/built-in-purrr-formula';
import { processNewEnv } from '../internal/process/functions/call/built-in/built-in-new-env';
import { processClassGenerator } from '../internal/process/functions/call/built-in/built-in-class-generator';
import { processClassRelation } from '../internal/process/functions/call/built-in/built-in-class-relation';
import { processStackEnv } from '../internal/process/functions/call/built-in/built-in-stack-env';
import { processAttach } from '../internal/process/functions/call/built-in/built-in-attach';
import { processWithEnv } from '../internal/process/functions/call/built-in/built-in-with';
import { processNamespaceAccess } from '../internal/process/functions/call/built-in/built-in-namespace-access';
import { processLoadCall } from '../internal/process/functions/call/built-in/built-in-load';
import { processStringTemplate } from '../internal/process/functions/call/built-in/built-in-string-template';
import { ArgProp, FnSig, type BuiltInFnInfo } from './built-in-props';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { AttachedBasePackageSet } from '../../util/r-base-packages';
import { cleanEnvOf } from './scoping';

export type BuiltInIdentifierProcessor = <OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
) => DataflowInformation;

export type BuiltInIdentifierProcessorWithConfig<Config> = <OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: Config
) => DataflowInformation;

export interface BuiltInIdentifierDefinition extends IdentifierReference {
	type:         ReferenceType.BuiltInFunction
	definedAt:    BuiltIn
	processor:    BuiltInIdentifierProcessor
	config?:      ConfigOfBuiltInMappingName<keyof typeof BuiltInProcessorMapper> & BuiltInFnInfo & { libFn?: boolean }
	/** folds a call to this function to a constant, see {@link BuiltInEvalHandlerMapper} */
	evalHandler?: BuiltInEvalHandler
}

/**
 * Whether the definition states that the call does not evaluate some of its arguments the standard way, either
 * by quoting them or by handing them a data mask. Only such a definition changes what the arguments read, so
 * only it has to run in place of the default processor.
 */
export function statesNonStandardEvaluation(definition: BuiltInIdentifierDefinition | undefined): boolean {
	const config = definition?.config as Pick<DefaultBuiltInProcessorConfiguration, 'markArgsAsNSE' | 'markArgsAsMasked'> | undefined;
	return config?.markArgsAsNSE !== undefined || config?.markArgsAsMasked !== undefined;
}

export interface BuiltInIdentifierConstant<T = unknown> extends IdentifierReference {
	type:      ReferenceType.BuiltInConstant
	definedAt: BuiltIn
	value:     T
}

export interface DefaultBuiltInProcessorConfiguration extends ForceArguments, BuiltInFnInfo {
	readonly cfg?:                   ExitPointType,
	/** see {@link ProcessKnownFunctionCallInput#alternativeArgsFrom} */
	readonly alternativeArgsFrom?:   number,
	readonly readAllArguments?:      boolean,
	/**
	 * Propagate the `out` references produced by the arguments instead of dropping them.
	 * Set this for functions that are transparent about their arguments, like `(`.
	 */
	readonly keepArgumentOut?:       boolean,
	readonly hasUnknownSideEffects?: boolean | LinkTo<RegExp | string>,
	/** record mapping the actual function name called to the arguments that should be treated as function calls */
	readonly treatAsFnCall?:         Record<string, readonly string[]>,
	/** Mark the given arguments as {@link EdgeType.NonStandardEvaluation|non-standard-evaluated}, like `quote`. */
	readonly markArgsAsNSE?:         NseArguments | readonly number[],
	/**
	 * Mark the given arguments as evaluated in a data mask, like `subset`: their symbols may name columns of the
	 * data instead of variables, while everything else in them is evaluated in the caller's frame as usual.
	 */
	readonly markArgsAsMasked?:      NseArguments | readonly number[],
	/**
	 * Name that should be used for the origin (useful when needing to differentiate between
	 * functions like 'return' that use the default builtin processor)
	 */
	readonly useAsProcessor?:        BuiltInProcName
}
/** the {@link ResolveInfo} a handler continues to resolve with, plus the node it is asked to fold */
export interface BuiltInEvalHandlerArgs extends ResolveInfo {
	resolve: VariableResolve,
	node:    RNodeWithParent
}
export type BuiltInEvalHandler = (args: BuiltInEvalHandlerArgs) => Value;

/**
 * The symbols handed to an {@link ArgProp.Atomic} argument directly: only data works there, so `id` in `id > 2`
 * names a variable and not a function `id` that happens to be in scope, even though `>` may dispatch on the
 * operand's class. Anything bubbling up from a nested call is left alone, that call decided it already.
 */
function dataArgumentSymbols<OtherInfo>(
	args: readonly (RNodeWithParent | PotentiallyEmptyRArgument<OtherInfo & ParentInformation>)[],
	sig: FnSig | undefined
): ReadonlySet<NodeId> | undefined {
	const layout = sig === undefined ? undefined : FnSig.layout(sig);
	if(layout === undefined || (layout.any & ArgProp.Atomic) === 0) {
		return undefined;
	}
	let symbols: Set<NodeId> | undefined;
	for(let i = 0; i < args.length; i++) {
		const arg = args[i];
		const prop = FnSig.propAt(layout, i);
		if(RArgument.isEmpty(arg) || (prop & ArgProp.Atomic) === 0 || (prop & (ArgProp.Callee | ArgProp.Nse)) !== 0) {
			continue;
		}
		const value: RNodeWithParent | undefined = RArgument.is(arg) ? arg.value : arg;
		if(value !== undefined && RSymbol.is(value)) {
			(symbols ??= new Set()).add(value.info.id);
		}
	}
	return symbols;
}

function defaultBuiltInProcessor<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	{ useAsProcessor = BuiltInProcName.Default, forceArgs, readAllArguments, cfg, alternativeArgsFrom, hasUnknownSideEffects, treatAsFnCall, markArgsAsNSE: nse, markArgsAsMasked: masked, keepArgumentOut, sig }: DefaultBuiltInProcessorConfiguration
): DataflowInformation {
	/* a signature states per argument what the individual options state for all of them at once */
	const layout = sig !== undefined ? FnSig.layout(sig) : undefined;
	if(layout !== undefined) {
		forceArgs ??= (layout.any & ArgProp.Forced) !== 0 ? args.map((_, i) => (FnSig.propAt(layout, i) & ArgProp.Forced) !== 0) : undefined;
		nse ??= (layout.any & ArgProp.Nse) !== 0 ? FnSig.posWith(layout, args.length, ArgProp.Nse) : undefined;
	}
	const nsePositions = nsePositionsOf(nse, args.length);
	let lastEnv = data.environment;
	const { information: res, processedArguments } = processKnownFunctionCall({
		name, args, rootId, data, forceArgs, alternativeArgsFrom,
		origin:      useAsProcessor,
		nonFunction: dataArgumentSymbols(args, sig),
		/* an unevaluated argument must not read the current frame, so it is analyzed in a clean env like `quote` */
		patchData:   nsePositions === undefined ? undefined : (d, index) => {
			if(nsePositions.has(index)) {
				lastEnv = d.environment;
				return { ...d, environment: cleanEnvOf(d.environment) };
			}
			return { ...d, environment: lastEnv };
		}
	});
	if(nsePositions !== undefined) {
		dropQuotedReferences(res, processedArguments, nsePositions, lastEnv);
	}
	markArgumentsAsNonStandardEvaluation(res.graph, rootId, processedArguments, nse);
	markArgumentsAsNonStandardEvaluation(res.graph, rootId, processedArguments, masked, { kind: NseKind.DataMasked });
	if(keepArgumentOut) {
		res.out = [...res.out, ...processedArguments.flatMap(arg => arg?.out ?? [])];
	}
	if(layout !== undefined && layout.alias >= 0) {
		const arg = processedArguments[layout.alias];
		if(arg !== undefined) {
			res.graph.addEdge(rootId, arg.entryPoint, EdgeType.Returns);
		}
	}
	if(readAllArguments) {
		for(const arg of processedArguments) {
			if(arg) {
				res.graph.addEdge(rootId, arg.entryPoint, EdgeType.Reads);
			}
		}
	} else if(layout !== undefined && (layout.any & (ArgProp.Value | ArgProp.Shape)) !== 0) {
		for(const i of FnSig.posWith(layout, processedArguments.length, ArgProp.Value | ArgProp.Shape)) {
			const arg = processedArguments[i];
			if(arg) {
				res.graph.addEdge(rootId, arg.entryPoint, EdgeType.Reads);
			}
		}
	}
	if(hasUnknownSideEffects) {
		if(typeof hasUnknownSideEffects === 'boolean') {
			handleUnknownSideEffect(res.graph, res.environment, rootId);
		} else {
			handleUnknownSideEffect(res.graph, res.environment, rootId, hasUnknownSideEffects);
		}
	}

	const fnCallNames = treatAsFnCall?.[Identifier.getName(name.content)];
	if(fnCallNames) {
		for(const arg of args) {
			if(arg !== EmptyArgument && arg.value && fnCallNames.includes(arg.name?.content as string)) {
				const rhs = arg.value;
				let fnName: Identifier | undefined;
				let fnId: NodeId | undefined;
				if(RString.is(rhs)) {
					fnName = rhs.content.str;
					fnId = rhs.info.id;
				} else if(RSymbol.is(rhs)) {
					fnName = rhs.content;
					fnId = rhs.info.id;
				} else {
					continue;
				}
				res.graph.updateToFunctionCall({
					tag:         VertexType.FunctionCall,
					id:          fnId,
					name:        fnName,
					args:        [],
					environment: data.environment,
					onlyBuiltin: false,
					cds:         data.cds,
					origin:      [useAsProcessor]
				});
			}
		}
	}

	if(cfg !== undefined) {
		/* the call jumps, so it never falls through to whatever follows it */
		const exitPoints = (res.exitPoints as ExitPoint[]).filter(e => e.type !== ExitPointType.Default || e.nodeId !== rootId);
		exitPoints.push({ type: cfg, nodeId: rootId, cds: data.cds });
		(res as unknown as { exitPoints: ExitPoint[] }).exitPoints = exitPoints;
	}

	return res;
}

/** The argument positions {@link markArgumentsAsNonStandardEvaluation} would mark as quoted. */
function nsePositionsOf(which: NseArguments | readonly number[] | undefined, count: number): ReadonlySet<number> | undefined {
	if(which === undefined) {
		return undefined;
	} else if(typeof which !== 'string') {
		return new Set(which);
	}
	const positions = new Set<number>();
	const end = which === NseArguments.First ? Math.min(1, count) : count;
	for(let i = which === NseArguments.AllButFirst ? 1 : 0; i < end; i++) {
		positions.add(i);
	}
	return positions;
}

/** Whatever a quoted argument saw in its clean env must not be resolved in the caller's frame afterwards. */
function dropQuotedReferences(
	res: DataflowInformation,
	processedArguments: readonly (DataflowInformation | undefined)[],
	nsePositions: ReadonlySet<number>,
	lastEnv: REnvironmentInformation
): void {
	const quoted = new Set<NodeId>();
	for(const i of nsePositions) {
		const arg = processedArguments[i];
		for(const ref of [...arg?.in ?? [], ...arg?.unknownReferences ?? []]) {
			quoted.add(ref.nodeId);
		}
	}
	if(quoted.size > 0) {
		res.in = res.in.filter(ref => !quoted.has(ref.nodeId));
		res.unknownReferences = res.unknownReferences.filter(ref => !quoted.has(ref.nodeId));
	}
	if(nsePositions.has(processedArguments.length - 1)) {
		/* the clean env of the last argument must not become the env the call leaves behind */
		res.environment = lastEnv;
	}
}

function defaultBuiltInProcessorReadallArgs<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	{ useAsProcessor = BuiltInProcName.Default, forceArgs, markArgsAsNSE: nse, markArgsAsMasked: masked, sig }: Pick<DefaultBuiltInProcessorConfiguration, 'useAsProcessor' | 'forceArgs' | 'markArgsAsNSE' | 'markArgsAsMasked' | 'sig'>
): DataflowInformation {
	const { information, processedArguments } = processKnownFunctionCall({
		name, args, rootId, data, forceArgs, origin: useAsProcessor, nonFunction: dataArgumentSymbols(args, sig) });
	const g = information.graph;
	for(const arg of processedArguments) {
		if(arg) {
			g.addEdge(rootId, arg.entryPoint, EdgeType.Reads);
		}
	}
	markArgumentsAsNonStandardEvaluation(g, rootId, processedArguments, nse);
	markArgumentsAsNonStandardEvaluation(g, rootId, processedArguments, masked, { kind: NseKind.DataMasked });
	return information;
}

export const BuiltInProcessorMapper = {
	[BuiltInProcName.Access]:             processAccess,
	[BuiltInProcName.Apply]:              processApply,
	[BuiltInProcName.Assignment]:         processAssignment,
	[BuiltInProcName.AssignmentLike]:     processAssignmentLike,
	[BuiltInProcName.DefineArgument]:     processDefineArgument,
	[BuiltInProcName.Default]:            defaultBuiltInProcessor,
	[BuiltInProcName.DefaultReadAllArgs]: defaultBuiltInProcessorReadallArgs,
	[BuiltInProcName.StringTemplate]:     processStringTemplate,
	[BuiltInProcName.Eval]:               processEvalCall,
	[BuiltInProcName.ExpressionList]:     processExpressionList,
	[BuiltInProcName.ForLoop]:            processForLoop,
	[BuiltInProcName.FunctionDefinition]: processFunctionDefinition,
	[BuiltInProcName.Get]:                processGet,
	[BuiltInProcName.IfThenElse]:         processIfThenElse,
	[BuiltInProcName.Library]:            processLibrary,
	[BuiltInProcName.List]:               processList,
	[BuiltInProcName.Load]:               processLoadCall,
	[BuiltInProcName.Local]:              processLocal,
	[BuiltInProcName.NamespaceAccess]:    processNamespaceAccess,
	[BuiltInProcName.Pipe]:               processPipe,
	[BuiltInProcName.PurrrFormula]:       processPurrrFormula,
	[BuiltInProcName.Quote]:              processQuote,
	[BuiltInProcName.Recall]:             processRecall,
	[BuiltInProcName.RegisterHook]:       processRegisterHook,
	[BuiltInProcName.RepeatLoop]:         processRepeatLoop,
	[BuiltInProcName.Replacement]:        processReplacementFunction,
	[BuiltInProcName.Rm]:                 processRm,
	[BuiltInProcName.S3Dispatch]:         processS3Dispatch,
	[BuiltInProcName.S7NewGeneric]:       processS7NewGeneric,
	[BuiltInProcName.S7MakeConstructor]:  processMakeConstructor,
	[BuiltInProcName.S7Dispatch]:         processS7Dispatch,
	[BuiltInProcName.Source]:             processSourceCall,
	[BuiltInProcName.SpecialBinOp]:       processSpecialBinOp,
	[BuiltInProcName.StopIfNot]:          processStopIfNot,
	[BuiltInProcName.Try]:                processTryCatch,
	[BuiltInProcName.Attach]:             processAttach,
	[BuiltInProcName.NewEnv]:             processNewEnv,
	[BuiltInProcName.ClassGenerator]:     processClassGenerator,
	[BuiltInProcName.ClassRelation]:      processClassRelation,
	[BuiltInProcName.StackEnv]:           processStackEnv,
	[BuiltInProcName.With]:               processWithEnv,
	[BuiltInProcName.Vector]:             processVector,
	[BuiltInProcName.WhileLoop]:          processWhileLoop,
} as const satisfies Record<`builtin:${string}`, BuiltInIdentifierProcessorWithConfig<never>>;

/**
 * The value-solver function behind every {@link BuiltInEvalName}, the counterpart of the {@link BuiltInProcessorMapper}.
 * A built-in picks one of these by name with its serializable {@link BuiltInFunctionDefinition#evalHandler}.
 */
export const BuiltInEvalHandlerMapper = {
	[BuiltInEvalName.Vector]:     resolveAsVector,
	[BuiltInEvalName.Seq]:        resolveAsSeq,
	[BuiltInEvalName.Numeric]:    NumericFold.call,
	[BuiltInEvalName.Comparison]: resolveAsComparison,
	[BuiltInEvalName.Logical]:    resolveAsLogical,
	[BuiltInEvalName.StringFn]:   StringFold.call,
	[BuiltInEvalName.Group]:      resolveAsGroup
} as const satisfies Record<BuiltInEvalName, BuiltInEvalHandler>;

export type ConfigOfBuiltInMappingName<N extends keyof typeof BuiltInProcessorMapper> = Parameters<typeof BuiltInProcessorMapper[N]>[4];

export type BuiltInMemory = Map<BrandedIdentifier, IdentifierDefinition[]>;

/**
 * Whether a definition registered under `namespace` belongs in the always-on built-in environment.
 *
 * R only has base and the {@link AttachedBasePackages} on its search path at startup, so only those are in
 * scope without a `library()` call. Everything the configuration states about another package is *knowledge*
 * about it, not a reason to consider it loaded -- a name with no namespace at all is a language primitive and
 * always in scope.
 */
function attachedByDefault(namespace: string | undefined): boolean {
	return namespace === undefined || AttachedBasePackageSet.has(namespace);
}

export class BuiltIns {
	/**
	 * Register a built-in constant (like `NULL` or `TRUE`) to the given {@link BuiltIns}
	 */
	registerBuiltInConstant<T>({ names, value, assumePrimitive }: BuiltInConstantDefinition<T>): void {
		for(const name of names) {
			const n = Identifier.getName(name);
			const id = NodeId.toBuiltIn(n);
			const d: IdentifierDefinition[] = [{
				type:      ReferenceType.BuiltInConstant,
				definedAt: id,
				cds:       undefined,
				value,
				name,
				nodeId:    id
			}];
			this.set(n, d, assumePrimitive, Identifier.getNamespace(name));
		}
	}

	/**
	 * Register a built-in function (like `print` or `c`) to the given {@link BuiltIns}
	 */
	registerBuiltInFunctions<BuiltInProcessor extends keyof typeof BuiltInProcessorMapper>({ names, processor, config, assumePrimitive, evalHandler }: BuiltInFunctionDefinition<BuiltInProcessor> ): void {
		guard(processor !== undefined, () => `Processor for ${JSON.stringify(names)} is undefined, maybe you have an import loop? You may run 'npm run detect-circular-deps' - although by far not all are bad`);
		const mappedProcessor = BuiltInProcessorMapper[processor];
		guard(mappedProcessor !== undefined, () => `Processor for ${processor} is undefined! Please pass a valid builtin name ${JSON.stringify(Object.keys(BuiltInProcessorMapper))}!`);
		const mappedEval = evalHandler === undefined ? undefined : BuiltInEvalHandlerMapper[evalHandler];
		guard(evalHandler === undefined || mappedEval !== undefined, () => `Eval handler ${evalHandler} is unknown! Please pass a valid one of ${JSON.stringify(Object.keys(BuiltInEvalHandlerMapper))}!`);
		for(const name of names) {
			const n = Identifier.getName(name);
			const id = NodeId.toBuiltIn(n);
			const d: IdentifierDefinition[] = [{
				type:        ReferenceType.BuiltInFunction,
				definedAt:   id,
				cds:         undefined,
				/* eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-argument */
				processor:   (name, args, rootId, data) => mappedProcessor(name, args, rootId, data, config as any),
				config,
				evalHandler: mappedEval,
				name,
				nodeId:      id
			}];
			this.set(n, d, assumePrimitive, Identifier.getNamespace(name));
		}
	}

	/**
	 * Registers all combinations of replacements
	 */
	registerReplacementFunctions({ names, suffixes, assumePrimitive, config }: BuiltInReplacementDefinition): void {
		const replacer = BuiltInProcessorMapper[BuiltInProcName.Replacement];
		guard(replacer !== undefined, () => `Processor for ${BuiltInProcName.Replacement} is undefined!`);
		for(const assignment of names) {
			for(const suffix of suffixes) {
				const effectiveName = `${Identifier.getName(assignment)}${suffix}`;
				const id = NodeId.toBuiltIn(effectiveName);
				const d: IdentifierDefinition[] = [{
					type:      ReferenceType.BuiltInFunction,
					definedAt: id,
					processor: (name, args, rootId, data) => replacer(name, args, rootId, data, { makeMaybe: true, assignmentOperator: suffix, readIndices: config.readIndices }),
					config:    {
						...config,
						assignmentOperator: suffix,
						makeMaybe:          true
					},
					name:   assignment,
					cds:    undefined,
					nodeId: id
				}];
				this.set(effectiveName, d, assumePrimitive, Identifier.getNamespace(assignment));
			}
		}
	}

	/**
	 * Register a single {@link BuiltInDefinition} to the given memories in {@link BuiltIns}
	 */
	registerBuiltInDefinition(definition: BuiltInDefinition) {
		switch(definition.type) {
			case 'constant':
				return this.registerBuiltInConstant(definition);
			case 'function':
				return this.registerBuiltInFunctions(definition);
			case 'replacement':
				return this.registerReplacementFunctions(definition);
		}
	}

	/**
	 * The built-in {@link REnvironmentInformation|environment} is the root of all environments.
	 *
	 * For its default content (when not overwritten by a flowR config),
	 * see the {@link DefaultBuiltinConfig}.
	 */
	builtInMemory:      BuiltInMemory = new Map<BrandedIdentifier, IdentifierDefinition[]>();
	/**
	 * The twin of the {@link builtInMemory} but with less built ins defined for
	 * cases in which we want some commonly overwritten variables to remain open.
	 * If you do not know if you need the empty environment, you do not need the empty environment (right now).
	 * @see {@link builtInMemory}
	 */
	emptyBuiltInMemory: BuiltInMemory = new Map<BrandedIdentifier, IdentifierDefinition[]>();

	/**
	 * What the configuration states about the exports of packages R does not attach on startup, keyed by
	 * package and then by the bare name within it. These are *not* in {@link builtInMemory}: they enter an
	 * analysis only when that package is attached, see {@link BuiltIns.forPackage}.
	 */
	packageMemory: Map<string, BuiltInMemory> = new Map<string, BuiltInMemory>();

	/**
	 * Registers `definition` under `identifier`. A definition whose name carries a namespace R does not
	 * attach by default lands in {@link packageMemory} instead of the always-on environment.
	 * @param identifier           - the bare name the definition is reachable under
	 * @param definition           - what flowR states about it
	 * @param includeInEmptyMemory - whether it also belongs in the {@link emptyBuiltInMemory}
	 * @param namespace            - the package the name belongs to, `undefined` for a language primitive
	 */
	set(identifier: BrandedIdentifier, definition: IdentifierDefinition[], includeInEmptyMemory: boolean | undefined, namespace?: string): void {
		if(!attachedByDefault(namespace)) {
			const pkg = this.packageMemory.get(namespace as string) ?? new Map<BrandedIdentifier, IdentifierDefinition[]>();
			pkg.set(identifier, definition);
			this.packageMemory.set(namespace as string, pkg);
			return;
		}
		this.builtInMemory.set(identifier, definition);
		if(includeInEmptyMemory) {
			this.emptyBuiltInMemory.set(identifier, definition);
		}
	}

	/**
	 * What flowR states about `pkg`'s exports, `undefined` when it states nothing. Attaching the package is
	 * what brings these into scope, which is why they are kept out of the built-in environment.
	 * @param pkg - the package name
	 */
	forPackage(pkg: string): BuiltInMemory | undefined {
		return this.packageMemory.get(pkg);
	}
}
