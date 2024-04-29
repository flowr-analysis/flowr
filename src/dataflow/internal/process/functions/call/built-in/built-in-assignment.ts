import type {
	Base, Location,
	NodeId,
	ParentInformation,
	RFunctionArgument,
	RNode, RNodeWithParent, RString,
	RSymbol, RUnnamedArgument
} from '../../../../../../r-bridge'
import { removeRQuotes
	,
	RType
} from '../../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../../processor'
import type { DataflowInformation } from '../../../../../info'
import type { IdentifierReference, IdentifierDefinition } from '../../../../../index'
import { dataflowLogger, EdgeType  } from '../../../../../index'
import { processKnownFunctionCall } from '../known-call-handling'
import { guard } from '../../../../../../util/assert'
import { log, LogLevel } from '../../../../../../util/log'
import { define, overwriteEnvironment } from '../../../../../environments'
import { unpackArgument } from '../argument/unpack-argument'
import { processAsNamedCall } from '../../../process-named-call'
import { toUnnamedArgument } from '../argument/make-argument'

function toReplacementSymbol<OtherInfo>(target: RNodeWithParent<OtherInfo & ParentInformation> & Base<OtherInfo> & Location, prefix: string, superAssignment: boolean): RSymbol<OtherInfo & ParentInformation> {
	return {
		type:      RType.Symbol,
		info:      target.info,
		/* they are all mapped to <- in R, but we mark super as well */
		content:   `${prefix}${superAssignment ? '<<-' : '<-'}`,
		lexeme:    target.lexeme,
		location:  target.location,
		namespace: undefined
	}
}

function getEffectiveOrder<T>(config: {
	swapSourceAndTarget?: boolean
}, args: [T, T]): [T, T] {
	return config.swapSourceAndTarget ? [args[1], args[0]] : args
}

export interface AssignmentConfiguration {
	readonly superAssignment?:     boolean
	readonly swapSourceAndTarget?: boolean
	/* Make maybe if assigned to symbol */
	readonly makeMaybe?:           boolean
}

/**
 * Processes an assignment, i.e., `<target> <- <source>`.
 * Handling it as a function call `` `<-`(<target>, <source>)``.
 * This includes handling of replacement functions (e.g., `names(x) <- ...` as `` `names<-`(x, ...) ``).
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
		dataflowLogger.warn(`Assignment ${name.content} has something else than 2 arguments, skipping`)
		return processKnownFunctionCall({ name, args, rootId, data }).information
	}

	const effectiveArgs = getEffectiveOrder(config, args as [RFunctionArgument<OtherInfo & ParentInformation>, RFunctionArgument<OtherInfo & ParentInformation>])
	const { target, source } = extractSourceAndTarget(effectiveArgs, name)

	if(target.type === RType.Symbol) {
		const res = processKnownFunctionCall({ name, args, rootId, data, reverseOrder: !config.swapSourceAndTarget })
		return processAssignmentToSymbol(config.superAssignment ?? false, name, source, target, getEffectiveOrder(config, res.processedArguments as [DataflowInformation, DataflowInformation]), rootId, data, res.information, config.makeMaybe)
	} else if(target.type === RType.FunctionCall && target.flavor === 'named') {
		/* as replacement functions take precedence over the lhs fn-call (i.e., `names(x) <- ...` is independent from the definition of `names`), we do not have to process the call */
		dataflowLogger.debug(`Assignment ${name.content} has a function call as target => replacement function ${target.lexeme}`)
		const replacement = toReplacementSymbol(target, target.functionName.content, config.superAssignment ?? false)
		return processAsNamedCall(replacement, data, replacement.content, [...target.arguments, source])
	} else if(target.type === RType.Access) {
		dataflowLogger.debug(`Assignment ${name.content} has an access as target => replacement function ${target.lexeme}`)
		const replacement = toReplacementSymbol(target, target.operator, config.superAssignment ?? false)
		return processAsNamedCall(replacement, data, replacement.content, [toUnnamedArgument(target.accessed, data.completeAst.idMap), ...target.access, source])
	} else if(target.type === RType.String) {
		return processAssignmentToString(target, args, name, rootId, data, config, source)
	}

	dataflowLogger.warn(`Assignment ${name.content} has an unknown target type ${target.type}, skipping`)
	return processKnownFunctionCall({ name, args: effectiveArgs, rootId, data }).information
}

function extractSourceAndTarget<OtherInfo>(args: readonly RFunctionArgument<OtherInfo & ParentInformation>[], name: RSymbol<OtherInfo & ParentInformation>) {
	const source = unpackArgument(args[1])
	const target = unpackArgument(args[0])

	guard(source !== undefined, () => `Assignment ${name.content} has no source, impossible!`)
	guard(target !== undefined, () => `Assignment ${name.content} has no target, impossible!`)

	return { source, target }
}

