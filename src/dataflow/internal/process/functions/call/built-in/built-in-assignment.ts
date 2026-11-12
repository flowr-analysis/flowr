import type { AstIdMap,
	ParentInformation,
	RNodeWithParent
} from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowProcessorInformation } from '../../../../../processor';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import type { DataflowInformation } from '../../../../../info';
import { ExitPointType } from '../../../../../info';
import { markArgumentsAsNonStandardEvaluation, processKnownFunctionCall } from '../known-call-handling';
import { NseArguments, NseKind } from '../nse-kind';
import { Unquote } from '../nse';
import { DataMaskingFunctionNames } from '../../../../../environments/data-masking-functions';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { log, LogLevel } from '../../../../../../util/log';
import { toUnnamedArgument, wrapArgumentsUnnamed } from '../argument/make-argument';
import { type Location, type RAstNodeBase, RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { RAccess } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import type { PotentiallyEmptyRArgument, EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { type NamedInGraphIdentifierDefinition, type BrandedIdentifier, hasEnvState, Identifier, type IdentifierDefinition, type IdentifierReference, type InGraphIdentifierDefinition, type InGraphReferenceType, isInGraphDefinition, ReferenceType } from '../../../../../environments/identifier';
import { ambientWritesBetween, ambientWritesOfAssignment, markForcing } from './built-in-ambient-state';
import { bindsUnknownNames, noteOwnMethod } from './built-in-expression-list';
import { AmbientStateName } from '../../../../../environments/ambient-state-name';
import { uniqueArray } from '../../../../../../util/collections/arrays';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { RUnnamedArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { DataflowGraphVertexFunctionDefinition } from '../../../../../graph/vertex';
import { DfgVertex, VertexType } from '../../../../../graph/vertex';
import { EdgeType } from '../../../../../graph/edge';
import { RoleInParent } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/role';
import { ControlFlow } from '../../../../control-flow';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import type { DataflowGraph } from '../../../../../graph/graph';
import { closureFrameResolution, type EnvirResolution, EnvironmentProducers, EnvirPositionFormals, findReturnsEnvState, suppliesArg, resolveConstantString, resolveEnvirArgOrAmbiguous, resolveFirstEnvirArg, resolveSymbolToEnvir, rebindHolders, routeWrittenToEnvir } from './built-in-envir-utils';
import { markAsOnlyBuiltIn } from '../named-call-handling';
import { BuiltInProcessorMapper } from '../../../../../environments/built-in';
import { ArgProp, type FnSig } from '../../../../../environments/built-in-props';
import { matchArgumentsToParameters } from '../../../../../../util/arg-matching';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { getAliases } from '../../../../../eval/resolve/alias-tracking';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { createFreshEnvState } from './built-in-new-env';
import { holdsFunction, resolveListToEnvState } from './built-in-list';
import { resolveClassMethodsToEnvState, resolveConstructorInstanceEnvState } from './built-in-class-generator';
import { frameNamedBy, returnsStackEnv, stackEnvStateFromSource } from './built-in-stack-env';
import { RBinaryOp } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
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
	/** Name of the arg selecting the target env (e.g. `'envir'` for `assign`); if it resolves to a tracked {@link InGraphIdentifierDefinition#envState}, the assignment is routed there instead of the current scope. */
	readonly environmentArg?:      string
	/** the formals of the call, so a positional {@link AssignmentConfiguration#environmentArg} is found at the slot it really has */
	readonly sig?:                 FnSig
	/** does the call run what it binds, as `makeActiveBinding` runs its function on every read of the name? */
	readonly callsSource?:         boolean
	/** runs once the value is processed, before the target is defined; the target is defined in the environment it returns */
	readonly beforeDefine?:        (information: { readonly environment: REnvironmentInformation, readonly graph: DataflowGraph }) => REnvironmentInformation
}

export interface ExtendedAssignmentConfiguration extends AssignmentConfiguration {
	readonly source:       { idx?: number, name: BrandedIdentifier };
	readonly target:       { idx?: number, name: BrandedIdentifier };
	/** the class of the S3 method the call binds as `<target>.<class>`, like `.S3method("f", "b", m)` binds `f.b` */
	readonly targetClass?: { idx?: number, name: BrandedIdentifier };
	/** binds at the top level wherever the call runs, as registering a method (`setMethod`) does */
	readonly registers?:   boolean;
}


function yieldsEnvironment<OtherInfo>(
	node:  RNode<OtherInfo & ParentInformation>,
	graph: DataflowGraph,
	data:  DataflowProcessorInformation<OtherInfo & ParentInformation>
): boolean {
	if(RSymbol.is(node)) {
		/* a variable holding what such a call returned, `e <- environment(f)`, where flowR does not know the environment */
		return Resolve.byNameAndType(node.content, data.environment, ReferenceType.Variable)?.some(d => {
			const assignment = data.completeAst.idMap.get(d.definedAt);
			const value = RBinaryOp.is(assignment) ? [assignment.lhs, assignment.rhs].find(n => n.info.id !== d.nodeId) : undefined;
			return returnsStackEnv(value, data);
		}) === true;
	} else if(!RFunctionCall.isNamed(node)) {
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

	/* every replacement function rebinds its target, no matter whether we ship a built-in for it or the user wrote it; a user-defined one is only ever bound under its `<-` name, the `<<-` form stays in the configuration */
	const name = builtIn ? functionName.content : Identifier.mapName(functionName.content, n => superAssignment ? n.slice(0, -'<<-'.length) + '<-' : n);

	const replacementConfig = builtIn ? builtIn.config : {
		readIndices:        true,
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
	/* the replacement marks its callee as an S3 prefix, which only ever resolves to `name.<class>`; a user-defined replacement is bound under the plain name, so we read that first to link the call to its definition */
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
	const argsWithNames = new Map<BrandedIdentifier, PotentiallyEmptyRArgument<OtherInfo & ParentInformation>>();
	const argsWithoutNames: PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[] = [];
	for(const arg of args) {
		const name = RArgument.isEmpty(arg) ? undefined : arg.name?.content;
		if(name === undefined) {
			argsWithoutNames.push(arg);
		} else {
			argsWithNames.set(name, arg);
		}
	}
	const argOf = ({ idx, name }: { idx?: number, name: BrandedIdentifier }) => argsWithNames.get(name) ?? (idx === undefined ? undefined : argsWithoutNames[idx]);
	const source = argOf(config.source);
	const target = argOf(config.target);
	const classArg = config.targetClass === undefined ? undefined : argOf(config.targetClass);
	const normalizedArgs = source && target ? [target, source, ...classArg ? [classArg] : []] : args;
	const classValue = RArgument.valueOf(classArg);
	const cls = classValue === undefined ? undefined : resolveConstantString(classValue, data);
	if(config.targetClass !== undefined && cls === undefined) {
		const info = processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
		bindsUnknownNames(info.graph, info.environment, rootId);
		return info;
	}
	return assignOrdered<OtherInfo>(name, normalizedArgs, rootId, data, {
		...config,
		mayHaveMoreArgs: true,
		targetSuffix:    cls === undefined ? config.targetSuffix : `.${cls}`,
		superAssignment: config.superAssignment || (config.registers && data.environment.level > 0)
	});
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

/** The arguments of a call naming what it assigns by its signature, like `assign("f", envir = e, value = v)`, with the target and source first, as an operator has them. */
function targetAndSourceFirst<OtherInfo>(args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], { targetVariable, sig }: AssignmentConfiguration): readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[] {
	if(!targetVariable || sig === undefined || args.every(a => RArgument.isEmpty(a) || a.name === undefined)) {
		return args;
	}
	const formals = sig.map(([formal]) => formal);
	const bound = FunctionSemantics.call.match.toNames(args, formals);
	const [target, source] = [bound.get(formals[0]), bound.get(formals[1])];
	return target === undefined || source === undefined ? args : [target, source, ...args.filter(a => a !== target && a !== source)];
}

/** Processes an assignment `<target> <- <source>` as the function call \`&lt;-\` `(<target>, <source>)`, including replacement functions (e.g., `names(x) <- ...` as \`names&lt;-\` `(x, ...)`). */
export function processAssignment<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	/* we expect them to be ordered in the sense that we have (source, target): `<source> <- <target>` */
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: AssignmentConfiguration
): DataflowInformation {
	return assignOrdered(name, targetAndSourceFirst(args, config), rootId, data, config);
}

function assignOrdered<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
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
		markForcing(information.environment);
		for(const written of information.out) {
			information.graph.addEdge(written.nodeId, vertex.id, EdgeType.Calls);
			/* binding a name that holds a regular binding fails */
			for(const before of written.name === undefined ? [] : Resolve.byName(written.name, data.environment) ?? []) {
				if(!NodeId.isBuiltIn(before.nodeId)) {
					information.graph.addEdge(rootId, before.nodeId, EdgeType.Reads);
				}
			}
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
			extraArgs:                (() => {
				const [a, b] = getEffectiveOrder(config, res.processedArguments as [DataflowInformation, DataflowInformation]);
				return config.quoteSource ? res.processedArguments.filter((p): p is DataflowInformation => p !== undefined && p !== a && p !== b) : [];
			})(),
			rootId,
			data,
			information: res.information,
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

	/**
	 * The target names what to define without being it: `x` of `assign(x, v)` is read, and so is `cfg` of `assign(cfg$name, v)`.
	 * So the name gets a node of its own, as `load()` gives what it loads, rather than turning the target into a definition.
	 */
	const assignToComputedName = (targetName: Identifier) => {
		const nameId = `${target.info.id}:assigned`;
		data.completeAst.idMap.set(nameId, {
			type:      RType.Symbol,
			content:   targetName,
			lexeme:    Identifier.toString(targetName),
			location:  target.location,
			namespace: undefined,
			info:      { ...target.info, id: nameId, parent: rootId, role: RoleInParent.ExpressionListChild }
		} as RNode<OtherInfo & ParentInformation>);
		/* the value is the source's alone, what names it is an argument of the call the definition is defined by */
		const info = toSymbol(args, nameId, targetName);
		/* the name is bound once the call completes, and the program goes on from there */
		ControlFlow.continuesWith(info.graph, info, nameId);
		return { ...info, cfgExit: nameId };
	};

	if(type === RType.Symbol && !config.targetVariable) {
		return assignToSymbol();
	} else if(config.targetVariable && type !== RType.String) {
		/*
		 * the target is an expression R evaluates to the name, be it `assign(x, v)`, `assign(paste0("cfg_", k), v)`, or `assign(cfg$name, v)` (#2811):
		 * resolving to a constant name defines that name, keeping the reads that produced it; a dynamic name falls through to the unknown-target handling below.
		 * Never does it define what it reads, `cfg` is no target of `assign(cfg$name, v)`.
		 */
		const resolvedName = resolveConstantString(target, data);
		if(resolvedName !== undefined) {
			return assignToComputedName(resolvedName + (config.targetSuffix ?? ''));
		}
	} else if(config.canBeReplacement && type === RType.FunctionCall && named) {
		/* as replacement functions take precedence over the lhs fn-call (i.e., `names(x) <- ...` is independent from the definition of `names`), we do not have to process the call */
		dataflowLogger.debug(`Assignment ${Identifier.toString(name.content)} has a function call as target ==> replacement function ${target.lexeme}`);
		const replacement = toReplacementSymbol(target, target.functionName.content, config.superAssignment ?? false);
		return tryReplacement(rootId, replacement, data, config.superAssignment ?? false, [...target.arguments, source], config.beforeDefine);
	} else if(config.canBeReplacement && type === RType.Access) {
		dataflowLogger.debug(`Assignment ${Identifier.toString(name.content)} has an access-type node as target ==> replacement function ${target.lexeme}`);
		const replacement = toReplacementSymbol(target, target.operator, config.superAssignment ?? false);
		const envRouted = tryRouteFieldEnvAssign(rootId, data, config, target as RAccess<OtherInfo & ParentInformation>, source, replacement);
		if(envRouted !== undefined) {
			return envRouted;
		}
		const replaced = tryReplacement(rootId, replacement, data, config.superAssignment ?? false, [toUnnamedArgument(target.accessed, data.completeAst.idMap), ...target.access, source], config.beforeDefine);
		if(yieldsEnvironment(target.accessed, replaced.graph, data)) {
			bindsUnknownNames(replaced.graph, replaced.environment, rootId, source);
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
	bindsUnknownNames(info.graph, info.environment, rootId, source);
	return info;
}

/** A variable of the code named like a part of the ambient state only shares the name, so as a maybe definition it replaces none of what the state holds. */
function besideAmbientState<Definition extends NamedInGraphIdentifierDefinition>(definition: Definition): Definition {
	return AmbientStateName.is(Identifier.getName(definition.name)) ? { ...definition, cds: definition.cds ?? [] } : definition;
}

/** Whether the reference is what the target reads of the ambient state, rather than a variable of the code that is named like a part of it. */
function isAmbientRead(ref: IdentifierReference, idMap: AstIdMap): boolean {
	if(!AmbientStateName.is(ref.name)) {
		return false;
	}
	const node = idMap.get(ref.nodeId);
	return !RSymbol.is(node) || Identifier.getName(node.content) !== ref.name;
}

/** Promotes the ingoing/unknown references of target (an assignment) to definitions. */
function produceWrittenNodes<OtherInfo>(rootId: NodeId, target: DataflowInformation, referenceType: InGraphReferenceType, data: DataflowProcessorInformation<OtherInfo>, makeMaybe: boolean, value: NodeId[] | undefined): (NamedInGraphIdentifierDefinition)[] {
	return [...target.in, ...target.unknownReferences].filter(ref => !isAmbientRead(ref, data.completeAst.idMap)).map(ref => ({
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

/** The node an assignment takes its value from, following the {@link EdgeType.Returns} edges of the graph. */
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

/** When `e$x <- val` (or `e[["x"]] <- val`) and `e` holds a tracked {@link InGraphIdentifierDefinition#envState}, adds field `x` into that envState instead of redefining `e`; returns `undefined` when routing is not applicable. */
function tryRouteFieldEnvAssign<OtherInfo>(
	rootId:      NodeId,
	data:        DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config:      AssignmentConfiguration,
	target:      RAccess<OtherInfo & ParentInformation>,
	source:      RNode<OtherInfo & ParentInformation>,
	replacement: RSymbol<OtherInfo & ParentInformation>
): DataflowInformation | undefined {
	const fieldNode = target.access.length === 1 ? RArgument.valueOf(target.access[0]) : undefined;
	if(!fieldNode || (target.operator !== '$' && (target.operator !== '[[' || !RString.is(fieldNode)))) {
		return undefined;
	}
	const envirResolution = RSymbol.is(target.accessed) ? resolveSymbolToEnvir(target.accessed.content, target.accessed.info.id, data) : closureFrameResolution(target.accessed, data);
	if(!envirResolution) {
		return undefined;
	}
	const fieldName = (RString.is(fieldNode) ? fieldNode.content.str : fieldNode.lexeme) as Identifier;

	const normalResult = tryReplacement(rootId, replacement, data, config.superAssignment ?? false, [toUnnamedArgument(target.accessed, data.completeAst.idMap), ...target.access, source], config.beforeDefine);
	const fieldDef: NamedInGraphIdentifierDefinition = {
		type:      holdsFunction(source, data.environment) ? ReferenceType.Function : ReferenceType.Variable,
		name:      fieldName,
		nodeId:    source.info.id,
		definedAt: normalResult.entryPoint,
		cds:       data.cds ?? (config.makeMaybe ? [] : undefined)
	};
	if((envirResolution.stack === 'global' || envirResolution.stack === 'enclosing') && normalResult.graph.hasVertex(fieldNode.info.id)) {
		/* `e$f <- v` with `e` the global frame (`e <- globalenv()`, or `environment()` at the top level) or that of a function around (`e <- parent.env(environment())`) is `f <<- v` */
		const definition = { ...fieldDef, nodeId: fieldNode.info.id };
		normalResult.graph.setDefinitionOfVertex(definition, [source.info.id]);
		normalResult.graph.addEdge(fieldNode.info.id, source.info.id, EdgeType.DefinedBy);
		/* the field is bound by the replacement, which reads the environment it binds in */
		normalResult.graph.addEdge(fieldNode.info.id, normalResult.entryPoint, EdgeType.DefinedBy);
		normalResult.graph.addEdge(normalResult.entryPoint, envirResolution.envirNodeId, EdgeType.Reads);
		if(data.environment.level > 0) {
			markSuperAssigning(normalResult.graph, normalResult.entryPoint, fieldNode.info.id);
		}
		noteOwnMethod(fieldName, normalResult.environment, data.ctx);
		return { ...normalResult, environment: REnvironment.define(definition, true, normalResult.environment) };
	}
	/* a read of the field reaches the value it binds, which only the replacement binds there (`get("f", envir = e)` after `e$f <- v`), as a deferred write keeps its value as well */
	normalResult.graph.addEdge(source.info.id, normalResult.entryPoint, EdgeType.SideEffectOnCall);
	const newEnvState = REnvironment.define(fieldDef, false, envirResolution.envDef.envState);
	if(envirResolution.envDef.closureFrame === true) {
		/* `environment(g)$v <- x` writes the frame, `g` still holds the same closure */
		normalResult.graph.addEdge(normalResult.entryPoint, envirResolution.envirNodeId, EdgeType.Reads);
		return { ...normalResult, environment: rebindHolders(normalResult.environment, envirResolution.envDef, newEnvState, rootId) };
	}
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

/** Marks the replacement `call` as binding `target` as `<<-` does, so the closures around link it as they link a super assignment (see {@link Dataflow.superAssigns}). */
function markSuperAssigning(graph: DataflowGraph, call: NodeId, target: NodeId): void {
	const vertex = graph.getVertex(call);
	if(DfgVertex.isFunctionCall(vertex) && vertex.origin !== 'unnamed') {
		vertex.origin = [...vertex.origin, BuiltInProcName.SuperAssignment];
		graph.addEdge(call, target, EdgeType.Returns);
	}
}

/** When `config.environmentArg` (e.g. `'envir'` for `assign`) resolves to a variable with a tracked {@link InGraphIdentifierDefinition#envState}, routes the written definitions there instead of the current scope; returns `undefined` if not possible. */
function tryRouteToCustomEnv<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: AssignmentConfiguration
): DataflowInformation | undefined {
	const envirRouting = resolveEnvirArgOrAmbiguous(args, data, config.sig, config.environmentArg)
		?? resolveFirstEnvirArg(args, data, config.sig, EnvirPositionFormals);
	const value = args.length < 2 ? undefined : RArgument.valueOf(getEffectiveOrder(config, [args[0], args[1]])[1]);
	if(envirRouting === 'ambiguous' || (!envirRouting && suppliesArg(args, config.sig, EnvirPositionFormals))) {
		const info = processKnownFunctionCall({ name, args, rootId, data, origin: originOf(config) }).information;
		bindsUnknownNames(info.graph, info.environment, rootId, value);
		return info;
	}
	if(!envirRouting) {
		if(!data.ctx.config.solver.trackEnvironments || config.environmentArg === undefined || !suppliesArg(args, config.sig, [config.environmentArg])) {
			return undefined;
		}
		/* an environment we cannot name (`sys.frame(-1)`) may be any frame, so the write stays here and is kept as well */
		const info = processAssignment(name, args, rootId, data, { ...config, environmentArg: undefined });
		bindsUnknownNames(info.graph, info.environment, rootId, value);
		return info;
	}

	/* run the normal assignment path to get the correct graph structure, the call reads the environment it writes into */
	/* the global frame and that of a function around are bound into as `<<-` binds */
	const global = envirRouting.stack === 'global' || envirRouting.stack === 'enclosing';
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
	/** the other arguments of a `delayedAssign` (`eval.env = e`), which it reads */
	readonly extraArgs?:               readonly DataflowInformation[]
}

/** Models a call like `Hmisc::getHdata(x)` that loads a dataset into the variable it is *given*: `x` is both **read** (its value comes from outside) and **defined** by the call; unlike {@link markAsAssignment} we keep the read edge. */
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
	const defineByCall = (node: NamedInGraphIdentifierDefinition) => {
		info.environment = REnvironment.define(besideAmbientState(node), config.superAssignment, info.environment);
		noteOwnMethod(node.name, info.environment, data.ctx);
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
	nodeToDefine: NamedInGraphIdentifierDefinition,
	sourceIds: readonly NodeId[],
	rootIdOfAssignment: NodeId,
	data: DataflowProcessorInformation<OtherInfo>,
	assignmentConfig?: AssignmentConfiguration
) {
	if(assignmentConfig?.superAssignment) {
		/* `<<-` reaching the binding of an attached package fails on it, so it depends on the attach */
		for(const def of Resolve.byName(nodeToDefine.name, information.environment) ?? []) {
			const definedAt = (def as Partial<InGraphIdentifierDefinition>).definedAt;
			if(NodeId.isBuiltIn(def.nodeId) && definedAt !== undefined && !NodeId.isBuiltIn(definedAt)) {
				information.graph.addEdge(rootIdOfAssignment, definedAt, EdgeType.Reads);
			}
		}
	}
	/* `<<-` binds in the closest enclosing function frame that holds the name, which must stay for it to land there and not further out */
	const superTarget = assignmentConfig?.superAssignment ? information.environment.current.superTargetIn(Identifier.getName(nodeToDefine.name)) : undefined;
	information.environment = REnvironment.define(besideAmbientState(nodeToDefine), assignmentConfig?.superAssignment, information.environment);
	noteOwnMethod(nodeToDefine.name, information.environment, data.ctx);
	information.environment = ambientWritesOfAssignment(information.graph, information.environment, nodeToDefine.name, rootIdOfAssignment, data.cds ? [...data.cds] : undefined, assignmentConfig?.superAssignment === true || data.environment.level === 0);
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
	for(const def of superTarget ?? []) {
		if(!NodeId.isBuiltIn(def.nodeId)) {
			information.graph.addEdge(nid, def.nodeId, EdgeType.Reads);
		}
	}
}

/** Helper for when the _target_ of an assignment is known to be a (single) symbol (i.e. `x <- ...`, not `names(x) <- ...`). */
function processAssignmentToSymbol<OtherInfo>(config: AssignmentToSymbolParameters<OtherInfo>): DataflowInformation {
	const { nameOfAssignmentFunction, source, args: [targetArg, sourceArg], targetId, targetName, rootId, data, information, makeMaybe, quoteSource, extraArgs = [] } = config;
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
	} satisfies NamedInGraphIdentifierDefinition]
		: produceWrittenNodes(rootId, targetArg, referenceType, data, makeMaybe ?? false, aliases);

	let copied: (InGraphIdentifierDefinition & { envState: REnvironmentInformation }) | undefined;
	let envState: REnvironmentInformation | undefined;
	let envId: NodeId | undefined;
	let returnsEnvState: REnvironmentInformation | undefined;
	let frame: EnvirResolution<OtherInfo>['envDef'] | undefined;
	if(data.ctx.config.solver.trackEnvironments) {
		const valueEntry = valueEntryPointOf(sourceArg);
		const stackEnv = stackEnvStateFromSource(sourceArg, data, valueEntry) ?? frameNamedBy(source, data);
		frame = closureFrameResolution(source, data as DataflowProcessorInformation<OtherInfo & ParentInformation>)?.envDef;
		if(frame !== undefined) {
			/* the frame of a closure, shared with the variable holding the closure */
			envState = frame.envState;
			envId = frame.envId;
		} else if(valueEntry !== undefined && DfgVertex.hasOrigin(sourceArg.graph.getVertex(valueEntry), BuiltInProcName.NewEnv)) {
			envState = createFreshEnvState(data, sourceArg);
		} else if(stackEnv !== undefined) {
			// globalenv()/baseenv()/emptyenv(): assigned variable points into that search-path stack env
			envState = stackEnv;
		} else if(RSymbol.is(source)) {
			const defs = Resolve.byNameAndType(source.content, data.environment, ReferenceType.Variable);
			copied = defs?.find(hasEnvState);
			envState = copied?.envState ?? findReturnsEnvState(defs);
			/* only a copy needs an identity, its holders are rebound on every field write, of a closure on writes to its frame */
			const held = copied ?? (defs?.length === 1 && !NodeId.isBuiltIn(defs[0].nodeId) ? defs[0] as InGraphIdentifierDefinition : undefined);
			envId = held === undefined ? undefined : held.envId ?? held.nodeId;
		} else {
			/* `(list(...))` and `{ mk() }` hand on the value of what they hold */
			const entry = valueEntry ?? sourceArg.entryPoint;
			const value = data.completeAst.idMap.get(entry) ?? source;
			const entryVertex = sourceArg.graph.getVertex(entry);
			if(DfgVertex.hasOrigin(entryVertex, BuiltInProcName.List)) {
				envState = resolveListToEnvState(value, data);
			} else if(DfgVertex.hasOrigin(entryVertex, BuiltInProcName.ClassGenerator)) {
				returnsEnvState = resolveClassMethodsToEnvState(value, data);
			} else if(DfgVertex.isFunctionDefinition(entryVertex) && entryVertex.returnEnvState !== undefined) {
				returnsEnvState = entryVertex.returnEnvState;
			} else if(DfgVertex.isFunctionCall(entryVertex) && entryVertex.name) {
				envState = findReturnsEnvState(Resolve.byNameAndType(entryVertex.name, data.environment, ReferenceType.Function));
			}
			envState ??= resolveConstructorInstanceEnvState(value, data);
		}
	}

	const forces = quoteSource ? ambientWritesBetween(sourceArg.environment, data.environment) : [];
	/* the promise reads the state where it is forced, not where it is bound */
	const forcedReads = quoteSource ? uniqueArray([...sourceArg.in, ...sourceArg.unknownReferences].map(r => r.name).filter(AmbientStateName.is)) : [];
	/* what the promise binds once forced, which plain reads of the variables cannot see until the promise is linked to where it is forced */
	const forcedWrites = quoteSource ? sourceArg.out.filter((w): w is NamedInGraphIdentifierDefinition => isInGraphDefinition(w as IdentifierDefinition) && w.name !== undefined && !AmbientStateName.is(Identifier.getName(w.name))) : [];
	/* and how it leaves the function it runs in, where it is forced */
	const forcedExits = quoteSource ? sourceArg.exitPoints.filter(e => e.type !== ExitPointType.Default) : [];
	if(forces.length > 0 || forcedReads.length > 0 || forcedWrites.length > 0 || forcedExits.length > 0) {
		markForcing(data.environment);
	}
	const tracked = envState ? { envState, envId, ...frame !== undefined || copied?.closureFrame ? { closureFrame: true } as const : {} } : returnsEnvState ? { returnsEnvState } : envId === undefined ? {} : { envId };
	const writeNodes = written.map(w => ({ ...w, ...tracked, ...forces.length > 0 ? { forces } : {}, ...forcedReads.length > 0 ? { forcedReads } : {}, ...forcedWrites.length > 0 ? { forcedWrites } : {}, ...forcedExits.length > 0 ? { forcedExits } : {} }));

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
		...readFromSourceWritten,
		...extraArgs.flatMap(a => [...a.in, ...a.unknownReferences])
	];

	/* a quoted source (`delayedAssign`) writes nothing yet, its writes happen where it is forced (see `Deferred`) */
	information.environment = quoteSource ? data.environment : REnvironment.overwrite(sourceArg.environment, targetArg.environment);
	if(config.beforeDefine) {
		information.environment = config.beforeDefine(information);
	}

	for(const write of writeNodes) {
		/* a name the target only evaluates to has no vertex yet, see `assignToComputedName` */
		if(!information.graph.hasVertex(write.nodeId)) {
			information.graph.addVertex({ tag: VertexType.VariableDefinition, id: write.nodeId, cds: write.cds, source: useSourceIds }, data.environment);
		}
		markAsAssignment(information, write, useSourceIds, rootId, data, config);
	}
	if(frame !== undefined) {
		information.environment = REnvironment.define(frame, information.environment.current.lookup(Identifier.getName(frame.name)) === undefined, information.environment);
	}
	if(copied?.name !== undefined && copied.envId === undefined && information.environment.current.lookup(Identifier.getName(copied.name))?.includes(copied)) {
		information.environment = REnvironment.define({ ...copied, name: copied.name, envId: copied.nodeId }, false, information.environment);
	}

	for(const extra of extraArgs) {
		information.graph.addEdge(rootId, extra.entryPoint, EdgeType.Reads);
	}
	information.graph.addEdge(rootId, targetArg.entryPoint, EdgeType.Returns);
	information.graph.addEdge(rootId, useSourceIds[0], quoteSource ? EdgeType.NonStandardEvaluation : EdgeType.Reads);

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
