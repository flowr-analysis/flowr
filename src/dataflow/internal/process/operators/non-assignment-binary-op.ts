import type { DataflowInformation } from '../../../info'
import type { DataflowProcessorInformation } from '../../../processor'
import { processDataflowFor } from '../../../processor'
import { linkIngoingVariablesInSameScope } from '../../linker'
import type { ParentInformation, RBinaryOp } from '../../../../r-bridge'
import { appendEnvironment, overwriteEnvironment } from '../../../environments'

const logicalOperators = new Set(['&&', '||', '&', '|'])

export function processNonAssignmentBinaryOp<OtherInfo>(op: RBinaryOp<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const lhs = processDataflowFor(op.lhs, data)
	const rhs = processDataflowFor(op.rhs, data)

	const ingoing = [...lhs.in, ...rhs.in, ...lhs.unknownReferences, ...rhs.unknownReferences]
	const nextGraph = lhs.graph.mergeWith(rhs.graph)
	linkIngoingVariablesInSameScope(nextGraph, ingoing)

	const merger = logicalOperators.has(op.operator) ? appendEnvironment : overwriteEnvironment

	return {
		unknownReferences: [], // binary ops require reads as without assignments there is no definition
		in:                ingoing,
		out:               [...lhs.out, ...rhs.out],
		environment:       merger(lhs.environment, rhs.environment),
		graph:             nextGraph
	}
}
