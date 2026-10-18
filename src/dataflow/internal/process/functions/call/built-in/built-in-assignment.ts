import type { DataflowProcessorInformation } from '../../../../../processor';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import type { DataflowInformation } from '../../../../../info';
import { markArgumentsAsNonStandardEvaluation, NseArguments, NseKind, processKnownFunctionCall } from '../known-call-handling';
import { Unquote } from '../nse';
import { DataMaskingFunctionNames } from '../../../../../environments/data-masking-functions';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { log, LogLevel } from '../../../../../../util/log';
import { toUnnamedArgument, wrapArgumentsUnnamed } from '../argument/make-argument';
import type {
	ParentInformation,
	RNodeWithParent
} from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type Location, type RAstNodeBase, RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { RAccess } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import type { PotentiallyEmptyRArgument, EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { hasEnvState, Identifier, type IdentifierReference, type InGraphIdentifierDefinition, type InGraphReferenceType, ReferenceType } from '../../../../../environments/identifier';
import { AmbientStateName, ambientWritesBetween, ambientWritesOfAssignment, markForcing } from './built-in-ambient-state';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { RUnnamedArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { DataflowGraphVertexFunctionDefinition } from '../../../../../graph/vertex';
import { DfgVertex, VertexType } from '../../../../../graph/vertex';
import { EdgeType } from '../../../../../graph/edge';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import type { DataflowGraph } from '../../../../../graph/graph';
import { EnvirPositionFormals, findReturnsEnvState, suppliesArg, resolveConstantString, resolveEnvirArgOrAmbiguous, resolveFirstEnvirArg, resolveSymbolToEnvir, rebindHolders, routeWrittenToEnvir } from './built-in-envir-utils';
import { markAsOnlyBuiltIn } from '../named-call-handling';
import { BuiltInProcessorMapper } from '../../../../../environments/built-in';
import { ArgProp, type FnSig } from '../../../../../environments/built-in-props';
import { matchArgumentsToParameters } from '../../../../../../util/arg-matching';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { getAliases } from '../../../../../eval/resolve/alias-tracking';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { createFreshEnvState } from './built-in-new-env';
import { holdsFunction, resolveListToEnvState } from './built-in-list';
import { resolveClassMethodsToEnvState, resolveConstructorInstanceEnvState } from './built-in-class-generator';
import { stackEnvStateFromSource } from './built-in-stack-env';
import { Resolve } from '../../../../../environments/resolve-helper';
import { Dataflow } from '../../../../../graph/df-helper';
import { REnvironment } from '../../../../../environments/environment';

function toReplacementSymbol<OtherInfo>(target: RNodeWithParent<OtherInfo & ParentInformation> & RAstNodeBase<OtherInfo> & Location, prefix: Identifier, superAssignment: boolean): RSymbol<OtherInfo & ParentInformation> {
	return {
		type:     RType.Symbol,
		info:     target.info,
		/* they are all mapped to `<-` in R, but we mark super as well */
		content:  Identifier.mapName(prefix, n => n + (superAssignment ? '<<-' : '<-')),
		lexeme:   target.lexeme,
		location: target.location
	};
}

function getEffectiveOrder<T>(config: {
	swapSourceAndTarget?: boolean
}, args: [T, T]): [T, T] {
	return config.swapSourceAndTarget ? [args[1], args[0]] : args;
}

function originOf(config: AssignmentConfiguration): BuiltInProcName {
	return config.superAssignment ? BuiltInProcName.SuperAssignment : BuiltInProcName.Assignment;
}

export interface AssignmentConfiguration {
	readonly superAssignment?:     boolean
	readonly swapSourceAndTarget?: boolean
	/** Make maybe if assigned to symbol */
	readonly makeMaybe?:           boolean
	readonly quoteSource?:         boolean
	readonly canBeReplacement?:    boolean
	/** the call is a replacement function, which keeps the kind of its target whatever value it is given */
	readonly replacement?:         boolean
	/** is the target a variable pointing at the actual name? */
	readonly targetVariable?:      boolean
	/** appended to a target named by a string (`setReplaceMethod("f", ...)` binds `f<-`) */
	readonly targetSuffix?:        string
	/** does the call use the old value of its target (e.g. `setNames(x, nm)`), so that the target reads its previous definition? */
	readonly readTarget?:          boolean
	readonly mayHaveMoreArgs?:     boolean
	readonly modesForFn?:          DataflowGraphVertexFunctionDefinition['mode']
	/**
	 * Name of the arg selecting the target env (e.g. `'envir'` for `assign`); if it resolves to a tracked
	 * {@link InGraphIdentifierDefinition#envState}, the assignment is routed there instead of the current scope.
	 */
	readonly environmentArg?:      string
	/** the formals of the call, so a positional {@link AssignmentConfiguration#environmentArg} is found at the slot it really has */
	readonly sig?:                 FnSig
	/** does the call run what it binds, as `makeActiveBinding` runs its function on every read of the name? */
	readonly callsSource?:         boolean
	/** runs once the value is processed, before the target is defined; the target is defined in the environment it returns */
	readonly beforeDefine?:        (information: { readonly environment: REnvironmentInformation, readonly graph: DataflowGraph }) => REnvironmentInformation
}

export interface ExtendedAssignmentConfiguration extends AssignmentConfiguration {
	readonly source: { idx?: number, name: string };
	readonly target: { idx?: number, name: string };
}

const EnvironmentProducers: readonly BuiltInProcName[] = [BuiltInProcName.NewEnv, BuiltInProcName.StackEnv, BuiltInProcName.ListToEnv];

function yieldsEnvironment<OtherInfo>(
	node:  RNode<OtherInfo & ParentInformation>,
	graph: DataflowGraph,
	data:  DataflowProcessorInformation<OtherInfo & ParentInformation>
): boolean {
	if(!RFunctionCall.isNamed(node)) {
		return false;
	}
	const vertex = graph.getVertex(node.info.id);
	return EnvironmentProducers.some(origin => DfgVertex.hasOrigin(vertex, origin))
		|| (RFunctionCall.isNamed(node, 'environment')
			&& Resolve.isBuiltIn(node.functionName.content, data.environment, ReferenceType.Function));
}

function tryReplacement<OtherInfo>(
	rootId: NodeId,
	functionName: RSymbol<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	superAssignment: boolean,
	args: readonly (RNode<OtherInfo & ParentInformation> | typeof EmptyArgument | undefined)[],
	beforeDefine?: AssignmentConfiguration['beforeDefine']
): DataflowInformation {
	const resolved = Resolve.byNameAndType(functionName.content, data.environment, ReferenceType.Function) ?? [];
	const builtIn = resolved.length === 1 && resolved[0].type === ReferenceType.BuiltInFunction ? resolved[0] : undefined;

	/* every replacement function rebinds its target, no matter whether we ship a built-in for it or the user wrote
	 * it; a user-defined one is only ever bound under its `<-` name, the `<<-` form stays in the configuration */
	const name = builtIn ? functionName.content : Identifier.mapName(functionName.content, n => superAssignment ? n.slice(0, -'<<-'.length) + '<-' : n);

	const replacementConfig = builtIn ? builtIn.config : {
		readIndices:        true,
		makeMaybe:          true,
		assignmentOperator: superAssignment ? '<<-' : '<-'
	};
	const info = BuiltInProcessorMapper[BuiltInProcName.Replacement](
		{ ...functionName, content: name },
		wrapArgumentsUnnamed(args, data.completeAst.idMap),
		functionName.info.id,
		data,
		{ ...replacementConfig, assignRootId: rootId, beforeDefine }
	);

	if(builtIn) {
		markAsOnlyBuiltIn(info.graph, functionName.info.id);
		return info;
	}
	/* the replacement marks its callee as an S3 prefix, which only ever resolves to `name.<class>`; a user-defined
	 * replacement is bound under the plain name, so we read that first to link the call to its definition */
	return {
		...info,
		in: [{ nodeId: functionName.info.id, name, cds: data.cds, type: ReferenceType.Function }, ...info.in]
	};
}

/** In contrast to `processAssignment`, this function allows more flexible handling of assignment-like functions. */
export function processAssignmentLike<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	/* args may come in any order; matched via config.source/config.target, then normalized to processAssignment's convention below */
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: ExtendedAssignmentConfiguration
): DataflowInformation {
	const argsWithNames = new Map<string, PotentiallyEmptyRArgument<OtherInfo & ParentInformation>>();
	const argsWithoutNames: PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[] = [];
	for(const arg of args) {
		const name = RArgument.isEmpty(arg) ? undefined : arg.name?.content;
		if(name === undefined) {
			argsWithoutNames.push(arg);
		} else {
			argsWithNames.set(name, arg);
		}
	}
	const source = argsWithNames.get(config.source.name) ?? (config.source.idx === undefined ? undefined : argsWithoutNames[config.source.idx]);
	const target = argsWithNames.get(config.target.name) ?? (config.target.idx === undefined ? undefined : argsWithoutNames[config.target.idx]);
	const normalizedArgs = source && target ? [target, source] : args;
	return processAssignment<OtherInfo>(name, normalizedArgs, rootId, data, { ...config, mayHaveMoreArgs: true });
}

/** Within a data-masking call `a := b` is rlang's name-value pair, not data.table's assignment. */
function isMaskedNamePair<OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>
): boolean {
	if(Identifier.getName(name.content) !== ':=') {
		return false;
	}
	for(const node of RNode.iterateParents(data.completeAst.idMap.get(rootId), data.completeAst.idMap)) {
		if(!RArgument.is(node)) {
			return RFunctionCall.isNamed(node, DataMaskingFunctionNames);
		}
	}
	return false;
}