function produceWrittenNodes<OtherInfo>(rootId: NodeId, target: DataflowInformation, isFunctionDef: boolean, data: DataflowProcessorInformation<OtherInfo>, makeMaybe: boolean): IdentifierDefinition[] {
	return target.in.map(ref => ({
		...ref,
		kind:              isFunctionDef ? 'function' : 'variable',
		definedAt:         rootId,
		controlDependency: data.controlDependency ?? makeMaybe ? [] : undefined
	}))
}

function processAssignmentToString<OtherInfo>(target: RString<OtherInfo & ParentInformation>, args: readonly RFunctionArgument<OtherInfo & ParentInformation>[], name: RSymbol<OtherInfo & ParentInformation>, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, config: {
	superAssignment?:     boolean;
	swapSourceAndTarget?: boolean
}, source: RNode<OtherInfo & ParentInformation>) {
	const symbol: RSymbol<OtherInfo & ParentInformation> = {
		type:      RType.Symbol,
		info:      target.info,
		content:   removeRQuotes(target.lexeme),
		lexeme:    target.lexeme,
		location:  target.location,
		namespace: undefined
	}

	// treat first argument to Symbol
	const mappedArgs = config.swapSourceAndTarget ? [args[0], { ...(args[1] as RUnnamedArgument<OtherInfo & ParentInformation>), value: symbol }] : [{ ...(args[0] as RUnnamedArgument<OtherInfo & ParentInformation>), value: symbol }, args[1]]
	const res = processKnownFunctionCall({ name, args: mappedArgs, rootId, data, reverseOrder: !config.swapSourceAndTarget })
	return processAssignmentToSymbol(config.superAssignment ?? false, name, source, symbol, getEffectiveOrder(config, res.processedArguments as [DataflowInformation, DataflowInformation]), rootId, data, res.information)
}

function checkFunctionDef<OtherInfo>(source: RNode<OtherInfo & ParentInformation>, sourceInfo: DataflowInformation) {
	const vertex = sourceInfo.graph.get(source.info.id)
	return vertex?.[0].tag === 'function-definition'
}

/**
 * Helper function whenever it is known that the _target_ of an assignment is a (single) symbol (i.e. `x <- ...`, but not `names(x) <- ...`).
 */
function processAssignmentToSymbol<OtherInfo>(
	superAssignment: boolean,
	name: RSymbol<OtherInfo & ParentInformation>,
	source: RNode<OtherInfo & ParentInformation>,
	target: RSymbol<OtherInfo & ParentInformation>,
	[targetArg, sourceArg]: [DataflowInformation, DataflowInformation],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	information: DataflowInformation,
	makeMaybe?: boolean
): DataflowInformation {
	const isFunctionDef = checkFunctionDef(source, sourceArg)

	const writeNodes = produceWrittenNodes(rootId, targetArg, isFunctionDef, data, makeMaybe ?? false)

	if(writeNodes.length !== 1 && log.settings.minLevel <= LogLevel.Warn) {
		log.warn(`Unexpected write number in assignment: ${JSON.stringify(writeNodes)}`)
	}

	// we drop the first arg which we use to pass along arguments :D
	const readFromSourceWritten = sourceArg.out.slice(1)
	const readTargets: readonly IdentifierReference[] = [{ nodeId: name.info.id, name: name.content, controlDependency: data.controlDependency }, ...sourceArg.unknownReferences, ...sourceArg.in, ...targetArg.in.filter(i => i.nodeId !== target.info.id), ...readFromSourceWritten]
	const writeTargets = [...writeNodes, ...writeNodes, ...readFromSourceWritten]

	information.environment = overwriteEnvironment(targetArg.environment, sourceArg.environment)

	// install assigned variables in environment
	for(const write of writeNodes) {
		information.environment = define(write, superAssignment, information.environment)
		information.graph.setDefinitionOfVertex(write)
		information.graph.addEdge(write, source.info.id, { type: EdgeType.DefinedBy })
		information.graph.addEdge(write, rootId, { type: EdgeType.DefinedBy })
		// kinda dirty, but we have to remove existing read edges for the symbol, added by the child
		const out = information.graph.outgoingEdges(write.nodeId)
		for(const [id,edge] of (out?? [])) {
			if(edge.types.has(EdgeType.Reads)) {
				if(edge.types.size === 1) {
					out?.delete(id)
				} else {
					edge.types.delete(EdgeType.Reads)
				}
			}
		}
	}

	information.graph.addEdge(name.info.id, targetArg.out[0], { type: EdgeType.Returns })
	/* an assignment reads its source */
	// TODO: this doesnt work atm to find functionns information.graph.addEdge(name.info.id, sourceArg.out[0], { type: EdgeType.Reads })

	return {
		...information,
		unknownReferences: [],
		entryPoint:        name.info.id,
		in:                readTargets,
		out:               writeTargets,
	}
}

