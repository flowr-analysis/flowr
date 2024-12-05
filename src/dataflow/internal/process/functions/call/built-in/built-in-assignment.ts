import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { guard } from '../../../../../../util/assert';
import { log, LogLevel } from '../../../../../../util/log';
import { unpackArgument } from '../argument/unpack-argument';
import { processAsNamedCall } from '../../../process-named-call';
import { toUnnamedArgument } from '../argument/make-argument';
import type {
	ParentInformation,
	RNodeWithParent
} from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { Base, Location, RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { recoverName, type NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import type {
	IdentifierDefinition,
	IdentifierReference,
	InGraphReferenceType } from '../../../../../environments/identifier';
import { ReferenceType
} from '../../../../../environments/identifier';
import { overwriteEnvironment } from '../../../../../environments/overwrite';
import type { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { removeRQuotes } from '../../../../../../r-bridge/retriever';
import type { RUnnamedArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { VertexType } from '../../../../../graph/vertex';
import { define } from '../../../../../environments/define';
import { EdgeType } from '../../../../../graph/edge';
import type { ForceArguments } from '../common';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import type { DataflowGraph } from '../../../../../graph/graph';
import { resolveByName } from '../../../../../environments/resolve-by-name';

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
	/* Make maybe if assigned to symbol */
	readonly makeMaybe?:           boolean
	readonly quoteSource?:         boolean
	readonly canBeReplacement?:    boolean
	/** is the target a variable pointing at the actual name? */
	readonly targetVariable?:      boolean
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
	if(args.length != 2) {
		dataflowLogger.warn(`Assignment ${name.content} has something else than 2 arguments, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, forceArgs: config.forceArgs }).information;
	}

	const effectiveArgs = getEffectiveOrder(config, args as [RFunctionArgument<OtherInfo & ParentInformation>, RFunctionArgument<OtherInfo & ParentInformation>]);
	const { target, source } = extractSourceAndTarget(effectiveArgs, name);
	const { type, named } = target;

	if(!config.targetVariable && type === RType.Symbol) {
		const res = processKnownFunctionCall({ name, args, rootId, data, reverseOrder: !config.swapSourceAndTarget, forceArgs: config.forceArgs });
		return processAssignmentToSymbol<OtherInfo & ParentInformation>({
			...config,
			nameOfAssignmentFunction: name.content,
			source,
			target,
			args:                     getEffectiveOrder(config, res.processedArguments as [DataflowInformation, DataflowInformation]),
			rootId,
			data,
			information:              res.information,
		});
	} else if(config.canBeReplacement && type === RType.FunctionCall && named) {
		/* as replacement functions take precedence over the lhs fn-call (i.e., `names(x) <- ...` is independent from the definition of `names`), we do not have to process the call */
		dataflowLogger.debug(`Assignment ${name.content} has a function call as target => replacement function ${target.lexeme}`);
		const replacement = toReplacementSymbol(target, target.functionName.content, config.superAssignment ?? false);
		return processAsNamedCall(replacement, data, replacement.content, [...target.arguments, source]);
	} else if(config.canBeReplacement && type === RType.Access) {
		dataflowLogger.debug(`Assignment ${name.content} has an access as target => replacement function ${target.lexeme}`);
		const replacement = toReplacementSymbol(target, target.operator, config.superAssignment ?? false);
		return processAsNamedCall(replacement, data, replacement.content, [toUnnamedArgument(target.accessed, data.completeAst.idMap), ...target.access, source]);
	} else if(type === RType.Access) {
		const rootArg = findRootAccess(target);
		if(rootArg) {
			const res = processKnownFunctionCall({
				name,
				args: 			     [rootArg, source],
				rootId,
				data,
				reverseOrder: !config.swapSourceAndTarget,
				forceArgs:    config.forceArgs
			});

			return processAssignmentToSymbol<OtherInfo & ParentInformation>({
				...config,
				nameOfAssignmentFunction: name.content,
				source,
				target:                   rootArg,
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

	const info = processKnownFunctionCall({ name, args: effectiveArgs, rootId, data, forceArgs: config.forceArgs }).information;
	info.graph.markIdForUnknownSideEffects(rootId);
	return info;
}

function extractSourceAndTarget<OtherInfo>(args: readonly RFunctionArgument<OtherInfo & ParentInformation>[], name: RSymbol<OtherInfo & ParentInformation>) {
	const source = unpackArgument(args[1], false);
	const target = unpackArgument(args[0], false);

	guard(source !== undefined, () => `Assignment ${name.content} has no source, impossible!`);
	guard(target !== undefined, () => `Assignment ${name.content} has no target, impossible!`);

	return { source, target };
}

/**
 * Promotes the ingoing/unknown references of target (an assignment) to defitions   
 */
function produceWrittenNodes<OtherInfo>(rootId: NodeId, target: DataflowInformation, referenceType: InGraphReferenceType, data: DataflowProcessorInformation<OtherInfo>, makeMaybe: boolean, value: NodeId[] | undefined): IdentifierDefinition[] {
	return [...target.in, ...target.unknownReferences].map(ref => ({
		...ref,
		type:                referenceType,
		definedAt:           rootId,
		controlDependencies: data.controlDependencies ?? (makeMaybe ? [] : undefined),
		value: value
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
		forceArgs:    config.forceArgs
	});

	return processAssignmentToSymbol<OtherInfo & ParentInformation>({
		...config,
		nameOfAssignmentFunction: name.content,
		source,
		target:                   symbol,
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
	readonly target:                   RSymbol<OtherInfo & ParentInformation>
	readonly rootId:                   NodeId
	readonly data:                     DataflowProcessorInformation<OtherInfo>
	readonly information:              DataflowInformation
}

export function getAliases(sourceIds: readonly NodeId[], dataflow: DataflowGraph, environment: REnvironmentInformation): NodeId[] | undefined {
	/*
	 * Hier raus finden was fürn Wert rechts (source) steht
	 * Wenn source konstante: define direkt mit id der konstante 
	 * Wenn source identifier: dann im environment nachschauen -> resolveByName 
	 * 	Wenn mind. 1 def mit keinem Konst Wert (oder keine Def): stop :( (top vom lattice)
	 *  Wenn alle Wert haben: dann Union alle Werte nehmen  
	 * Else: nix stop :( (top vom lattice) 
	 *
	 * -> In eine Funktion auslagern
	 * -> Später könnte man einen Funktionsaufruf auswerten :O :O :O :O
	 * -> Set Domain (später wäre intervall domain)
	 */

	let definitions: NodeId[] = [];

	for(const sourceId of sourceIds) {
		const info = dataflow.getVertex(sourceId);
		if(info === undefined) { return undefined; }

		if(info.tag === VertexType.Value) {
			// Source is constant
			definitions.push(sourceId);
		} else if (info.tag === VertexType.Use) {
			// Source is Symbol -> resolve definitions of symbol
			const identifier = recoverName(sourceId, dataflow.idMap);
			if(identifier === undefined) { return undefined; }

			const defs = resolveByName(identifier, environment);
			if(defs === undefined) { return undefined; }

			for(const def of defs) {
				// If one definition is not constant (or a variable aliasing a constant) 
				// we can't say for sure what value the source has 
				if (def.type === ReferenceType.Variable) {
					if(def.value === undefined) { return undefined; }
					definitions.push(...def.value);
				} else if(def.type !== ReferenceType.Constant && def.type !== ReferenceType.BuiltInConstant) {
					return undefined;
				}

				definitions.push(def.nodeId);
			}

		} else {
			return undefined;
		}
	}

	return [...new Set(definitions)];
}

/**
 * Consider a call like `x <- v`
 * @param information        - the information to define the assignment within
 * @param nodeToDefine       - `x`
 * @param sourceIds          - `v`
 * @param rootIdOfAssignment - `<-`
 * @param quoteSource        - whether to quote the source (i.e., define `x` without a direct reference to `v`)
 * @param superAssignment    - whether this is a super assignment (i.e., `<<-`)
 */
export function markAsAssignment(
	information: {
		environment: REnvironmentInformation,
		graph:       DataflowGraph
	},
	nodeToDefine: IdentifierDefinition,
	sourceIds: readonly NodeId[],
	rootIdOfAssignment: NodeId,
	quoteSource?: boolean,
	superAssignment?: boolean,
) {
	information.environment = define(nodeToDefine, superAssignment, information.environment);
	information.graph.setDefinitionOfVertex(nodeToDefine);
	if(!quoteSource) {
		for(const sourceId of sourceIds) {
			information.graph.addEdge(nodeToDefine, sourceId, EdgeType.DefinedBy);
		}
	}
	information.graph.addEdge(nodeToDefine, rootIdOfAssignment, EdgeType.DefinedBy);
	// kinda dirty, but we have to remove existing read edges for the symbol, added by the child
	const out = information.graph.outgoingEdges(nodeToDefine.nodeId);
	for(const [id,edge] of (out?? [])) {
		edge.types &= ~EdgeType.Reads;
		if(edge.types == 0) {
			out?.delete(id);
		}
	}
}

/**
 * Helper function whenever it is known that the _target_ of an assignment is a (single) symbol (i.e. `x <- ...`, but not `names(x) <- ...`).
 */
function processAssignmentToSymbol<OtherInfo>({
	nameOfAssignmentFunction,
	source,
	args: [targetArg, sourceArg],
	target,
	rootId,
	data,
	information,
	superAssignment,
	makeMaybe,
	quoteSource
}: AssignmentToSymbolParameters<OtherInfo>): DataflowInformation {
	const referenceType = checkTargetReferenceType(source, sourceArg);

	const aliases = getAliases([source.info.id], information.graph, information.environment);
	const writeNodes = produceWrittenNodes(rootId, targetArg, referenceType, data, makeMaybe ?? false, aliases);

	if(writeNodes.length !== 1 && log.settings.minLevel <= LogLevel.Warn) {
		log.warn(`Unexpected write number in assignment: ${JSON.stringify(writeNodes)}`);
	}

	// we drop the first arg which we use to pass along arguments :D
	const readFromSourceWritten = sourceArg.out.slice(1);
	const readTargets: readonly IdentifierReference[] = [
		{ nodeId: rootId, name: nameOfAssignmentFunction, controlDependencies: data.controlDependencies, type: ReferenceType.Function },
		...sourceArg.unknownReferences, ...sourceArg.in, ...targetArg.in.filter(i => i.nodeId !== target.info.id), ...readFromSourceWritten
	];

	information.environment = overwriteEnvironment(targetArg.environment, sourceArg.environment);

	// install assigned variables in environment
	for(const write of writeNodes) {
		markAsAssignment(information, write, [source.info.id], rootId, quoteSource, superAssignment);
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
		out:               [...writeNodes, ...readFromSourceWritten]
	};
}