/** Analyzes `a := b` as the named argument it is. */
function processMaskedNamePair<OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const { information, processedArguments } = processKnownFunctionCall({ name, args, rootId, data, origin: 'default', keepArgumentGraphs: true });
	const target = args[0];
	markArgumentsAsNonStandardEvaluation(information.graph, rootId, processedArguments, NseArguments.First, {
		kind:      NseKind.DataMasked,
		evaluated: FunctionSemantics.call.nse.unquoted(RArgument.valueOf(target), Unquote.Rlang)
	});
	return information;
}

/**
 * Processes an assignment `<target> <- <source>` as the function call \`&lt;-\` `(<target>, <source>)`,
 * including replacement functions (e.g., `names(x) <- ...` as \`names&lt;-\` `(x, ...)`).
 */
export function processAssignment<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	/* we expect them to be ordered in the sense that we have (source, target): `<source> <- <target>` */
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: AssignmentConfiguration
): DataflowInformation {
	const information = processAssignmentTarget(name, args, rootId, data, config);
	const source = config.callsSource ? RArgument.valueOf(args[config.swapSourceAndTarget ? 0 : 1]) : undefined;
	const vertex = source ? information.graph.getVertex(source.info.id) : undefined;
	/* the function runs when the name is read, so what it reads is resolved there and not where it is bound */
	if(DfgVertex.isFunctionDefinition(vertex)) {
		for(const written of information.out) {
			information.graph.addEdge(written.nodeId, vertex.id, EdgeType.Calls);
		}
	}
	return information;
}

