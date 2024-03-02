import type { NodeId, ParentInformation, RBinaryOp, RNode } from '../../../../r-bridge'
import { collectAllIds } from '../../../../r-bridge'
import { RType } from '../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../processor'
import { processDataflowFor } from '../../../processor'
import { dataflowLogger } from '../../../index'
import { EdgeType } from '../../../graph'
import type { DataflowInformation } from '../../../info'
import type { IdentifierDefinition, IdentifierReference } from '../../../environments'
import { define, overwriteEnvironments } from '../../../environments'
import { log, LogLevel } from '../../../../util/log'

export function processAssignment<OtherInfo>(op: RBinaryOp<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	dataflowLogger.trace(`Processing assignment with id ${op.info.id}`)
	const lhs = processDataflowFor(op.lhs, data)
	const rhs = processDataflowFor(op.rhs, data)
	const { readTargets, newWriteNodes, writeTargets, environments, swap } = processReadAndWriteForAssignmentBasedOnOp(op, lhs, rhs)
	const nextGraph = lhs.graph.mergeWith(rhs.graph)

	// deal with special cases based on the source node and the determined read targets

	const isFunctionSide = swap ? op.lhs : op.rhs
	const isFunction = isFunctionSide.type === RType.FunctionDefinition

	for(const write of newWriteNodes) {
		nextGraph.setDefinitionOfVertex(write)

		if(isFunction) {
			nextGraph.addEdge(write, isFunctionSide.info.id, EdgeType.DefinedBy, 'always', true)
		} else {
			const impactReadTargets = determineImpactOfSource(swap ? op.lhs : op.rhs, readTargets)

			for(const read of impactReadTargets) {
				nextGraph.addEdge(write, read, EdgeType.DefinedBy, undefined, true)
			}
		}
	}

	return {
		unknownReferences: [],
		in:                readTargets,
		out:               writeTargets,
		graph:             nextGraph,
		environments
	}
}

interface SourceAndTarget {
	source:          DataflowInformation
	target:          DataflowInformation
	superAssignment: boolean
	/** true if `->` or `->>` */
	swap:            boolean
}

function identifySourceAndTarget<OtherInfo>(
	op: RNode<OtherInfo & ParentInformation>,
	lhs: DataflowInformation,
	rhs: DataflowInformation
) : SourceAndTarget {
	let source: DataflowInformation
	let target: DataflowInformation
	let superAssignment = false
	let swap = false

	switch(op.lexeme) {
		case '<-':
		case '=':
		case ':=':
			[target, source] = [lhs, rhs]
			break
		case '<<-':
			[target, source, superAssignment] = [lhs, rhs, true]
			break
		case '->':
			[target, source, swap] = [rhs, lhs, true]
			break
		case '->>':
			[target, source, superAssignment, swap] = [rhs, lhs, true, true]
			break
		default:
			throw new Error(`Unknown assignment operator ${JSON.stringify(op)}`)
	}
	return { source, target, superAssignment, swap }
}

function produceWrittenNodes<OtherInfo>(op: RBinaryOp<OtherInfo & ParentInformation>, target: DataflowInformation, functionTypeCheck: RNode<ParentInformation>): IdentifierDefinition[] {
	const isFunctionDef = functionTypeCheck.type === RType.FunctionDefinition
	return target.unknownReferences.map(ref => ({
		...ref,
		kind:      isFunctionDef ? 'function' : 'variable',
		definedAt: op.info.id
	}))
}

function processReadAndWriteForAssignmentBasedOnOp<OtherInfo>(
	op: RBinaryOp<OtherInfo & ParentInformation>,
	lhs: DataflowInformation, rhs: DataflowInformation,
) {
	// what is written/read additionally is based on lhs/rhs - assignments read written variables as well
	const read = [...lhs.in, ...rhs.in]
	const { source, target, superAssignment, swap } = identifySourceAndTarget(op, lhs, rhs)

	const funcTypeCheck = swap ? op.lhs : op.rhs

	const writeNodes = produceWrittenNodes(op, target, funcTypeCheck)

	if(writeNodes.length !== 1 && log.settings.minLevel <= LogLevel.Warn) {
		log.warn(`Unexpected write number in assignment: ${JSON.stringify(writeNodes)}`)
	}

	const readFromSourceWritten = source.out
	let environments = overwriteEnvironments(source.environments, target.environments)

	// install assigned variables in environment
	for(const write of writeNodes) {
		environments = define(write, superAssignment, environments)
	}
	return {
		readTargets:   [...source.unknownReferences, ...read, ...readFromSourceWritten],
		writeTargets:  [...writeNodes, ...target.out, ...readFromSourceWritten],
		environments:  environments,
		newWriteNodes: writeNodes,
		swap
	}
}

/**
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
