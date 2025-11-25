import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { log, LogLevel } from '../../../../../../util/log';
import { unpackArgument } from '../argument/unpack-argument';
import { processAsNamedCall } from '../../../process-named-call';
import { toUnnamedArgument, wrapArgumentsUnnamed } from '../argument/make-argument';
import type {
	ParentInformation,
	RNodeWithParent
} from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { Base, Location, RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import type {
	EmptyArgument,
	RFunctionArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { type NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import {
	type IdentifierReference,
	type InGraphIdentifierDefinition,
	type InGraphReferenceType,
	ReferenceType
} from '../../../../../environments/identifier';
import { overwriteEnvironment } from '../../../../../environments/overwrite';
import type { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { removeRQuotes } from '../../../../../../r-bridge/retriever';
import type { RUnnamedArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { type ContainerIndicesCollection, VertexType } from '../../../../../graph/vertex';
import { define } from '../../../../../environments/define';
import { EdgeType } from '../../../../../graph/edge';
import type { ForceArguments } from '../common';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import type { DataflowGraph } from '../../../../../graph/graph';
import { resolveByName } from '../../../../../environments/resolve-by-name';
import { addSubIndicesToLeafIndices, resolveIndicesByName } from '../../../../../../util/containers';
import { markAsOnlyBuiltIn } from '../named-call-handling';
import { BuiltInProcessorMapper } from '../../../../../environments/built-in';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { getAliases, resolveIdToValue } from '../../../../../eval/resolve/alias-tracking';
import { isValue } from '../../../../../eval/values/r-value';

function toReplacementSymbol<OtherInfo>(target: RNodeWithParent<OtherInfo & ParentInformation> & Base<OtherInfo> & Location, prefix: string, superAssignment: boolean): RSymbol<OtherInfo & ParentInformation> {
	return {
		type:      RType.Symbol,
		info:      target.info,
		/* they are all mapped to `<-` in R, but we mark super as well */
		content:   `${prefix}${superAssignment ? '<<-' : '<-'}`,
		lexeme:    target.lexeme,
		location:  target.location,
		namespace: undefined
	};
}

function getEffectiveOrder<T>(config: {
	swapSourceAndTarget?: boolean
}, args: [T, T]): [T, T] {
	return config.swapSourceAndTarget ? [args[1], args[0]] : args;
}

export interface AssignmentConfiguration extends ForceArguments {
	readonly superAssignment?:     boolean
	readonly swapSourceAndTarget?: boolean
	/** Make maybe if assigned to symbol */
	readonly makeMaybe?:           boolean
	readonly quoteSource?:         boolean
	readonly canBeReplacement?:    boolean
	/** is the target a variable pointing at the actual name? */
	readonly targetVariable?:      boolean
	readonly indicesCollection?:   ContainerIndicesCollection
	readonly mayHaveMoreArgs?:     boolean
}

function findRootAccess<OtherInfo>(node: RNode<OtherInfo & ParentInformation>): RSymbol<OtherInfo & ParentInformation> | undefined {
	let current = node;
	while(current.type === RType.Access) {
		current = current.accessed;
	}
	if(current.type === RType.Symbol) {
		return current;
	} else {
		return undefined;
	}
}

function tryReplacementPassingIndices<OtherInfo>(
	rootId: NodeId,
	functionName: RSymbol<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	name: string,
	args: readonly (RNode<OtherInfo & ParentInformation> | typeof EmptyArgument | undefined)[],
	indices: ContainerIndicesCollection
): DataflowInformation {
	const resolved = resolveByName(functionName.content, data.environment, ReferenceType.Function) ?? [];

	// yield for unsupported pass along!
	if(resolved.length !== 1 || resolved[0].type !== ReferenceType.BuiltInFunction) {
		return processAsNamedCall(functionName, data, name, args);
	}


	const info = BuiltInProcessorMapper['builtin:replacement'](
		{
			type:      RType.Symbol,
			info:      functionName.info,
			content:   name,
			lexeme:    functionName.lexeme,
			location:  functionName.location,
			namespace: undefined
		},
		wrapArgumentsUnnamed(args, data.completeAst.idMap),
		functionName.info.id,
		data,
		{
			...(resolved[0].config ?? {}),
			activeIndices: indices,
			assignRootId:  rootId
		}
	);

	markAsOnlyBuiltIn(info.graph, functionName.info.id);
	return info;
}

/**
 * Processes an assignment, i.e., `<target> <- <source>`.
 * Handling it as a function call \`&lt;-\` `(<target>, <source>)`.
 * This includes handling of replacement functions (e.g., `names(x) <- ...` as \`names&lt;-\` `(x, ...)`).
 */
export function processAssignment<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	/* we expect them to be ordered in the sense that we have (source, target): `<source> <- <target>` */
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: AssignmentConfiguration
): DataflowInformation {
	if(!config.mayHaveMoreArgs && args.length !== 2) {
		dataflowLogger.warn(`Assignment ${name.content} has something else than 2 arguments, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, forceArgs: config.forceArgs, origin: 'default' }).information;
	}

	const effectiveArgs = getEffectiveOrder(config, args as [RFunctionArgument<OtherInfo & ParentInformation>, RFunctionArgument<OtherInfo & ParentInformation>]);
	const { target, source } = extractSourceAndTarget(effectiveArgs);

	if(target === undefined || source === undefined) {
		dataflowLogger.warn(`Assignment ${name.content} has an undefined target or source, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, forceArgs: config.forceArgs, origin: 'default' }).information;
	}
	const { type, named } = target;

	if(type === RType.Symbol) {
		if(!config.targetVariable) {
			const res = processKnownFunctionCall({
				name,
				args,
				rootId,
				data,
				reverseOrder: !config.swapSourceAndTarget,
				forceArgs:    config.forceArgs,
				origin:       'builtin:assignment'
			});
			return processAssignmentToSymbol<OtherInfo & ParentInformation>({
				...config,
				nameOfAssignmentFunction: name.content,
				source,
				targetId:                 target.info.id,
				args:                     getEffectiveOrder(config, res.processedArguments as [DataflowInformation, DataflowInformation]),
				rootId,
				data,
				information:              res.information,
			});
		}  else {
			// try to resolve the variable first
			const n = resolveIdToValue(target.info.id, { environment: data.environment, resolve: data.ctx.config.solver.variables, idMap: data.completeAst.idMap, full: true, ctx: data.ctx });
			if(n.type === 'set' && n.elements.length === 1 && n.elements[0].type === 'string') {
				const val = n.elements[0].value;
				if(isValue(val)) {
					const res = processKnownFunctionCall({
						name,
						args,
						rootId,
						data,
						reverseOrder: !config.swapSourceAndTarget,
						forceArgs:    config.forceArgs,
						origin:       'builtin:assignment'
					});
					return processAssignmentToSymbol<OtherInfo & ParentInformation>({
						...config,
						nameOfAssignmentFunction: name.content,
						source,
						targetId:                 target.info.id,
						targetName:               val.str,
						args:                     getEffectiveOrder(config, res.processedArguments as [DataflowInformation, DataflowInformation]),
						rootId,
						data,
						information:              res.information,
					});
				}
			}
		}
	} else if(config.canBeReplacement && type === RType.FunctionCall && named) {
		/* as replacement functions take precedence over the lhs fn-call (i.e., `names(x) <- ...` is independent from the definition of `names`), we do not have to process the call */
		dataflowLogger.debug(`Assignment ${name.content} has a function call as target ==> replacement function ${target.lexeme}`);
		const replacement = toReplacementSymbol(target, target.functionName.content, config.superAssignment ?? false);
		return tryReplacementPassingIndices(rootId, replacement, data, replacement.content, [...target.arguments, source], config.indicesCollection);
	} else if(config.canBeReplacement && type === RType.Access) {
		dataflowLogger.debug(`Assignment ${name.content} has an access-type node as target ==> replacement function ${target.lexeme}`);
		const replacement = toReplacementSymbol(target, target.operator, config.superAssignment ?? false);
		return tryReplacementPassingIndices(rootId, replacement, data, replacement.content, [toUnnamedArgument(target.accessed, data.completeAst.idMap), ...target.access, source], config.indicesCollection);
	} else if(type === RType.Access) {
		const rootArg = findRootAccess(target);
		if(rootArg) {
			const res = processKnownFunctionCall({
				name,
				args:         [rootArg, source],
				rootId,
				data,
				reverseOrder: !config.swapSourceAndTarget,
				forceArgs:    config.forceArgs,
				origin:       'builtin:assignment'
			});

			return processAssignmentToSymbol<OtherInfo & ParentInformation>({
				...config,
				nameOfAssignmentFunction: name.content,
				source,
				targetId:                 rootArg.info.id,
				args:                     getEffectiveOrder(config, res.processedArguments as [DataflowInformation, DataflowInformation]),
				rootId,
				data,
				information:              res.information,
			});
		}
	} else if(type === RType.String) {
		return processAssignmentToString(target, args, name, rootId, data, config, source);
	}

	dataflowLogger.warn(`Assignment ${name.content} has an unknown target type ${target.type} => unknown impact`);

	const info = processKnownFunctionCall({
		name, args:      effectiveArgs, rootId, data, forceArgs: config.forceArgs,
		origin:    'builtin:assignment'
	}).information;
	handleUnknownSideEffect(info.graph, info.environment, rootId);
	return info;
}

function extractSourceAndTarget<OtherInfo>(args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]) {
	const source = unpackArgument(args[1], false);
	const target = unpackArgument(args[0], false);
	return { source, target };
}

/**
 * Promotes the ingoing/unknown references of target (an assignment) to definitions
 */
function produceWrittenNodes<OtherInfo>(rootId: NodeId, target: DataflowInformation, referenceType: InGraphReferenceType, data: DataflowProcessorInformation<OtherInfo>, makeMaybe: boolean, value: NodeId[] | undefined): InGraphIdentifierDefinition[] {
	return target.in.concat(target.unknownReferences).map(ref => ({
		...ref,
		type:                referenceType,
		definedAt:           rootId,
		controlDependencies: data.controlDependencies ?? (makeMaybe ? [] : undefined),
		value
	}));
}

function processAssignmentToString<OtherInfo>(
	target: RString<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	name: RSymbol<OtherInfo & ParentInformation>,
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: AssignmentConfiguration,
	source: RNode<OtherInfo & ParentInformation>
) {
	const symbol: RSymbol<OtherInfo & ParentInformation> = {
		type:      RType.Symbol,
		info:      target.info,
		content:   removeRQuotes(target.lexeme),
		lexeme:    target.lexeme,
		location:  target.location,
		namespace: undefined
	};

	// treat first argument to Symbol
	const mappedArgs = config.swapSourceAndTarget ? [args[0], {
		...(args[1] as RUnnamedArgument<OtherInfo & ParentInformation>),
		value: symbol
	}] : [{ ...(args[0] as RUnnamedArgument<OtherInfo & ParentInformation>), value: symbol }, args[1]];
	const res = processKnownFunctionCall({
		name,
		args:         mappedArgs,
		rootId,
		data,
		reverseOrder: !config.swapSourceAndTarget,
		forceArgs:    config.forceArgs,
		origin:       'builtin:assignment'
	});

	return processAssignmentToSymbol<OtherInfo & ParentInformation>({
		...config,
		nameOfAssignmentFunction: name.content,
		source,
		targetId:                 symbol.info.id,
		args:                     getEffectiveOrder(config, res.processedArguments as [DataflowInformation, DataflowInformation]),
		rootId,
		data,
		information:              res.information
	});
}

function checkTargetReferenceType<OtherInfo>(source: RNode<OtherInfo & ParentInformation>, sourceInfo: DataflowInformation): InGraphReferenceType {
	const vert = sourceInfo.graph.getVertex(source.info.id, true);
	switch(vert?.tag) {
		case VertexType.FunctionDefinition:
			return ReferenceType.Function;
		case VertexType.Use:
		case VertexType.FunctionCall:
			return ReferenceType.Unknown;
		default:
			return ReferenceType.Variable;
	}
}

export interface AssignmentToSymbolParameters<OtherInfo> extends AssignmentConfiguration {
	readonly nameOfAssignmentFunction: string
	readonly source:                   RNode<OtherInfo & ParentInformation>
	readonly args:                     [DataflowInformation, DataflowInformation]
	readonly targetId:                 NodeId
	/** pass only if the assignment target differs from normal R assignments (i.e., if the symbol is to be resolved) */
	readonly targetName?:              string
	readonly rootId:                   NodeId
	readonly data:                     DataflowProcessorInformation<OtherInfo>
	readonly information:              DataflowInformation
}

/**
 * Consider a call like `x <- v`
 * @param information        - the information to define the assignment within
 * @param nodeToDefine       - `x`
 * @param sourceIds          - `v`
 * @param rootIdOfAssignment - `<-`
 * @param data               - The dataflow analysis fold backpack
 * @param assignmentConfig   - configuration for the assignment processing
 */
export function markAsAssignment<OtherInfo>(
	information: {
		environment: REnvironmentInformation,
		graph:       DataflowGraph
	},
	nodeToDefine: InGraphIdentifierDefinition,
	sourceIds: readonly NodeId[],
	rootIdOfAssignment: NodeId,
	data: DataflowProcessorInformation<OtherInfo>,
	assignmentConfig?: AssignmentConfiguration
) {
	if(data.ctx.config.solver.pointerTracking) {
		let indicesCollection: ContainerIndicesCollection = undefined;
		if(sourceIds.length === 1) {
			// support for tracking indices.
			// Indices were defined for the vertex e.g. a <- list(c = 1) or a$b <- list(c = 1)
			indicesCollection = information.graph.getVertex(sourceIds[0])?.indicesCollection;

			// support assignment of container e.g. container1 <- container2
			// defined indices are passed
			if(!indicesCollection) {
				const node = information.graph.idMap?.get(sourceIds[0]);
				if(node && node.type === RType.Symbol) {
					indicesCollection = resolveIndicesByName(node.lexeme, information.environment);
				}
			}
		}
		// Indices defined by replacement operation e.g. $<-
		if(assignmentConfig?.indicesCollection !== undefined) {
			// If there were indices stored in the vertex, then a container was defined
			// and assigned to the index of another container e.g. a$b <- list(c = 1)
			if(indicesCollection) {
				indicesCollection = addSubIndicesToLeafIndices(assignmentConfig.indicesCollection, indicesCollection);
			} else {
				// No indices were defined for the vertex e.g. a$b <- 2
				indicesCollection = assignmentConfig.indicesCollection;
			}
		}
		nodeToDefine.indicesCollection ??= indicesCollection;
	}

	information.environment = define(nodeToDefine, assignmentConfig?.superAssignment, information.environment, data.ctx.config);
	information.graph.setDefinitionOfVertex(nodeToDefine);
	if(!assignmentConfig?.quoteSource) {
		for(const sourceId of sourceIds) {
			information.graph.addEdge(nodeToDefine, sourceId, EdgeType.DefinedBy);
		}
	}
	information.graph.addEdge(nodeToDefine, rootIdOfAssignment, EdgeType.DefinedBy);
	// kinda dirty, but we have to remove existing read edges for the symbol, added by the child
	const out = information.graph.outgoingEdges(nodeToDefine.nodeId);
	for(const [id, edge] of (out ?? [])) {
		edge.types &= ~EdgeType.Reads;
		if(edge.types === 0) {
			out?.delete(id);
		}
	}
}

/**
 * Helper function whenever it is known that the _target_ of an assignment is a (single) symbol (i.e. `x <- ...`, but not `names(x) <- ...`).
 */
function processAssignmentToSymbol<OtherInfo>(config: AssignmentToSymbolParameters<OtherInfo>): DataflowInformation {
	const { nameOfAssignmentFunction, source, args: [targetArg, sourceArg], targetId, targetName, rootId, data, information, makeMaybe, quoteSource } = config;
	const referenceType = checkTargetReferenceType(source, sourceArg);

	const aliases = getAliases([source.info.id], information.graph, information.environment);
	const writeNodes = targetName ? [{
		nodeId:              targetId,
		name:                targetName,
		type:                referenceType,
		definedAt:           rootId,
		controlDependencies: data.controlDependencies ?? (makeMaybe ? [] : undefined),
		value:               aliases
	} satisfies InGraphIdentifierDefinition]
		: produceWrittenNodes(rootId, targetArg, referenceType, data, makeMaybe ?? false, aliases);

	if(writeNodes.length !== 1 && log.settings.minLevel <= LogLevel.Warn) {
		log.warn(`Unexpected write number in assignment: ${JSON.stringify(writeNodes)}`);
	}

	// we drop the first arg which we use to pass along arguments :D
	const readFromSourceWritten = sourceArg.out.slice(1);
	const readTargets: readonly IdentifierReference[] = [
		{ nodeId: rootId, name: nameOfAssignmentFunction, controlDependencies: data.controlDependencies, type: ReferenceType.Function } as IdentifierReference
	].concat(
		sourceArg.unknownReferences,
		sourceArg.in,
		targetName ? targetArg.in : targetArg.in.filter(i => i.nodeId !== targetId),
		readFromSourceWritten
	);

	information.environment = overwriteEnvironment(sourceArg.environment, targetArg.environment);

	// install assigned variables in environment
	for(const write of writeNodes) {
		markAsAssignment(information, write, [source.info.id], rootId, data, config);
	}

	information.graph.addEdge(rootId, targetArg.entryPoint, EdgeType.Returns);

	if(quoteSource) {
		information.graph.addEdge(rootId, source.info.id, EdgeType.NonStandardEvaluation);
	}

	return {
		...information,
		unknownReferences: [],
		entryPoint:        rootId,
		in:                readTargets,
		out:               writeNodes.concat(readFromSourceWritten as typeof writeNodes),
	};
}
