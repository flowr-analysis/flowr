import type {
	NodeId,
	ParentInformation,
	RFunctionArgument,
	RNode,
	RSymbol
} from '../../../../../../r-bridge'
import {
	collectAllIds, RType
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

export function processAssignment<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	/* we expect them to be ordered in the sense that we have (source, target): `<source> <- <target>` */
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { superAssignment?: boolean, swapSourceAndTarget?: boolean }
): DataflowInformation {
	if(args.length != 2) {
		dataflowLogger.warn(`Assignment ${name.content} has something else than 2 arguments, skipping`)
		return processKnownFunctionCall(name, args, rootId, data).information
	}

	const effectiveArgs = config.swapSourceAndTarget ? [args[1], args[0]] : args

	const { source, target } = extractSourceAndTarget(effectiveArgs, name)

	if(target.type === RType.FunctionCall && target.flavor === 'named') {
		dataflowLogger.debug(`Assignment ${name.content} has a function call as target => replacement function ${target.lexeme}`)
		return processAsNamedCall({
			type:      RType.Symbol,
			info:      target.info,
			content:   target.functionName.content + name.content,
			lexeme:    target.lexeme,
			location:  target.location,
			namespace: undefined
		}, data, target.lexeme, [...target.arguments, source])
	} else if(target.type === RType.Symbol) {
		const res = processKnownFunctionCall(name, effectiveArgs, rootId, data)
		return processAssignmentToSymbol(config.superAssignment ?? false, name, source, target, res.processedArguments as [DataflowInformation, DataflowInformation], rootId, data, res.information)
	}

	dataflowLogger.warn(`Assignment ${name.content} has an unknown target type ${target.type}, skipping`)

	return processKnownFunctionCall(name, effectiveArgs, rootId, data).information
}

function extractSourceAndTarget<OtherInfo>(args: readonly RFunctionArgument<OtherInfo & ParentInformation>[], name: RSymbol<OtherInfo & ParentInformation>) {
	const source = unpackArgument(args[1])
	const target = unpackArgument(args[0])

	guard(source !== undefined, () => `Assignment ${name.content} has no source, impossible!`)
	guard(target !== undefined, () => `Assignment ${name.content} has no target, impossible!`)

	return { source, target }
}

function produceWrittenNodes(rootId: NodeId, target: DataflowInformation, isFunctionDef: boolean): IdentifierDefinition[] {
	return target.in.map(ref => ({
		...ref,
		kind:      isFunctionDef ? 'function' : 'variable',
		definedAt: rootId
	}))
}

function processAssignmentToSymbol<OtherInfo>(
	superAssignment: boolean,
	name: RSymbol<OtherInfo & ParentInformation>,
	source: RNode<OtherInfo & ParentInformation>,
	target: RSymbol<OtherInfo & ParentInformation>,
	[targetArg, sourceArg]: [DataflowInformation, DataflowInformation],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	information: DataflowInformation
) {
	const isFunctionDef = source.type === RType.FunctionDefinition

	const writeNodes = produceWrittenNodes(rootId, targetArg, isFunctionDef)

	if(writeNodes.length !== 1 && log.settings.minLevel <= LogLevel.Warn) {
		log.warn(`Unexpected write number in assignment: ${JSON.stringify(writeNodes)}`)
	}

	const readFromSourceWritten = sourceArg.out
	const readTargets: IdentifierReference[] = [{ nodeId: name.info.id, name: name.content, used: 'always' }, ...sourceArg.unknownReferences, ...sourceArg.in, ...targetArg.in.filter(i => i.nodeId !== target.info.id), ...readFromSourceWritten]
	const writeTargets = [...writeNodes, ...targetArg.out, ...readFromSourceWritten]

	information.environment = overwriteEnvironment(targetArg.environment, sourceArg.environment)

	// install assigned variables in environment
	for(const write of writeNodes) {
		information.environment = define(write, superAssignment, information.environment)

		information.graph.setDefinitionOfVertex(write)

		if(isFunctionDef) {
			information.graph.addEdge(write, target.info.id, EdgeType.DefinedBy, 'always', true)
		} else {
			const impactReadTargets = determineImpactOfSource<OtherInfo>(source, information, data, readTargets)

			for(const read of impactReadTargets) {
				information.graph.addEdge(write, read, EdgeType.DefinedBy, undefined, true)
			}
		}
	}

	information.graph.addEdge(name.info.id, target.info.id, EdgeType.Returns, 'always', true)

	return {
		unknownReferences: [],
		in:                readTargets,
		out:               writeTargets,
		graph:             information.graph,
		environment:       information.environment
	}
}

/**
 * TODO: switch to track returns edge!
 * Some R-constructs like loops are known to return values completely independent of their input (loops return an invisible `NULL`).
 * This returns only those of `readTargets` that actually impact the target.
 */
function determineImpactOfSource<OtherInfo>(source: RNode<OtherInfo & ParentInformation>, info: DataflowInformation, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, readTargets: readonly IdentifierReference[]): Set<IdentifierReference> {
	// collect all ids from the source but stop at Loops, function calls, definitions and everything which links its own return
	// for loops this is necessary as they *always* return an invisible null, for function calls we do not know if they do
	// yet, we need to keep the ids of these elements
	const keepEndIds: NodeId[] = []
	const allIds = new Set(collectAllIds(source, n => {
		if(n.type === RType.FunctionCall || n.type === RType.FunctionDefinition) {
			keepEndIds.push(n.info.id)
			return true
		}
		return n.type === RType.ForLoop || n.type === RType.WhileLoop || n.type === RType.RepeatLoop
	})
	)
	for(const id of keepEndIds) {
		allIds.add(id)
	}
	if(allIds.size === 0) {
		return new Set()
	} else {
		return new Set(readTargets.filter(ref => allIds.has(ref.nodeId)))
	}
}
