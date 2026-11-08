import { AmbientStateName, KeyedState } from './ambient-state-name';
import type { DataflowProcessorInformation } from '../processor';
import { FunctionSemantics } from '../fn/function-semantics';
import type { DataflowInformation, ExitPoint } from '../info';
import { ExitPointType } from '../info';
import { processKnownFunctionCall, markArgumentsAsNonStandardEvaluation, nseArgumentPositions } from '../internal/process/functions/call/known-call-handling';
import { type NseArguments, NseKind } from '../internal/process/functions/call/nse-kind';
import { processAccess } from '../internal/process/functions/call/built-in/built-in-access';
import { processIfThenElse } from '../internal/process/functions/call/built-in/built-in-if-then-else';
import { processAssignment, processAssignmentLike, processDefineArgument } from '../internal/process/functions/call/built-in/built-in-assignment';
import { processSpecialBinOp } from '../internal/process/functions/call/built-in/built-in-special-bin-op';
import { processPipe } from '../internal/process/functions/call/built-in/built-in-pipe';
import { processForLoop } from '../internal/process/functions/call/built-in/built-in-for-loop';
import { processRepeatLoop } from '../internal/process/functions/call/built-in/built-in-repeat-loop';
import { processWhileLoop } from '../internal/process/functions/call/built-in/built-in-while-loop';
import { type BrandedIdentifier, Identifier, type IdentifierDefinition, type IdentifierReference, ReferenceType } from './identifier';
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
import type { DataflowGraph } from '../graph/graph';
import { processLibrary, processPrefer  } from '../internal/process/functions/call/built-in/built-in-library';
import { processSourceCall } from '../internal/process/functions/call/built-in/built-in-source';
import { processApply } from '../internal/process/functions/call/built-in/built-in-apply';
import type { LinkTo } from '../../queries/catalog/call-context-query/call-context-query-format';
import { processList } from '../internal/process/functions/call/built-in/built-in-list';
import { processVector } from '../internal/process/functions/call/built-in/built-in-vector';
import { processRm } from '../internal/process/functions/call/built-in/built-in-rm';
import { processEvalCall } from '../internal/process/functions/call/built-in/built-in-eval';
import { VertexType } from '../graph/vertex';
import { handleUnknownSideEffect } from '../graph/unknown-side-effect';
import { type AmbientScope, type AmbientStateAccess, AmbientStateAccessType, applyAmbientStateAccess, processAmbientScope } from '../internal/process/functions/call/built-in/built-in-ambient-state';
import type { REnvironmentInformation } from './environment';
import type { Value } from '../eval/values/r-value';
import type { ResolveInfo } from '../eval/resolve/alias-tracking';
import { resolveAsElement, resolveAsList, resolveAsSeq, resolveAsVector } from '../eval/resolve/resolve';
import { resolveAsStringFn } from '../eval/resolve/resolve-strings';
import { resolveAsComparison, resolveAsGroup, resolveAsLogical } from '../eval/resolve/resolve-operators';
import { resolveAsGet } from '../eval/resolve/resolve-get';
import { resolveAsNumeric } from '../eval/resolve/resolve-numbers';
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
import { convertFnArguments } from '../internal/process/functions/call/common';
import { NodeValue } from '../eval/resolve/node-value';
import { Resolve } from './resolve-helper';
import { linkFieldReads } from '../internal/linker';
import { BuiltInProcName } from './built-in-proc-name';
import { processPurrrFormula } from '../internal/process/functions/call/built-in/built-in-purrr-formula';
import { processNewEnv } from '../internal/process/functions/call/built-in/built-in-new-env';
import { processClassGenerator } from '../internal/process/functions/call/built-in/built-in-class-generator';
import { processClassRelation } from '../internal/process/functions/call/built-in/built-in-class-relation';
import { processS4Use } from '../internal/process/functions/call/built-in/built-in-s-four';
import { processStackEnv } from '../internal/process/functions/call/built-in/built-in-stack-env';
import { processEnvContents, processListToEnv } from '../internal/process/functions/call/built-in/built-in-env-contents';
import { processAttach, processDetach } from '../internal/process/functions/call/built-in/built-in-attach';
import { processWithEnv } from '../internal/process/functions/call/built-in/built-in-with';
import { processNamespaceAccess } from '../internal/process/functions/call/built-in/built-in-namespace-access';
import { processLoadCall } from '../internal/process/functions/call/built-in/built-in-load';
import { processStringTemplate } from '../internal/process/functions/call/built-in/built-in-string-template';
import { ArgProp, type BuiltInFnInfo, FnSig, type SigLayout, SemanticCallTag } from './built-in-props';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { AttachedBasePackageSet } from '../../util/r-base-packages';
import { REnvironment } from './environment';

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
	type:           ReferenceType.BuiltInFunction
	definedAt:      BuiltIn
	processor:      BuiltInIdentifierProcessor
	config?:        ConfigOfBuiltInMappingName<keyof typeof BuiltInProcessorMapper> & BuiltInFnInfo & { libFn?: boolean }
	/** folds a call to this function to a constant, see {@link BuiltInEvalHandlerMapper} */
	evalHandler?:   BuiltInEvalHandler
	/** the processor's name, for a call made on our behalf (`do.call(new.env, list())`) that does not run it */
	processorName?: BuiltInProcName
}

