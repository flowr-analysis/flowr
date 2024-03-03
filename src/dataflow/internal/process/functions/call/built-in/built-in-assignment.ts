import type {
	NodeId,
	ParentInformation,
	RFunctionArgument,
	RNode,
	RSymbol
} from '../../../../../../r-bridge'
import {
	collectAllIds
} from '../../../../../../r-bridge'
import { RType, EmptyArgument } from '../../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../../processor'
import type { DataflowInformation } from '../../../../../info'
import type { IdentifierReference } from '../../../../../index'
import { dataflowLogger, EdgeType, type IdentifierDefinition } from '../../../../../index'
import { processKnownFunctionCall } from '../known-call-handling'
import { guard } from '../../../../../../util/assert'
import { log, LogLevel } from '../../../../../../util/log'
import { define, overwriteEnvironment } from '../../../../../environments'

function extractSourceAndTarget<OtherInfo>(args: readonly RFunctionArgument<OtherInfo & ParentInformation>[], name: RSymbol<OtherInfo & ParentInformation>) {
	const sourceArg = args[1]
	const targetArg = args[0]

	guard(sourceArg !== EmptyArgument, () => `Assignment ${name.content} has no source, impossible!`)
	guard(targetArg !== EmptyArgument, () => `Assignment ${name.content} has no target, impossible!`)

	const source = sourceArg.value
	const target = targetArg.value
	guard(source !== undefined, () => `Assignment ${name.content} has no source, impossible!`)
	guard(target !== undefined, () => `Assignment ${name.content} has no target, impossible!`)

	return { source, target }
}

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

	const { information, processedArguments } = processKnownFunctionCall(name, effectiveArgs, rootId, data)

	const { source, target } = extractSourceAndTarget(effectiveArgs, name)

	if(target?.type === RType.FunctionCall) {
		console.log(`TODO: check replacement function with ${source.lexeme}`)
	} else if(target.type === RType.Symbol) {
		processAssignmentToSymbol(config.superAssignment ?? false, source, target, processedArguments as [DataflowInformation, DataflowInformation], rootId, data, information)
	}
	return information
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
	source: RNode<OtherInfo & ParentInformation>,
	target: RSymbol<OtherInfo & ParentInformation>,
	[targetArg, sourceArg]: [DataflowInformation, DataflowInformation],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	information: DataflowInformation
) {
	const isFunctionDef = source.type === RType.FunctionDefinition
	console.log(' symbol', target.lexeme, 'with source', source.lexeme, 'and is function def', isFunctionDef, 'and super assignment', superAssignment)

	const writeNodes = produceWrittenNodes(rootId, targetArg, isFunctionDef)

	if(writeNodes.length !== 1 && log.settings.minLevel <= LogLevel.Warn) {
		log.warn(`Unexpected write number in assignment: ${JSON.stringify(writeNodes)}`)
	}

	const readFromSourceWritten = sourceArg.out
	const readTargets = [...sourceArg.unknownReferences, ...sourceArg.in, ...targetArg.in, ...readFromSourceWritten]
	const writeTargets = [...writeNodes, ...targetArg.out, ...readFromSourceWritten]

	information.environment = overwriteEnvironment(targetArg.environment, sourceArg.environment)

	// install assigned variables in environment
	for(const write of writeNodes) {
		information.environment = define(write, superAssignment, information.environment)

		information.graph.setDefinitionOfVertex(write)

		if(isFunctionDef) {
			information.graph.addEdge(write, target.info.id, EdgeType.DefinedBy, 'always', true)
		} else {
			const impactReadTargets = determineImpactOfSource(source, readTargets)

			for(const read of impactReadTargets) {
				information.graph.addEdge(write, read, EdgeType.DefinedBy, undefined, true)
			}
		}
	}

	return {
		unknownReferences: [],
		in:                readTargets,
		out:               writeTargets,
		graph:             information.graph,
		environment:       information.environment
	}
}

/**
 * TODO: switch to returns edge!
 * Some R-constructs like loops are known to return values completely independent of their input (loops return an invisible `NULL`).
 * This returns only those of `readTargets` that actually impact the target.
 */
function determineImpactOfSource<OtherInfo>(source: RNode<OtherInfo & ParentInformation>, readTargets: readonly IdentifierReference[]): Set<IdentifierReference> {
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