function processAssignmentTarget<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: AssignmentConfiguration
): DataflowInformation {
	if(isMaskedNamePair(name, rootId, data)) {
		return processMaskedNamePair(name, args, rootId, data);
	}

	if(!config.mayHaveMoreArgs && args.length !== 2) {
		dataflowLogger.warn(`Assignment ${Identifier.toString(name.content)} has something else than 2 arguments, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	/* route into a custom environment when envir resolves to a tracked env variable */
	if(config.environmentArg) {
		const routed = tryRouteToCustomEnv(name, args, rootId, data, config);
		if(routed !== undefined) {
			return routed;
		}
	}

	const effectiveArgs = getEffectiveOrder(config, args as [PotentiallyEmptyRArgument<OtherInfo & ParentInformation>, PotentiallyEmptyRArgument<OtherInfo & ParentInformation>]);
	const target = RArgument.valueOf(effectiveArgs[0]);
	const source = RArgument.valueOf(effectiveArgs[1]);

	if(target === undefined || source === undefined) {
		dataflowLogger.warn(`Assignment ${Identifier.toString(name.content)} has an undefined target or source, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const { type, named } = target;

	/** the call (with `callArgs`) defines the plain name at `targetId` (with `targetName` set whenever the name had to be resolved first) */
	const toSymbol = (
		callArgs:    readonly (RNode<OtherInfo & ParentInformation> | PotentiallyEmptyRArgument<OtherInfo & ParentInformation>)[],
		targetId:    NodeId,
		targetName?: Identifier
	) => {
		const res = processKnownFunctionCall({
			name,
			args:         callArgs,
			rootId,
			data,
			reverseOrder: !config.swapSourceAndTarget,
			origin:       originOf(config)
		});
		return processAssignmentToSymbol<OtherInfo & ParentInformation>({
			...config,
			nameOfAssignmentFunction: name.content,
			source,
			targetId,
			targetName,
			args:                     getEffectiveOrder(config, res.processedArguments as [DataflowInformation, DataflowInformation]),
			rootId,
			data,
			information:              res.information,
		});
	};
	/** the target is a plain name, so the assignment defines it directly */
	const assignToSymbol = (targetName?: Identifier) => {
		const info = toSymbol(args, target.info.id, targetName);
		if(config.readTarget && RSymbol.is(target)) {
			/* just like a replacement function, the call works on the old value of its target */
			info.graph.addEdge(target.info.id, rootId, EdgeType.Reads);
			return { ...info, in: [...info.in, { name: target.content, type: ReferenceType.Variable, nodeId: target.info.id, cds: data.cds }] };
		}
		return info;
	};

	if(type === RType.Symbol && !config.targetVariable) {
		return assignToSymbol();
	} else if(config.targetVariable && (type === RType.Symbol || type === RType.FunctionCall)) {
		/* the target expression (`assign(x, v)` / `assign(paste0("cfg_", k), v)`) resolving to a constant name defines that name, keeping
		 * the reads that produced it; a dynamic name falls through to the unknown-target handling below */
		const resolvedName = resolveConstantString(target, data);
		if(resolvedName !== undefined) {
			return assignToSymbol(resolvedName);
		}
	} else if(config.canBeReplacement && type === RType.FunctionCall && named) {
		/* as replacement functions take precedence over the lhs fn-call (i.e., `names(x) <- ...` is independent from the definition of `names`), we do not have to process the call */
		dataflowLogger.debug(`Assignment ${Identifier.toString(name.content)} has a function call as target ==> replacement function ${target.lexeme}`);
		const replacement = toReplacementSymbol(target, target.functionName.content, config.superAssignment ?? false);
		return tryReplacement(rootId, replacement, data, config.superAssignment ?? false, [...target.arguments, source], config.beforeDefine);
	} else if(config.canBeReplacement && type === RType.Access) {
		dataflowLogger.debug(`Assignment ${Identifier.toString(name.content)} has an access-type node as target ==> replacement function ${target.lexeme}`);
		const replacement = toReplacementSymbol(target, target.operator, config.superAssignment ?? false);
		const envRouted = tryRouteDollarEnvAssign(rootId, data, config, target as RAccess<OtherInfo & ParentInformation>, source, replacement);
		if(envRouted !== undefined) {
			return envRouted;
		}
		const replaced = tryReplacement(rootId, replacement, data, config.superAssignment ?? false, [toUnnamedArgument(target.accessed, data.completeAst.idMap), ...target.access, source], config.beforeDefine);
		if(yieldsEnvironment(target.accessed, replaced.graph, data)) {
			handleUnknownSideEffect(replaced.graph, replaced.environment, rootId);
		}
		return replaced;
	} else if(type === RType.Access) {
		let rootArg: RNode<OtherInfo & ParentInformation> = target;
		while(RAccess.is(rootArg)) {
			rootArg = rootArg.accessed;
		}
		if(RSymbol.is(rootArg)) {
			return toSymbol([rootArg, source], rootArg.info.id);
		}
	} else if(type === RType.String) {
		const symbol: RSymbol<OtherInfo & ParentInformation> = {
			type:     RType.Symbol,
			info:     target.info,
			content:  RString.unquote(target.lexeme) + (config.targetSuffix ?? ''),
			lexeme:   target.lexeme,
			location: target.location,
		};
		/* treat the target argument as a symbol; keep extra args (e.g. envir=) so they get graph vertices */
		const targetIdx = config.swapSourceAndTarget ? 1 : 0;
		const mappedArgs = args.map((a, i) => i === targetIdx ? { ...(a as RUnnamedArgument<OtherInfo & ParentInformation>), value: symbol } : a);
		return toSymbol(mappedArgs, symbol.info.id);
	}

	dataflowLogger.warn(`Assignment ${Identifier.toString(name.content)} has an unknown target type ${target.type} => unknown impact`);
	const info = processKnownFunctionCall({ name, args: effectiveArgs, rootId, data, origin: originOf(config) }).information;
	handleUnknownSideEffect(info.graph, info.environment, rootId);
	return info;
}

/** Promotes the ingoing/unknown references of target (an assignment) to definitions. */
function produceWrittenNodes<OtherInfo>(rootId: NodeId, target: DataflowInformation, referenceType: InGraphReferenceType, data: DataflowProcessorInformation<OtherInfo>, makeMaybe: boolean, value: NodeId[] | undefined): (InGraphIdentifierDefinition & { name: Identifier })[] {
	return [...target.in, ...target.unknownReferences].filter(ref => !AmbientStateName.is(ref.name)).map(ref => ({
		nodeId:    ref.nodeId,
		name:      ref.name as Identifier,
		type:      referenceType,
		definedAt: rootId,
		cds:       data.cds ?? (makeMaybe ? [] : undefined),
		value
	}));
}

function checkTargetReferenceType(sourceInfo: DataflowInformation, fnModes: DataflowGraphVertexFunctionDefinition['mode'] | undefined): InGraphReferenceType {
	const vert = sourceInfo.graph.getVertex(sourceInfo.entryPoint);
	switch(vert?.tag) {
		case VertexType.FunctionDefinition:
			if(fnModes && fnModes.length > 0) {
				vert.mode ??= [];
				for(const m of fnModes) {
					if(!vert.mode.includes(m)) {
						vert.mode.push(m);
					}
				}
			}
			return ReferenceType.Function;
		case VertexType.Use:
		case VertexType.FunctionCall:
			return ReferenceType.Unknown;
		default:
			return ReferenceType.Variable;
	}
}

/**
 * The node an assignment takes its value from, following the {@link EdgeType.Returns} edges of the graph.
 * A block hands back its last expression and a grouping what it wraps, so `e <- { new.env() }` creates an
 * environment just like `e <- new.env()` does. `undefined` whenever more than one node may produce the value,
 * as a branch or a loop does, since the assignment then has no single source to speak of.
 */
function valueEntryPointOf(sourceInfo: DataflowInformation): NodeId | undefined {
	const seen = new Set<NodeId>();
	let id = sourceInfo.entryPoint;
	while(true) {
		const returns = Dataflow.targetsOf(sourceInfo.graph, id, EdgeType.Returns);
		if(returns.length === 0) {
			return id;
		} else if(returns.length > 1 || seen.has(id)) {
			return undefined;
		}
		seen.add(id);
		id = returns[0];
	}
}

/**
 * Returns `true` when the value of `sourceInfo` comes from a call to a `new.env`-family function.
 * Used by {@link processAssignmentToSymbol} to attach an initial {@link InGraphIdentifierDefinition#envState}.
 */
function isEnvCreatorSource(sourceInfo: DataflowInformation, entryPoint: NodeId | undefined): boolean {
	const vert = entryPoint === undefined ? undefined : sourceInfo.graph.getVertex(entryPoint);
	return DfgVertex.hasOrigin(vert, BuiltInProcName.NewEnv);
}

/**
 * When `e$x <- val` and `e` holds a tracked {@link InGraphIdentifierDefinition#envState}, adds field `x` into that
 * envState instead of redefining `e`; returns `undefined` when routing is not applicable.
 */
function tryRouteDollarEnvAssign<OtherInfo>(
	rootId:      NodeId,
	data:        DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config:      AssignmentConfiguration,
	target:      RAccess<OtherInfo & ParentInformation>,
	source:      RNode<OtherInfo & ParentInformation>,
	replacement: RSymbol<OtherInfo & ParentInformation>
): DataflowInformation | undefined {
	if(target.operator !== '$' || !RSymbol.is(target.accessed)) {
		return undefined;
	}
	const envirResolution = resolveSymbolToEnvir(target.accessed.content, target.accessed.info.id, data);
	if(!envirResolution) {
		return undefined;
	}
	const fieldNode = RArgument.valueOf(target.access[0]);
	if(!fieldNode) {
		return undefined;
	}
	const fieldName = (RString.is(fieldNode) ? fieldNode.content.str : fieldNode.lexeme) as Identifier;

	const normalResult = tryReplacement(rootId, replacement, data, config.superAssignment ?? false, [toUnnamedArgument(target.accessed, data.completeAst.idMap), ...target.access, source], config.beforeDefine);
	const fieldDef: InGraphIdentifierDefinition & { name: Identifier } = {
		type:      holdsFunction(source, data.environment) ? ReferenceType.Function : ReferenceType.Variable,
		name:      fieldName,
		nodeId:    source.info.id,
		definedAt: normalResult.entryPoint,
		cds:       data.cds ?? (config.makeMaybe ? [] : undefined)
	};
	const newEnvState = REnvironment.define(fieldDef, false, envirResolution.envDef.envState);
	const updatedEnvDef: InGraphIdentifierDefinition & { name: Identifier, envState: REnvironmentInformation } = {
		...envirResolution.envDef,
		nodeId:    target.accessed.info.id,
		definedAt: rootId,
		envState:  newEnvState
	};
	const strippedEnv = {
		current: normalResult.environment.current.removeAll([{ name: envirResolution.envDef.name }]),
		level:   normalResult.environment.level
	};
	normalResult.graph.addEdge(normalResult.entryPoint, target.accessed.info.id, EdgeType.Reads);
	const environment = REnvironment.define(updatedEnvDef, false, strippedEnv);
	if(updatedEnvDef.envId === undefined) {
		return { ...normalResult, environment };
	}
	return { ...normalResult, environment: rebindHolders(environment, updatedEnvDef, newEnvState, rootId) };
}

/**
 * When `config.environmentArg` (e.g. `'envir'` for `assign`) resolves to a variable with a tracked
 * {@link InGraphIdentifierDefinition#envState}, routes the written definitions there instead of the current scope; returns `undefined` if not possible.
 * An `envir=` that names a value we cannot pin down (e.g. a parameter) is not a "no envir" call: routing the
 * write into the local scope would be a guess, so the call becomes an unknown side effect instead.
 */
function tryRouteToCustomEnv<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: AssignmentConfiguration
): DataflowInformation | undefined {
	const envirRouting = resolveEnvirArgOrAmbiguous(args, data, config.sig, config.environmentArg)
		?? resolveFirstEnvirArg(args, data, config.sig, EnvirPositionFormals);
	if(envirRouting === 'ambiguous' || (!envirRouting && suppliesArg(args, config.sig, EnvirPositionFormals))) {
		const info = processKnownFunctionCall({ name, args, rootId, data, origin: originOf(config) }).information;
		handleUnknownSideEffect(info.graph, info.environment, rootId);
		return info;
	}
	if(!envirRouting) {
		if(!data.ctx.config.solver.trackEnvironments || config.environmentArg === undefined || !suppliesArg(args, config.sig, [config.environmentArg])) {
			return undefined;
		}
		/* an environment we cannot name (`sys.frame(-1)`) may be any frame, so the write stays here and is kept as well */
		const info = processAssignment(name, args, rootId, data, { ...config, environmentArg: undefined });
		handleUnknownSideEffect(info.graph, info.environment, rootId);
		return info;
	}

	/* run the normal assignment path to get the correct graph structure, the call reads the environment it writes into */
	const global = envirRouting.stack === 'global';
	const normalResult = processAssignment(name, args, rootId, data, { ...config, environmentArg: undefined, superAssignment: global || config.superAssignment });
	normalResult.graph.addEdge(rootId, envirRouting.envirNodeId, EdgeType.Reads);
	/* pass rootId as definedAt so only defs made at this call site are routed */
	return global ? normalResult : routeWrittenToEnvir(normalResult, envirRouting, rootId, data.environment, rootId);
}

export interface AssignmentToSymbolParameters<OtherInfo> extends AssignmentConfiguration {
	readonly nameOfAssignmentFunction: Identifier
	readonly source:                   RNode<OtherInfo & ParentInformation>
	readonly args:                     [DataflowInformation, DataflowInformation]
	readonly targetId:                 NodeId
	/** pass only if the assignment target differs from normal R assignments (i.e., if the symbol is to be resolved) */
	readonly targetName?:              Identifier
	readonly rootId:                   NodeId
	readonly data:                     DataflowProcessorInformation<OtherInfo>
	readonly information:              DataflowInformation
}

/**
 * Models a call like `Hmisc::getHdata(x)` that loads a dataset into the variable it is *given*: `x` is both
 * **read** (its value comes from outside) and **defined** by the call; unlike {@link markAsAssignment} we keep the read edge.
 */
export function processDefineArgument<OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: AssignmentConfiguration
): DataflowInformation {
	const res = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.DefineArgument });
	const info = res.information;
	const formals = config.sig ?? [];
	const bound = matchArgumentsToParameters(args.map(a => RArgument.isEmpty(a) ? undefined : a.name?.content), formals.map(([f]) => f));
	const defineByCall = (node: InGraphIdentifierDefinition & { name: Identifier }) => {
		info.environment = REnvironment.define(node, config.superAssignment, info.environment);
		/* defined by the call; the read edge is left intact */
		if(node.nodeId !== rootId) {
			info.graph.setDefinitionOfVertex(node, [rootId]);
			info.graph.addEdge(node.nodeId, rootId, EdgeType.DefinedBy);
		}
	};
	for(let i = 0; i < args.length; i++) {
		const arg = args[i], targetArg = res.processedArguments[i], param = bound[i];
		if(RArgument.isEmpty(arg) || targetArg === undefined || param === undefined) {
			continue;
		}
		if(param === 0 && RSymbol.is(arg.value)) {
			for(const node of produceWrittenNodes(rootId, targetArg, ReferenceType.Variable, data, false, undefined)) {
				defineByCall(node);
			}
		} else if(param === 0 || (formals[param][1] & ArgProp.Value) !== 0) {
			/* a name given as a string literal is defined at it, any other at the call */
			const at = RString.is(arg.value) ? arg.value.info.id : rootId;
			for(const named of NodeValue.knownStringsOf(arg.value, data)) {
				const node = { nodeId: at, name: named, type: ReferenceType.Variable, definedAt: rootId, cds: data.cds } as const;
				info.out = [...info.out, node];
				defineByCall(node);
			}
		}
	}
	return info;
}