export interface BuiltInIdentifierConstant<T = unknown> extends IdentifierReference {
	type:      ReferenceType.BuiltInConstant
	definedAt: BuiltIn
	value:     T
}

/** The global state a call reads or writes, applied for every processor (see {@link PlacesAmbientItself}). */
export interface AmbientConfig {
	/** how the call reads or writes global state like the graphics parameters, the options, or files, see {@link AmbientStateAccess} */
	readonly ambient?: AmbientStateAccess | readonly AmbientStateAccess[]
}

export interface DefaultBuiltInProcessorConfiguration extends BuiltInFnInfo, AmbientConfig {
	readonly cfg?:                   ExitPointType,
	/** The condition classes a call signals when every argument it is handed is a constant, like `simpleError`, `error`, and `condition` for `stop("x")`. */
	readonly signals?:               readonly string[],
	/** see {@link ProcessKnownFunctionCallInput#alternativeArgsFrom} */
	readonly alternativeArgsFrom?:   number,
	readonly readAllArguments?:      boolean,
	/** Propagate the `out` references produced by the arguments instead of dropping them. Set this for functions that are transparent about their arguments, like `(`. */
	readonly keepArgumentOut?:       boolean,
	readonly hasUnknownSideEffects?: boolean | LinkTo<RegExp | string>,
	/** without arguments, the result is the frame the call runs in, like `environment()`, so within a function it reads every binding of the frame */
	readonly readsFrame?:            boolean,
	/** the call reads the dots of the function it is called in, like `...elt(2)` */
	readonly readsDots?:             boolean,
	/** the call changes that state for a scope only, see {@link AmbientScope} */
	readonly scope?:                 AmbientScope,
	/** record mapping the actual function name called to the arguments that should be treated as function calls */
	readonly treatAsFnCall?:         Record<string, readonly string[]>,
	/** Mark the given arguments as {@link EdgeType.NonStandardEvaluation|non-standard-evaluated}, like `quote`. */
	readonly markArgsAsNSE?:         NseArguments | readonly number[],
	/** Mark the given arguments as evaluated in a data mask, like `subset`: their symbols may name columns of the data instead of variables, while everything else in them is evaluated in the caller's frame as usual. */
	readonly markArgsAsMasked?:      NseArguments | readonly number[],
	/** The formals whose arguments name variables the call reads by their string value, like `save("x", list = v)`: a string literal anywhere, any other value except in `...`, where a symbol is the variable itself. */
	readonly namesIn?:               readonly string[],
	/** Name that should be used for the origin (useful when needing to differentiate between functions like 'return' that use the default builtin processor) */
	readonly useAsProcessor?:        BuiltInProcName
}
/** the {@link ResolveInfo} a handler continues to resolve with, plus the node it is asked to fold */
export interface BuiltInEvalHandlerArgs extends ResolveInfo {
	resolve: VariableResolve,
	node:    RNodeWithParent
}
export type BuiltInEvalHandler = (args: BuiltInEvalHandlerArgs) => Value;