/** Define `nodeToDefine` in the environment and wire the `DefinedBy` edges from it to its sources and the assignment root (dropping the child-added read edges). */
export function markAsAssignment<OtherInfo>(
	information: {
		environment: REnvironmentInformation,
		graph:       DataflowGraph
	},
	nodeToDefine: InGraphIdentifierDefinition & { name: Identifier },
	sourceIds: readonly NodeId[],
	rootIdOfAssignment: NodeId,
	data: DataflowProcessorInformation<OtherInfo>,
	assignmentConfig?: AssignmentConfiguration
) {
	information.environment = REnvironment.define(nodeToDefine, assignmentConfig?.superAssignment, information.environment);
	information.environment = ambientWritesOfAssignment(information.environment, nodeToDefine.name, rootIdOfAssignment, data.cds ? [...data.cds] : undefined, assignmentConfig?.superAssignment === true || data.environment.level === 0);
	information.graph.setDefinitionOfVertex(nodeToDefine, sourceIds);
	const nid = nodeToDefine.nodeId;
	if(!assignmentConfig?.quoteSource) {
		for(const sourceId of sourceIds) {
			information.graph.addEdge(nid, sourceId, EdgeType.DefinedBy);
		}
	}
	information.graph.addEdge(nid, rootIdOfAssignment, EdgeType.DefinedBy);
	// kinda dirty, but we have to remove existing read edges for the symbol, added by the child
	for(const [id] of information.graph.edgesFrom(nid)) {
		information.graph.removeEdgeType(nid, id, EdgeType.Reads);
	}
}

/** Helper for when the _target_ of an assignment is known to be a (single) symbol (i.e. `x <- ...`, not `names(x) <- ...`). */
function processAssignmentToSymbol<OtherInfo>(config: AssignmentToSymbolParameters<OtherInfo>): DataflowInformation {
	const { nameOfAssignmentFunction, source, args: [targetArg, sourceArg], targetId, targetName, rootId, data, information, makeMaybe, quoteSource } = config;
	const kindOfValue = checkTargetReferenceType(sourceArg, config.modesForFn);
	const referenceType = config.replacement && kindOfValue === ReferenceType.Variable ? ReferenceType.Unknown : kindOfValue;
	const useSourceIds = [sourceArg.graph.hasVertex(source.info.id) ? source.info.id : sourceArg.entryPoint];

	const aliases = getAliases(useSourceIds, information.graph, information.environment);
	const written = targetName ? [{
		nodeId:    targetId,
		name:      targetName,
		type:      referenceType,
		definedAt: rootId,
		cds:       data.cds ?? (makeMaybe ? [] : undefined),
		value:     aliases
	} satisfies InGraphIdentifierDefinition & { name: Identifier }]
		: produceWrittenNodes(rootId, targetArg, referenceType, data, makeMaybe ?? false, aliases);

	let copied: (InGraphIdentifierDefinition & { envState: REnvironmentInformation }) | undefined;
	let envState: REnvironmentInformation | undefined;
	let envId: NodeId | undefined;
	let returnsEnvState: REnvironmentInformation | undefined;
	if(data.ctx.config.solver.trackEnvironments) {
		const valueEntry = valueEntryPointOf(sourceArg);
		const stackEnv = stackEnvStateFromSource(sourceArg, data, valueEntry);
		if(isEnvCreatorSource(sourceArg, valueEntry)) {
			envState = createFreshEnvState(data, sourceArg);
		} else if(stackEnv !== undefined) {
			// globalenv()/baseenv()/emptyenv(): assigned variable points into that search-path stack env
			envState = stackEnv;
		} else if(RSymbol.is(source)) {
			const defs = Resolve.byNameAndType(source.content, data.environment, ReferenceType.Variable);
			copied = defs?.find(hasEnvState);
			envState = copied?.envState ?? findReturnsEnvState(defs);
			/* only a copied environment needs an identity, its holders are rebound on every field write */
			envId = copied === undefined ? undefined : copied.envId ?? copied.nodeId;
		} else {
			const entryVertex = sourceArg.graph.getVertex(sourceArg.entryPoint);
			if(DfgVertex.hasOrigin(entryVertex, BuiltInProcName.List)) {
				envState = resolveListToEnvState(source, data);
			} else if(DfgVertex.hasOrigin(entryVertex, BuiltInProcName.ClassGenerator)) {
				returnsEnvState = resolveClassMethodsToEnvState(source, data);
			} else if(DfgVertex.isFunctionDefinition(entryVertex) && entryVertex.returnEnvState !== undefined) {
				returnsEnvState = entryVertex.returnEnvState;
			} else if(DfgVertex.isFunctionCall(entryVertex) && entryVertex.name) {
				envState = findReturnsEnvState(Resolve.byNameAndType(entryVertex.name, data.environment, ReferenceType.Function));
			}
			envState ??= resolveConstructorInstanceEnvState(source, data);
		}
	}

	const forces = quoteSource ? ambientWritesBetween(sourceArg.environment, data.environment) : [];
	if(forces.length > 0) {
		markForcing(data.environment);
	}
	const tracked = envState ? { envState, envId } : returnsEnvState ? { returnsEnvState } : {};
	const writeNodes = written.map(w => ({ ...w, ...tracked, ...forces.length > 0 ? { forces } : {} }));

	if(writeNodes.length !== 1 && log.settings.minLevel >= LogLevel.Warn) {
		log.warn(`Unexpected write number in assignment: ${JSON.stringify(writeNodes)}`);
	}

	/* we drop the first arg which we use to pass along arguments */
	const readFromSourceWritten = sourceArg.out.slice(1);
	const readTargets: IdentifierReference[] = [
		{ nodeId: rootId, name: nameOfAssignmentFunction, cds: data.cds, type: ReferenceType.Function },
		...sourceArg.unknownReferences,
		...sourceArg.in,
		...targetName ? targetArg.in : targetArg.in.filter(i => i.nodeId !== targetId),
		...readFromSourceWritten
	];

	/* a quoted source (`delayedAssign`) writes nothing yet, its writes happen where it is forced (see `Deferred`) */
	information.environment = quoteSource ? data.environment : REnvironment.overwrite(sourceArg.environment, targetArg.environment);
	if(config.beforeDefine) {
		information.environment = config.beforeDefine(information);
	}

	for(const write of writeNodes) {
		markAsAssignment(information, write, useSourceIds, rootId, data, config);
	}
	if(copied?.name !== undefined && copied.envId === undefined && information.environment.current.lookup(Identifier.getName(copied.name))?.includes(copied)) {
		information.environment = REnvironment.define({ ...copied, name: copied.name, envId: copied.nodeId }, false, information.environment);
	}

	information.graph.addEdge(rootId, targetArg.entryPoint, EdgeType.Returns);
	information.graph.addEdge(rootId, source.info.id, quoteSource ? EdgeType.NonStandardEvaluation : EdgeType.Reads);

	return {
		environment:       information.environment,
		graph:             information.graph,
		exitPoints:        information.exitPoints,
		hooks:             information.hooks,
		unknownReferences: [],
		entryPoint:        rootId,
		cfgEntry:          information.cfgEntry,
		in:                readTargets,
		out:               [...writeNodes, ...readFromSourceWritten],
	};
}