/** The position of the argument filling the first parameter: by name if one names it, else the first in order. */
function firstParameterArgument<OtherInfo>(args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], layout: SigLayout | undefined): number {
	return layout === undefined ? 0 : FunctionSemantics.call.signature.slots(layout,
		args.map(a => RArgument.isEmpty(a) || a.name === undefined ? undefined : Identifier.getName(a.name.content))).indexOf(0);
}

/** The symbols handed to an {@link ArgProp.Atomic} argument directly: only data works there, so `id` in `id > 2` names a variable and not a function `id` that happens to be in scope, even though `>` may dispatch on the operand's class. */
function dataArgumentSymbols<OtherInfo>(
	args: readonly (RNodeWithParent | PotentiallyEmptyRArgument<OtherInfo & ParentInformation>)[],
	sig: FnSig | undefined
): ReadonlySet<NodeId> | undefined {
	const layout = sig === undefined ? undefined : FunctionSemantics.call.signature.layout(sig);
	if(layout === undefined || (layout.any & ArgProp.Atomic) === 0) {
		return undefined;
	}
	let symbols: Set<NodeId> | undefined;
	for(let i = 0; i < args.length; i++) {
		const arg = args[i];
		const prop = FunctionSemantics.call.signature.propAt(layout, i);
		if(RArgument.isEmpty(arg) || (prop & ArgProp.Atomic) === 0 || (prop & (ArgProp.Callee | ArgProp.Nse)) !== 0) {
			continue;
		}
		const value: RNodeWithParent | undefined = RArgument.valueOf(arg);
		if(RSymbol.is(value)) {
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
	{ useAsProcessor = BuiltInProcName.Default, readAllArguments, cfg, alternativeArgsFrom, hasUnknownSideEffects, ambient, scope, treatAsFnCall, markArgsAsNSE: nse, markArgsAsMasked: masked, keepArgumentOut, sig, readsFrame, readsDots }: DefaultBuiltInProcessorConfiguration
): DataflowInformation {
	if(scope !== undefined) {
		return processAmbientScope(name, args, rootId, data, scope);
	}
	/* a signature states per argument what the individual options state for all of them at once */
	const layout = sig !== undefined ? FunctionSemantics.call.signature.layout(sig) : undefined;
	if(layout !== undefined) {
		nse ??= (layout.any & ArgProp.Nse) !== 0 ? FunctionSemantics.call.signature.posWith(layout, args.length, ArgProp.Nse) : undefined;
	}
	const first = firstParameterArgument(args, layout);
	const nsePositions = nse === undefined ? undefined : new Set(nseArgumentPositions(nse, args.length, first));
	let lastEnv = data.environment;
	const { information: processed, processedArguments } = processKnownFunctionCall({
		name, args, rootId, data, sig, alternativeArgsFrom,
		keepArgumentGraphs: nse !== undefined || masked !== undefined,
		origin:             useAsProcessor,
		nonFunction:        dataArgumentSymbols(args, sig),
		/* an unevaluated argument must not read the current frame, so it is analyzed in a clean env like `quote` */
		patchData:          nsePositions === undefined ? undefined : (d, index) => {
			if(nsePositions.has(index)) {
				lastEnv = d.environment;
				return { ...d, environment: REnvironment.cleanOf(d.environment) };
			}
			return { ...d, environment: lastEnv };
		}
	});
	let res = processed;
	if(nsePositions !== undefined) {
		dropQuotedReferences(res, processedArguments, nsePositions, lastEnv);
	}
	markArgumentsAsNonStandardEvaluation(res.graph, rootId, processedArguments, nse, { first });
	markArgumentsAsNonStandardEvaluation(res.graph, rootId, processedArguments, masked, { kind: NseKind.DataMasked, first });
	if(keepArgumentOut) {
		res.out = [...res.out, ...processedArguments.flatMap(arg => arg?.out ?? [])];
	}
	const alias = layout !== undefined && layout.alias >= 0 ? processedArguments[layout.alias === layout.rest ? processedArguments.length - 1 : layout.alias] : undefined;
	if(alias !== undefined) {
		res.graph.addEdge(rootId, alias.entryPoint, EdgeType.Returns);
	}
	/* the call hands back the alternative it picks */
	for(const alternative of alternativeArgsFrom === undefined ? [] : processedArguments.slice(alternativeArgsFrom)) {
		if(alternative !== undefined) {
			res.graph.addEdge(rootId, alternative.entryPoint, EdgeType.Returns);
		}
	}
	if(readAllArguments) {
		readArguments(res.graph, rootId, processedArguments);
	} else if(layout !== undefined && (layout.any & (ArgProp.Value | ArgProp.Shape)) !== 0) {
		const valuePositions = FunctionSemantics.call.signature.posWith(layout, processedArguments.length, ArgProp.Value | ArgProp.Shape);
		readArguments(res.graph, rootId, valuePositions.map(i => processedArguments[i]));
	}
	/* a function's frame handed out outlives the call, the global one stays reachable through the names anyway */
	if(readsFrame && args.length === 0 && data.environment.level > 0) {
		/* the parameters it holds are what {@link BuiltInFnInfo#frame} states, as reading one must not force it */
		for(const definitions of data.environment.current.memory.values()) {
			for(const definition of definitions) {
				if(!NodeId.isBuiltIn(definition.nodeId) && definition.type !== ReferenceType.Parameter) {
					res.graph.addEdge(rootId, definition.nodeId, EdgeType.Reads);
				}
			}
		}
	}
	if(readsDots) {
		res.in = [...res.in, { nodeId: rootId, name: Identifier.dotdotdot(), type: ReferenceType.Variable, cds: data.cds }];
	}
	/* before the unknown side effect, which forgets the values of the variables the ambient state is named by */
	if(ambient !== undefined) {
		res = applyAmbientStateAccess(res, args, rootId, data, ambient);
	}
	if(hasUnknownSideEffects) {
		handleUnknownSideEffect(res.graph, res.environment, rootId, hasUnknownSideEffects === true ? undefined : hasUnknownSideEffects);
	}

	const fnCallNames = treatAsFnCall?.[Identifier.getName(name.content)] ?? [];
	for(const arg of args) {
		const rhs = arg !== EmptyArgument && fnCallNames.includes(arg.name?.content as string) ? arg.value : undefined;
		if(RString.is(rhs) || RSymbol.is(rhs)) {
			res.graph.updateToFunctionCall({
				tag:         VertexType.FunctionCall,
				id:          rhs.info.id,
				name:        RString.is(rhs) ? rhs.content.str : rhs.content,
				args:        [],
				environment: data.environment,
				onlyBuiltin: false,
				cds:         data.cds,
				origin:      [useAsProcessor]
			});
		}
	}

	if(cfg !== undefined) {
		/* the call jumps, so it never falls through to whatever follows it */
		const exitPoints = res.exitPoints.filter(e => e.type !== ExitPointType.Default || e.nodeId !== rootId);
		(res as { exitPoints: readonly ExitPoint[] }).exitPoints = [...exitPoints, { type: cfg, nodeId: rootId, cds: data.cds }];
	}

	return res;
}

function readArguments(graph: DataflowGraph, rootId: NodeId, args: readonly (DataflowInformation | undefined)[]): void {
	for(const arg of args) {
		if(arg) {
			graph.addEdge(rootId, arg.entryPoint, EdgeType.Reads);
		}
	}
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
	{ useAsProcessor = BuiltInProcName.Default, markArgsAsNSE: nse, markArgsAsMasked: masked, sig, namesIn }: Pick<DefaultBuiltInProcessorConfiguration, 'useAsProcessor' | 'markArgsAsNSE' | 'markArgsAsMasked' | 'sig' | 'ambient' | 'namesIn'>
): DataflowInformation {
	const { information, processedArguments } = processKnownFunctionCall({
		name, args, rootId, data, sig, origin: useAsProcessor, nonFunction: dataArgumentSymbols(args, sig), keepArgumentGraphs: nse !== undefined || masked !== undefined });
	readArguments(information.graph, rootId, processedArguments);
	const first = firstParameterArgument(args, sig === undefined ? undefined : FunctionSemantics.call.signature.layout(sig));
	markArgumentsAsNonStandardEvaluation(information.graph, rootId, processedArguments, nse, { first });
	markArgumentsAsNonStandardEvaluation(information.graph, rootId, processedArguments, masked, { kind: NseKind.DataMasked, first });
	if(namesIn !== undefined && sig !== undefined) {
		readNamedVariables(information, args, rootId, data, sig, namesIn);
	}
	return information;
}

/** Links the call to the variables its {@link DefaultBuiltInProcessorConfiguration#namesIn} arguments name, an unknown name being an unknown side effect. */
function readNamedVariables<OtherInfo>(information: DataflowInformation, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, sig: FnSig, namesIn: readonly string[]): void {
	const bound = FunctionSemantics.call.match.toSpec(convertFnArguments(args), Object.fromEntries(sig.map(([n]) => [n, n])));
	for(const formal of namesIn) {
		for(const id of bound.get(formal) ?? []) {
			const value = RArgument.getValue<OtherInfo & ParentInformation>(args, id);
			const names = RString.is(value) ? [value.content.str] : formal === '...' || value === undefined ? [] : NodeValue.stringsOf(value.info.id, data);
			if(names === undefined) {
				handleUnknownSideEffect(information.graph, information.environment, rootId);
			}
			for(const name of names ?? []) {
				linkFieldReads(information.graph, rootId, Resolve.byName(name, data.environment), false);
			}
		}
	}
}

/** The processors that apply the configured {@link BuiltInFnInfo#ambient} access themselves, where it belongs among their steps; the others have it applied after them. */
const PlacesAmbientItself: ReadonlySet<BuiltInProcName> = new Set([BuiltInProcName.Default, BuiltInProcName.Source]);

/** A call that reads or writes the files its arguments name accesses the {@link AmbientStateName.files|files on disk} as well. */
function withFileAccess<Config>(config: Config): Config {
	const { tags, ambient, sig } = (config ?? {}) as { tags?: readonly SemanticCallTag[], ambient?: AmbientStateAccess | readonly AmbientStateAccess[], sig?: FnSig };
	if(!tags?.includes(SemanticCallTag.File)) {
		return config;
	}
	const writes = tags.includes(SemanticCallTag.Writes);
	const split = writes && tags.includes(SemanticCallTag.Reads) && sig !== undefined && FnSig.resources(sig, true) !== sig;
	/* reading first, so the files read are the ones written before, not the call's own */
	const types = [...split || !writes && tags.includes(SemanticCallTag.Reads) ? [AmbientStateAccessType.ReadFiles] : [], ...writes ? [AmbientStateAccessType.WriteFiles] : []];
	const stated = [ambient ?? []].flat();
	if(types.length === 0 || stated.some(a => types.includes(a.type) || a.type === AmbientStateAccessType.CloseDevice)) {
		return config;
	}
	const numbered = stated.some(a => a.type === AmbientStateAccessType.OpenDevice);
	const glob = tags.includes(SemanticCallTag.Glob);
	return { ...config, ambient: [...stated, ...types.map(type => ({
		type, numbered, sig: glob || sig === undefined ? undefined : split ? FnSig.resources(sig, type === AmbientStateAccessType.WriteFiles) : sig
	}))] };
}

/** A call starting a process hands it every environment variable, a call loading a package looks for it in the library paths. */
function withImplicitReads<Config>(config: Config): Config {
	const { tags, ambient } = (config ?? {}) as { tags?: readonly SemanticCallTag[], ambient?: AmbientStateAccess | readonly AmbientStateAccess[] };
	const reads = [
		...tags?.includes(SemanticCallTag.Process) ? [AmbientStateName.allOf(KeyedState.Env)] : [],
		...tags?.includes(SemanticCallTag.LoadsPackage) ? [AmbientStateName.libPaths] : []
	];
	return reads.length === 0 ? config : { ...config, ambient: [...[ambient ?? []].flat(), ...reads.map(state => ({ type: AmbientStateAccessType.ReadState, state }) as const)] };
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
	[BuiltInProcName.EnvContents]:        processEnvContents,
	[BuiltInProcName.ListToEnv]:          processListToEnv,
	[BuiltInProcName.Attach]:             processAttach,
	[BuiltInProcName.Detach]:             processDetach,
	[BuiltInProcName.Prefer]:             processPrefer,
	[BuiltInProcName.NewEnv]:             processNewEnv,
	[BuiltInProcName.ClassGenerator]:     processClassGenerator,
	[BuiltInProcName.ClassRelation]:      processClassRelation,
	[BuiltInProcName.S4Use]:              processS4Use,
	[BuiltInProcName.StackEnv]:           processStackEnv,
	[BuiltInProcName.With]:               processWithEnv,
	[BuiltInProcName.Vector]:             processVector,
	[BuiltInProcName.WhileLoop]:          processWhileLoop,
} as const satisfies Record<`builtin:${string}`, BuiltInIdentifierProcessorWithConfig<never>>;

/** The value-solver function behind every {@link BuiltInEvalName}, the counterpart of the {@link BuiltInProcessorMapper}. */
export const BuiltInEvalHandlerMapper = {
	[BuiltInEvalName.Vector]:     resolveAsVector,
	[BuiltInEvalName.Seq]:        resolveAsSeq,
	[BuiltInEvalName.Numeric]:    resolveAsNumeric,
	[BuiltInEvalName.Comparison]: resolveAsComparison,
	[BuiltInEvalName.Logical]:    resolveAsLogical,
	[BuiltInEvalName.StringFn]:   resolveAsStringFn,
	[BuiltInEvalName.Group]:      resolveAsGroup,
	[BuiltInEvalName.Get]:        resolveAsGet,
	[BuiltInEvalName.Element]:    resolveAsElement,
	[BuiltInEvalName.List]:       resolveAsList
} as const satisfies Record<BuiltInEvalName, BuiltInEvalHandler>;

export type ConfigOfBuiltInMappingName<N extends keyof typeof BuiltInProcessorMapper> = Parameters<typeof BuiltInProcessorMapper[N]>[4];

export type BuiltInMemory = Map<BrandedIdentifier, IdentifierDefinition[]>;

/** Whether a definition registered under `namespace` belongs in the always-on built-in environment: only base and the attached base packages are on R's search path at startup without a `library()` call. */
function attachedByDefault(namespace: string | undefined): boolean {
	return namespace === undefined || AttachedBasePackageSet.has(namespace);
}

export class BuiltIns {
	/** Register a built-in constant (like `NULL` or `TRUE`) to the given {@link BuiltIns} */
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

	/** Register a built-in function (like `print` or `c`) to the given {@link BuiltIns} */
	registerBuiltInFunctions<BuiltInProcessor extends keyof typeof BuiltInProcessorMapper>({ names, processor, config, assumePrimitive, evalHandler }: BuiltInFunctionDefinition<BuiltInProcessor>): void {
		guard(processor !== undefined, () => `Processor for ${JSON.stringify(names)} is undefined, maybe you have an import loop? You may run 'npm run detect-circular-deps' - although by far not all are bad`);
		const mappedProcessor = BuiltInProcessorMapper[processor];
		guard(mappedProcessor !== undefined, () => `Processor for ${processor} is undefined! Please pass a valid builtin name ${JSON.stringify(Object.keys(BuiltInProcessorMapper))}!`);
		const mappedEval = evalHandler === undefined ? undefined : BuiltInEvalHandlerMapper[evalHandler];
		guard(evalHandler === undefined || mappedEval !== undefined, () => `Eval handler ${evalHandler} is unknown! Please pass a valid one of ${JSON.stringify(Object.keys(BuiltInEvalHandlerMapper))}!`);
		config = withImplicitReads(withFileAccess(config));
		const ambient = PlacesAmbientItself.has(processor) ? undefined : (config as AmbientConfig | undefined)?.ambient;
		const process: BuiltInIdentifierProcessor = ambient === undefined
			? (name, args, rootId, data) => mappedProcessor(name, args, rootId, data, config as never)
			: (name, args, rootId, data) => applyAmbientStateAccess(mappedProcessor(name, args, rootId, data, config as never), args, rootId, data, ambient);
		for(const name of names) {
			const n = Identifier.getName(name);
			const id = NodeId.toBuiltIn(n);
			const d: IdentifierDefinition[] = [{
				type:          ReferenceType.BuiltInFunction,
				definedAt:     id,
				cds:           undefined,
				processor:     process,
				config,
				evalHandler:   mappedEval,
				processorName: processor,
				name,
				nodeId:        id
			}];
			this.set(n, d, assumePrimitive, Identifier.getNamespace(name));
		}
	}

	/** Registers all combinations of replacements */
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
					/* `f(x) <- v` rebinds `x`, the plain call `` `f<-`(x, v) `` above only hands back a modified copy */
					config:    {
						...config,
						assignmentOperator: suffix
					},
					name:   assignment,
					cds:    undefined,
					nodeId: id
				}];
				this.set(effectiveName, d, assumePrimitive, Identifier.getNamespace(assignment));
			}
		}
	}

	/** Register a single {@link BuiltInDefinition} to the given memories in {@link BuiltIns} */
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

	/** The built-in {@link REnvironmentInformation|environment} is the root of all environments. */
	builtInMemory:      BuiltInMemory = new Map<BrandedIdentifier, IdentifierDefinition[]>();
	/** The twin of the {@link builtInMemory} but with less built ins defined for cases in which we want some commonly overwritten variables to remain open. */
	emptyBuiltInMemory: BuiltInMemory = new Map<BrandedIdentifier, IdentifierDefinition[]>();

	/** What the configuration states about the exports of packages R does not attach on startup, by package and then bare name; not in {@link builtInMemory}, they enter an analysis only once attached, see {@link BuiltIns.forPackage}. */
	packageMemory: Map<string, BuiltInMemory> = new Map<string, BuiltInMemory>();

	/** Registers `definition` under `identifier`. A `namespace` R does not attach by default lands in {@link packageMemory} instead of the always-on environment. */
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

	/** A copy whose maps can be changed without changing these. */
	copy(): BuiltIns {
		const copy = new BuiltIns();
		copy.builtInMemory = new Map(this.builtInMemory);
		copy.emptyBuiltInMemory = new Map(this.emptyBuiltInMemory);
		copy.packageMemory = new Map(this.packageMemory.entries().map(([pkg, memory]) => [pkg, new Map(memory)]));
		return copy;
	}

	/** What flowR states about `pkg`'s exports, `undefined` when it states nothing (attaching brings these into scope). */
	forPackage(pkg: string): BuiltInMemory | undefined {
		return this.packageMemory.get(pkg);
	}
}
